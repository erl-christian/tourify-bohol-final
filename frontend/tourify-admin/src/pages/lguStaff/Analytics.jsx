import { useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Sankey, Tooltip, XAxis, YAxis,
} from 'recharts';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { IoCompassOutline, IoGitCompare, IoTrailSignOutline } from 'react-icons/io5';
import LguStaffLayout from '../../components/LguStaffLayout';
import '../../styles/AdminDashboard.css';
import {
  fetchLguArrivals,
  fetchLguTopEstablishments,
  fetchLguFeedbackSummary,
  fetchLguApprovalStats,
  fetchLguMovements,
  fetchLguCheckins,
  fetchLguNationalities,
} from '../../services/lguAnalyticsApi';
import {
  fetchMunicipalityArrivals,
  fetchVisitorHeatmap,
  fetchSpmStatus,
  rebuildSpm,
} from '../../services/analyticsApi';
import { useActionStatus } from '../../context/ActionStatusContext';

const pieColors = ['#2f80ed', '#56ccf2', '#f2c94c', '#f2994a', '#eb5757'];

const wrapTickLabel = (text) => {
  if (!text) return ['—'];
  const words = text.split(' ');
  const lines = [];
  let current = '';
  words.forEach((word) => {
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

  const pairMap = new Map();

  flows.forEach(flow => {
    const fromId = flow.from?.id || flow.from?.name;
    const toId = flow.to?.id || flow.to?.name;
    const fromName = flow.from?.name || String(fromId || 'Unknown');
    const toName = flow.to?.name || String(toId || 'Unknown');
    const visits = Number(flow.visits);

    if (!fromId || !toId || fromId === toId) return;
    if (!Number.isFinite(visits) || visits <= 0) return;

    const leftFirst = String(fromId) < String(toId);
    const leftId = leftFirst ? String(fromId) : String(toId);
    const rightId = leftFirst ? String(toId) : String(fromId);
    const leftName = leftFirst ? fromName : toName;
    const rightName = leftFirst ? toName : fromName;

    const pairKey = `${leftId}::${rightId}`;
    const pair = pairMap.get(pairKey) ?? {
      leftId,
      rightId,
      leftName,
      rightName,
      leftToRight: 0,
      rightToLeft: 0,
    };

    if (String(fromId) === leftId) pair.leftToRight += visits;
    else pair.rightToLeft += visits;

    pairMap.set(pairKey, pair);
  });

  const links = [];
  pairMap.forEach(pair => {
    const total = pair.leftToRight + pair.rightToLeft;
    if (total <= 0) return;

    const useLeftToRight = pair.leftToRight >= pair.rightToLeft;
    const sourceId = useLeftToRight ? pair.leftId : pair.rightId;
    const targetId = useLeftToRight ? pair.rightId : pair.leftId;
    const sourceName = useLeftToRight ? pair.leftName : pair.rightName;
    const targetName = useLeftToRight ? pair.rightName : pair.leftName;

    const sourceIdx = ensureNode(sourceId, sourceName);
    const targetIdx = ensureNode(targetId, targetName);

    links.push({ source: sourceIdx, target: targetIdx, value: total });
  });

  links.sort((a, b) => b.value - a.value);
  return { nodes, links };
};


const formatStop = (stop) => {
  if (!stop) return 'N/A';
  const label = stop.name || stop.businessEstablishment_id || stop.business_establishment_id || stop.id || 'N/A';
  return stop.municipality ? `${label} (${stop.municipality})` : label;
};

const heatGradient = { 0.1: '#5db7ff', 0.4: '#4b7be5', 0.7: '#f2c94c', 1.0: '#f94144' };

function HeatmapLayer({ points, radius = 20, blur = 25 }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !points.length) return;
    const layer = window.L.heatLayer(
      points.map((p) => [p.lat, p.lng, p.weight ?? 1]),
      { radius, blur, maxZoom: 13, gradient: heatGradient },
    ).addTo(map);
    const bounds = window.L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds.pad(0.2));
    return () => layer.remove();
  }, [map, points, radius, blur]);
  return null;
}

function SpmControls() {
  const [status, setStatus] = useState({ running: false, lastRunAt: null });
  const [loading, setLoading] = useState(false);
  const { showLoading, showSuccess, showError } = useActionStatus();

  const loadStatus = async () => {
    try {
      const data = await fetchSpmStatus();
      setStatus(data);
    } catch (err) {
      console.warn('SPM status failed', err?.message);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleRebuild = async () => {
    setLoading(true);
    showLoading('Running sequence mining...');
    try {
      await rebuildSpm();
      await loadStatus();
      showSuccess('SPM mining started/completed.');
    } catch (err) {
      showError(err?.response?.data?.message || err?.message || 'Failed to start mining.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
      <button
        type="button"
        className="primary-cta"
        onClick={handleRebuild}
        disabled={loading || status.running}
      >
        {status.running ? 'Mining...' : 'Mine sequences'}
      </button>
      <span className="muted">
        Last run: {status.lastRunAt ? new Date(status.lastRunAt).toLocaleString() : 'Never'}
      </span>
    </div>
  );
}


function LguStaffAnalytics() {
  const [municipalityLabel, setMunicipalityLabel] = useState('Your municipality');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trend, setTrend] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [heatmapPoints, setHeatmapPoints] = useState([]);
  const [feedbackBreakdown, setFeedbackBreakdown] = useState([]);
  const [accreditation, setAccreditation] = useState([]);
  const [flows, setFlows] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [exportRange, setExportRange] = useState({ from: '', to: '' });

  const [nationalities, setNationalities] = useState([]);


  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';
  const { showLoading, showSuccess, showError } = useActionStatus();

  const handleExport = async (type) => {
    const params = new URLSearchParams();
    if (exportRange.from) params.append('from', `${exportRange.from}-01`);
    if (exportRange.to) params.append('to', `${exportRange.to}-28`);
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
      showError('Please log in to export.');
      return;
    }
    try {
      showLoading('Preparing export file...');
      const resp = await fetch(
        `${apiBase}/admin/analytics/lgu/export/${type}?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!resp.ok) throw new Error(await resp.text());
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'excel' ? 'lgu-analytics.xlsx' : 'lgu-analytics.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showSuccess((type === 'excel' ? 'Excel' : 'PDF') + ' export is ready.');
    } catch (err) {
      console.error('[LGU Staff export] failed', err);
      showError(err.message || 'Unable to export.');
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
          nationalitiesRes,
        ] = await Promise.all([
          fetchLguArrivals().then((res) => res.data?.trends ?? []),
          fetchMunicipalityArrivals({ limit: 12 }).then((res) => res.data?.municipalities ?? []),
          fetchLguTopEstablishments({ limit: 10 }).then((res) => res.data?.topDestinations ?? []),
          fetchVisitorHeatmap().then((res) => res.data?.points ?? []),
          fetchLguFeedbackSummary().then((res) => res.data?.ratings ?? []),
          fetchLguApprovalStats().then((res) => res.data?.statuses ?? []),
          fetchLguMovements({ limit: 50 }).then((res) => res.data?.flows ?? []),
          fetchLguCheckins({ limit: 12 }).then((res) => res.data?.establishments ?? []),
          fetchLguNationalities({ limit: 8 }).then(res => res.data?.nationalities ?? []),
        ]);
        if (!mounted) return;
        setTrend(trendRes);
        setDestinations(destinationRes);
        setHeatmapPoints(heatmapRes);
        setFeedbackBreakdown(feedbackRes);
        setAccreditation(accreditationRes);
        setNationalities(nationalitiesRes);
        setFlows(flowsRes);
        setCheckins(checkinsRes);

        const muniName =
          municipalityRes[0]?.municipality ??
          municipalityRes[0]?.municipality_id ??
          municipalityLabel;
        if (muniName) setMunicipalityLabel(muniName);

        setError('');
      } catch (err) {
        console.error('[LguStaffAnalytics] load failed', err);
        if (mounted) setError('Unable to load analytics right now.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [municipalityLabel]);

  const filteredHeatmapPoints = useMemo(() => heatmapPoints, [heatmapPoints]);
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
    <LguStaffLayout
      title={`${municipalityLabel} Quick Reports`}
      subtitle="LGU staff view of municipal analytics with exports."
    >
      <SpmControls />
      <section className="analytics-export-bar">
        <div className="export-range">
          <label>
            From
            <input
              type="month"
              value={exportRange.from}
              onChange={(event) => setExportRange((prev) => ({ ...prev, from: event.target.value }))}
            />
          </label>
          <label>
            To
            <input
              type="month"
              value={exportRange.to}
              onChange={(event) => setExportRange((prev) => ({ ...prev, to: event.target.value }))}
            />
          </label>
        </div>
        <div className="export-buttons">
          <button type="button" onClick={() => handleExport('excel')}>
            Download Excel
          </button>
          <button type="button" onClick={() => handleExport('pdf')}>
            Download PDF
          </button>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="muted">Loading analytics…</p> : null}

      <section className="analytics-summary-grid">
        {summaryCards.map((card) => (
          <article key={card.label} className="summary-card summary-card--compact">
            <div className="summary-icon">{card.icon}</div>
            <p className="summary-label">{card.label}</p>
            <p className="summary-value">{card.value}</p>
            <p className="summary-helper">{card.helper}</p>
          </article>
        ))}
      </section>

      <section className="analytics-hero-grid">
        <article className="analytics-card hero-map-card" id="lgu-staff-heatmap-card">
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
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <HeatmapLayer points={filteredHeatmapPoints} />
            </MapContainer>
          </div>
        </article>

        <div className="analytics-side-stack">
          <article className="analytics-card compact-card" id="lgu-staff-feedback-card">
            <header>
              <h3>Feedback rating summary</h3>
              <p>1–5 star reviews for {municipalityLabel}.</p>
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

          <article className="analytics-card compact-card" id="lgu-staff-accreditation-card">
            <header>
              <h3>Accreditation status</h3>
              <p>Verification mix for local establishments.</p>
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
          <article className="analytics-card compact-card" id="lgu-staff-nationality-card">
            <header>
              <h3>Visitor nationalities</h3>
              <p>Top nationalities of visitors (unique tourists).</p>
            </header>
            {nationalities.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Tooltip />
                  <Legend />
                  <Pie
                    data={nationalities}
                    dataKey="count"
                    nameKey="nationality"
                    innerRadius={48}
                    outerRadius={80}
                    label
                  >
                    {nationalities.map((entry, index) => (
                      <Cell key={entry.nationality} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No nationality data yet.</p>
            )}
          </article>

        </div>
      </section>

      <section className="analytics-lower-grid">
        <article className="analytics-card span-2">
          <header>
            <h3>Monthly arrivals</h3>
            <p>Itineraries and tourists inside {municipalityLabel}.</p>
          </header>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="arrivalsAreaStaff" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4b7be5" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#4b7be5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="touristCount" stroke="#4b7be5" fill="url(#arrivalsAreaStaff)" />
              <Area type="monotone" dataKey="trips" stroke="#27ae60" fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>
        </article>

        <article className="analytics-card span-2">
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

        <article className="analytics-card span-4">
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

        <article className="analytics-card span-2">
          <header>
            <h3>Check-ins by source</h3>
            <p>Manual vs QR scans (last 30 days) for {municipalityLabel}.</p>
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
    </LguStaffLayout>
  );
}

export default LguStaffAnalytics;

