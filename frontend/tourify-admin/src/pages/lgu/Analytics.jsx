import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { IoCompassOutline, IoGitCompare, IoTrailSignOutline } from 'react-icons/io5';
import LguLayout from '../../components/LguLayout';
import '../../styles/AdminDashboard.css';
import {
  fetchLguArrivals,
  fetchLguTopEstablishments,
  fetchLguFeedbackSummary,
  fetchLguApprovalStats,
  fetchLguMovements,
  fetchLguCheckins
} from '../../services/lguAnalyticsApi';
import { fetchMunicipalityArrivals, fetchVisitorHeatmap } from '../../services/analyticsApi';

const wrapTickLabel = text => {
  if (!text) return ['—'];
  const words = text.split(' ');
  const lines = [];
  let current = '';

  words.forEach(word => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > 12 && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });

  if (current) lines.push(current);
  return lines;
};

const EstablishmentTick = ({ x, y, payload }) => {
  const lines = wrapTickLabel(payload?.value ?? '');
  return (
    <text x={x} y={y + 10} textAnchor="middle" fill="#556868">
      {lines.map((line, index) => (
        <tspan key={`${payload?.value ?? ''}-${index}`} x={x} dy={index === 0 ? 0 : 12}>
          {line}
        </tspan>
      ))}
    </text>
  );
};

const buildSankeyData = flows => {
  const nodes = [];
  const nodeIndex = new Map();
  const ensureNode = (id, name) => {
    const key = id || name || `unknown-${nodes.length}`;
    if (!nodeIndex.has(key)) {
      nodeIndex.set(key, nodes.length);
      nodes.push({ name: name || key });
    }
    return nodeIndex.get(key);
  };

  const links = [];
  const seenEdges = new Set();

  flows.forEach(flow => {
    const sourceIdx = ensureNode(flow.from?.id, flow.from?.name);
    const targetIdx = ensureNode(flow.to?.id, flow.to?.name);

    if (!Number.isFinite(flow.visits) || flow.visits <= 0) return;
    if (sourceIdx === targetIdx) return;

    const forward = `${sourceIdx}->${targetIdx}`;
    const reverse = `${targetIdx}->${sourceIdx}`;
    if (seenEdges.has(reverse)) return;

    seenEdges.add(forward);
    links.push({ source: sourceIdx, target: targetIdx, value: flow.visits });
  });

  return { nodes, links };
};

const formatStop = stop => {
  if (!stop) return 'N/A';
  const label =
    stop.name ||
    stop.businessEstablishment_id ||
    stop.business_establishment_id ||
    stop.id ||
    'N/A';
  return stop.municipality ? `${label} (${stop.municipality})` : label;
};

const heatGradient = {
  0.1: '#5db7ff',
  0.4: '#4b7be5',
  0.7: '#f2c94c',
  1.0: '#f94144',
};

const pieColors = ['#2f80ed', '#56ccf2', '#f2c94c', '#f2994a', '#eb5757'];

function HeatmapLayer({ points, radius = 20, blur = 25 }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !points.length) return;

    const layer = window.L.heatLayer(
      points.map(point => [point.lat, point.lng, point.weight ?? 1]),
      { radius, blur, maxZoom: 13, gradient: heatGradient },
    ).addTo(map);

    const bounds = window.L.latLngBounds(points.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds.pad(0.2));

    return () => layer.remove();
  }, [map, points, radius, blur]);

  return null;
}

function LguAnalytics() {
  const [municipalityFilter] = useState(() => sessionStorage.getItem('mockMunicipality') || '');
  const [municipalityLabel, setMunicipalityLabel] = useState(
    municipalityFilter || 'Your municipality',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trend, setTrend] = useState([]);
  // const [municipalityArrivals, setMunicipalityArrivals] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [heatmapPoints, setHeatmapPoints] = useState([]);
  const [feedbackBreakdown, setFeedbackBreakdown] = useState([]);
  const [accreditation, setAccreditation] = useState([]);
  const [flows, setFlows] = useState([]);

  const [checkins, setCheckins] = useState([]);

  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';
  const [exportRange, setExportRange] = useState({ from: '', to: '' });

  const handleLguExport = async type => {
    const params = new URLSearchParams();
    if (exportRange.from) params.append('from', `${exportRange.from}-01`);
    if (exportRange.to) params.append('to', `${exportRange.to}-28`);

    const token = sessionStorage.getItem('accessToken');
    if (!token) {
      alert('Please log in to export data.');
      return;
    }

    try {
      const response = await fetch(
        `${apiBase}/admin/analytics/lgu/export/${type}?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) throw new Error(await response.text());

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = type === 'excel' ? 'lgu-analytics.xlsx' : 'lgu-analytics.pdf';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[LGU export] failed', err);
      alert(err.message || 'Unable to export LGU analytics.');
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [
          trendRes,
          municipalityRes,
          destinationRes,
          heatmapRes,
          feedbackRes,
          accreditationRes,
          flowsRes,
          checkinsRes,
        ] = await Promise.all([
          fetchLguArrivals().then(res => res.data?.trends ?? []),
          fetchMunicipalityArrivals(
            municipalityFilter ? { limit: 12, municipalityId: municipalityFilter } : { limit: 12 },
          ).then(res => res.data?.municipalities ?? []),
          fetchLguTopEstablishments({ limit: 10 }).then(res => res.data?.topDestinations ?? []),
          fetchVisitorHeatmap(
            municipalityFilter ? { municipalityId: municipalityFilter } : undefined,
          ).then(res => res.data?.points ?? []),
          fetchLguFeedbackSummary().then(res => res.data?.ratings ?? []),
          fetchLguApprovalStats().then(res => res.data?.statuses ?? []),
          fetchLguMovements({ limit: 8 }).then(res => res.data?.flows ?? []),
          fetchLguCheckins({ limit: 12 }).then(res => res.data?.establishments ?? []),
        ]);

        if (!mounted) return;

        const scopedArrivals = municipalityFilter
          ? municipalityRes.filter(
              row =>
                row.municipality_id === municipalityFilter || row.municipality === municipalityFilter,
            )
          : municipalityRes;

        const resolvedName =
          scopedArrivals[0]?.municipality ?? scopedArrivals[0]?.municipality_id ?? municipalityLabel;
        if (resolvedName) setMunicipalityLabel(resolvedName);

        setTrend(trendRes);
        setDestinations(destinationRes);
        setHeatmapPoints(heatmapRes);
        setFeedbackBreakdown(feedbackRes);
        setAccreditation(accreditationRes);
        setFlows(flowsRes);
        setCheckins(checkinsRes);
        setError('');
      } catch (err) {
        console.error('[LguAnalytics] load failed', err);
        if (mounted) setError('Unable to load municipal analytics right now.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [municipalityFilter, municipalityLabel]);

  const filteredHeatmapPoints = useMemo(() => {
    if (!municipalityFilter) return heatmapPoints;
    return heatmapPoints.filter(point => point.municipality === municipalityFilter);
  }, [heatmapPoints, municipalityFilter]);

  const sankeyData = useMemo(() => buildSankeyData(flows), [flows]);

  const tourists30Days = useMemo(() => {
    if (!trend.length) return 0;
    const latest = trend[trend.length - 1];
    return latest?.touristCount ?? latest?.tourists ?? 0;
  }, [trend]);

  const topDestination = destinations[0];
  const topMovement = flows[0];

  const summaryCards = useMemo(
    () => [
      {
        label: 'Tourists (30 days)',
        value: tourists30Days ? tourists30Days.toLocaleString() : '—',
        helper: trend.length ? `Latest month: ${trend.at(-1)?.month ?? '—'}` : 'No arrivals yet',
        icon: <IoTrailSignOutline />,
      },
      {
        label: 'Top destination',
        value: topDestination?.name ?? '—',
        helper: topDestination
          ? `${topDestination.checkIns ?? topDestination.rating_count ?? 0} visits`
          : 'No data yet',
        icon: <IoCompassOutline />,
      },
      {
        label: 'Top movement',
        value:
          topMovement?.from || topMovement?.to
            ? `${formatStop(topMovement?.from)} -> ${formatStop(topMovement?.to)}`
            : '—',
        helper: topMovement ? `${topMovement.visits ?? 0} itineraries` : 'No sequences yet',
        icon: <IoGitCompare />,
      },
    ],
    [tourists30Days, trend, topDestination, topMovement],
  );

  return (
    <LguLayout
      title={`${municipalityLabel} tourism analytics`}
      subtitle="Real-time insights for your municipality only."
    >
      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="muted">Loading analytics...</p> : null}

      <section className="analytics-summary-grid">
        {summaryCards.map(card => (
          <article key={card.label} className="summary-card summary-card--compact">
            <div className="summary-icon">{card.icon}</div>
            <p className="summary-label">{card.label}</p>
            <p className="summary-value">{card.value}</p>
            <p className="summary-helper">{card.helper}</p>
          </article>
        ))}
      </section>

      <section className="analytics-export-bar">
        <div className="export-range">
          <label>
            From
            <input
              type="month"
              value={exportRange.from}
              onChange={event => setExportRange(prev => ({ ...prev, from: event.target.value }))}
            />
          </label>
          <label>
            To
            <input
              type="month"
              value={exportRange.to}
              onChange={event => setExportRange(prev => ({ ...prev, to: event.target.value }))}
            />
          </label>
        </div>
        <div className="export-buttons">
          <button type="button" onClick={() => handleLguExport('excel')}>
            Download Excel
          </button>
          <button type="button" onClick={() => handleLguExport('pdf')}>
            Download PDF
          </button>
        </div>
      </section>

      <section className="analytics-hero-grid">
        <article className="analytics-card hero-map-card" id="lgu-heatmap-card">
          <header>
            <div>
              <p className="hero-eyebrow">Visitor density</p>
              <h3>{municipalityLabel} hotspots</h3>
            </div>
            <span className="hero-chip">{filteredHeatmapPoints.length} hotspots</span>
          </header>
          <div className="map-shell">
            <MapContainer center={[9.85, 124.2]} zoom={10} scrollWheelZoom>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <HeatmapLayer points={filteredHeatmapPoints} />
            </MapContainer>
          </div>
        </article>

        <div className="analytics-side-stack">
          <article className="analytics-card compact-card" id="lgu-feedback-card">
            <header>
              <h3>Feedback rating summary</h3>
              <p>1-5 star reviews from establishments in {municipalityLabel}.</p>
            </header>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Tooltip />
                <Legend />
                <Pie
                  data={feedbackBreakdown}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={48}
                  outerRadius={80}
                  label
                >
                  {feedbackBreakdown.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={pieColors[index % pieColors.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </article>

          <article className="analytics-card compact-card" id="lgu-accreditation-card">
            <header>
              <h3>Accreditation status</h3>
              <p>Current verification mix for local establishments.</p>
            </header>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Tooltip />
                <Legend />
                <Pie
                  data={accreditation}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={48}
                  outerRadius={80}
                  label
                >
                  {accreditation.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={pieColors[index % pieColors.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </article>
        </div>
      </section>

      <section className="analytics-lower-grid">
        <article className="analytics-card span-2" id="lgu-monthly-arrivals-card">
          <header>
            <h3>Monthly arrivals</h3>
            <p>Itineraries and tourists originating in {municipalityLabel}.</p>
          </header>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="arrivalsArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4b7be5" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#4b7be5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="touristCount" stroke="#4b7be5" fill="url(#arrivalsArea)" />
              <Area type="monotone" dataKey="trips" stroke="#27ae60" fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>
        </article>

        <article className="analytics-card span-2" id="lgu-top-destinations-card">
          <header>
            <h3>Top destinations</h3>
            <p>Highest QR/feedback activity inside the municipality.</p>
          </header>
          {destinations.length ? (
            <div className="top-destination-scroll">
              <ol className="top-destination-list two-column">
                {destinations.map((item, index) => (
                  <li key={item.businessEstablishment_id || item.name || index}>
                    <div className="destination-name">
                      <strong>{index + 1}.</strong> {item.name ?? 'Unnamed establishment'}
                    </div>
                    <p className="muted destination-meta">
                      {(item.checkIns ?? item.rating_count ?? 0).toLocaleString()} visits
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="muted">No local check-ins recorded yet.</p>
          )}
        </article>

        <article className="analytics-card span-4" id="lgu-sankey-card">
          <header>
            <h3>Travel pattern analytics</h3>
            <p>Most common next-stop sequences that include your municipality.</p>
          </header>
          <ResponsiveContainer width="100%" height={320}>
            <Sankey
              data={sankeyData}
              nodePadding={30}
              linkCurvature={0.6}
              link={{ stroke: '#8884d8' }}
              node={{ stroke: '#333', fill: '#2f80ed' }}
            >
              <Tooltip />
            </Sankey>
          </ResponsiveContainer>
        </article>

        <article className="analytics-card span-2" id="lgu-checkins-card">
          <header>
            <h3>Check-ins by source</h3>
            <p>Manual vs QR scans for establishments in {municipalityLabel} (last 30 days).</p>
          </header>
          {checkins.length ? (
            <ResponsiveContainer width="100%" height={290}>
              <BarChart data={checkins}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={<EstablishmentTick />} interval={0} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="qr" stackId="a" fill="#4b7be5" name="QR scanned" />
                <Bar dataKey="manual" stackId="a" fill="#f2994a" name="Manual" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted">No establishment check-ins in the past 30 days.</p>
          )}
        </article>
      </section>
    </LguLayout>
  );
}

export default LguAnalytics;
