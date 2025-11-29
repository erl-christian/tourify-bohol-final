import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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
import AdminLayout from '../../components/AdminLayout';
import '../../styles/AdminDashboard.css';
import {
  fetchProvinceTrends,
  fetchMunicipalityArrivals,
  fetchTopDestinations,
  fetchVisitorHeatmap,
  fetchFeedbackDistribution,
  fetchAccreditationSummary,
  fetchMovementAnalytics,
} from '../../services/analyticsApi';

const transformMunicipalitySeries = municipalities =>
  municipalities.map(item => {
    const summary = { manual: 0, qr: 0 };
    (item.records ?? []).forEach(record => {
      const source = (record.source || 'qr_scan').toLowerCase();
      if (source === 'manual') summary.manual += record.visits;
      else summary.qr += record.visits; // treat qr_scan/gps as QR bucket
    });
    return {
      municipality: item.municipality ?? item.municipality_id ?? 'Unknown',
      manual: summary.manual,
      qr: summary.qr,
      total: item.total ?? summary.manual + summary.qr,
    };
  });

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
    if (sourceIdx === targetIdx) return; // no self loops

    const forward = `${sourceIdx}->${targetIdx}`;
    const reverse = `${targetIdx}->${sourceIdx}`;

    if (seenEdges.has(reverse)) {
      // skip the reverse edge to avoid a two-node cycle that crashes recharts
      return;
    }

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

function HeatmapLayer({ points, radius = 20, blur = 25 }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !points.length) return;

    const layer = window.L.heatLayer(
      points.map(point => [point.lat, point.lng, point.weight ?? 1]),
      { radius, blur, maxZoom: 13, gradient: heatGradient },
    ).addTo(map);

    // Fit bounds to the points so the map zooms in on the hotspots
    const bounds = window.L.latLngBounds(points.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds.pad(0.2)); // pad so markers aren’t at the very edge

    return () => {
      layer.remove();
    };
  }, [map, points, radius, blur]);

  return null;
}


function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trend, setTrend] = useState([]);
  const [municipalityArrivals, setMunicipalityArrivals] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [heatmapPoints, setHeatmapPoints] = useState([]);
  const [feedbackBreakdown, setFeedbackBreakdown] = useState([]);
  const [accreditation, setAccreditation] = useState([]);
  const [flows, setFlows] = useState([]);

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
          ? `${topDestination.municipality_id ?? 'Province-wide'} • ${topDestination.checkIns ?? topDestination.rating_count ?? 0} visits`
          : 'No data yet',
        icon: <IoCompassOutline />,
      },
      {
        label: 'Top movement',
        value:
          topMovement?.from || topMovement?.to
            ? `${formatStop(topMovement?.from)} → ${formatStop(topMovement?.to)}`
            : '—',
        helper: topMovement ? `${topMovement.visits ?? 0} itineraries` : 'No sequences yet',
        icon: <IoGitCompare />,
      },
    ],
    [tourists30Days, trend, topDestination, topMovement],
  );

  const [exportRange, setExportRange] = useState({ from: '', to: '' });

  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

  const handleExport = async type => {
  const params = new URLSearchParams();
    if (exportRange.from) params.append('from', `${exportRange.from}-01`);
    if (exportRange.to) params.append('to', `${exportRange.to}-28`);

    const token = sessionStorage.getItem('accessToken');
    if (!token) {
      alert('You need to be logged in to export data.');
      return;
    }

    try {
      const response = await fetch(
        `${apiBase}/admin/analytics/export/${type}?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to generate file.');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = type === 'excel' ? 'bto-analytics.xlsx' : 'bto-analytics.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('[Export] failed', err);
      alert(err.message || 'Unable to export analytics right now.');
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
        ] = await Promise.all([
          fetchProvinceTrends().then(res => res.data?.arrivals ?? []),
          fetchMunicipalityArrivals({ limit: 12 }).then(res => res.data?.municipalities ?? []),
          fetchTopDestinations({ limit: 10 }).then(res => res.data?.topDestinations ?? []),
          fetchVisitorHeatmap().then(res => res.data?.points ?? []),
          fetchFeedbackDistribution().then(res => res.data?.ratings ?? []),
          fetchAccreditationSummary().then(res => res.data?.statuses ?? []),
          fetchMovementAnalytics({ limit: 8 }).then(res => res.data?.flows ?? []),
        ]);
        if (!mounted) return;
        setTrend(trendRes);
        setMunicipalityArrivals(municipalityRes);
        setDestinations(destinationRes);
        setHeatmapPoints(heatmapRes);
        setFeedbackBreakdown(feedbackRes);
        setAccreditation(accreditationRes);
        setFlows(flowsRes);
        setError('');
      } catch (err) {
        console.error('[AdminAnalytics] load failed', err);
        if (mounted) setError('Unable to load analytics right now.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const sankeyData = useMemo(() => buildSankeyData(flows), [flows]);


  return (
    <AdminLayout
      title="Advanced Provincial Reports"
      subtitle="Quick pulse on arrivals, sentiment, accreditation, and corridor flows."
    >
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
        {summaryCards.map(card => (
          <article key={card.label} className="summary-card summary-card--compact">
            <div className="summary-icon">{card.icon}</div>
            <p className="summary-label">{card.label}</p>
            <p className="summary-value">{card.value}</p>
            <p className="summary-helper">{card.helper}</p>
          </article>
        ))}
      </section>

      <section className="analytics-hero-grid">
        <article className="analytics-card hero-map-card" id="heatmap-card">
          <header>
            <div>
              <p className="hero-eyebrow">Visitor density</p>
              <h3>Average ratings by city</h3>
            </div>
            <span className="hero-chip">{heatmapPoints.length} hotspots</span>
          </header>
          <div className="map-shell">
            <MapContainer center={[9.85, 124.2]} zoom={9} scrollWheelZoom={true}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <HeatmapLayer points={heatmapPoints} />
            </MapContainer>
          </div>
        </article>

        <div className="analytics-side-stack">
          <article className="analytics-card compact-card">
            <header>
              <h3>Feedback rating summary</h3>
              <p>Distribution of 1–5 star reviews.</p>
            </header>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart id="province-arrivals-chart">
                <Tooltip />
                <Legend />
                <Pie
                  data={feedbackBreakdown}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={48}
                  outerRadius={80}
                  label
                />
              </PieChart>
            </ResponsiveContainer>
          </article>

          <article className="analytics-card compact-card">
            <header>
              <h3>Accreditation status</h3>
              <p>Current verification mix.</p>
            </header>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart id="province-arrivals-chart">
                <Tooltip />
                <Legend />
                <Pie data={accreditation} dataKey="count" nameKey="status" outerRadius={80} label />
              </PieChart>
            </ResponsiveContainer>
          </article>
        </div>
      </section>

      <section className="analytics-lower-grid">
        <article className="analytics-card span-2" id="province-arrivals-card">
          <header>
            <h3>Province-wide arrivals</h3>
            <p>Month-by-month tourist headcount.</p>
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

        <article className="analytics-card span-2" id="top-destinations-card">
          <header>
            <h3>Top destinations</h3>
            <p>Highest QR check-in activity.</p>
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
                      {item.municipality_id ?? 'Province-wide'} •{' '}
                      {(item.checkIns ?? item.rating_count ?? 0).toLocaleString()} visits
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="muted">No check-ins recorded yet.</p>
          )}
        </article>

        <article className="analytics-card span-4" id="sankey-card">
          <header>
            <h3>Travel pattern analytics</h3>
            <p>Most common next-stop sequences.</p>
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

        <article className="analytics-card span-2" id="municipal-arrivals-card">
          <header>
            <h3>Arrivals by municipality</h3>
            <p>Rolling 30-day totals, split by manual vs QR check-ins.</p>
          </header>

          {municipalityArrivals.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={transformMunicipalitySeries(municipalityArrivals)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="municipality" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="qr" stackId="a" fill="#4b7be5" name="QR scanned" />
                <Bar dataKey="manual" stackId="a" fill="#f2994a" name="Manual" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted">No arrivals recorded in the past 30 days.</p>
          )}
        </article>

      </section>
    </AdminLayout>
  );
}

export default AdminAnalytics;
