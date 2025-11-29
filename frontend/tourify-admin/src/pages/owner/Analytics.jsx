import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import OwnerLayout from '../../components/OwnerLayout';
import '../../styles/AdminDashboard.css';
import { fetchOwnerEstablishments } from '../../services/establishmentApi';
import {
  fetchOwnerRatingTrend,
  fetchOwnerReviewCounts,
  fetchOwnerCheckins,
  fetchOwnerFeedbackCategories,
  fetchOwnerTagPerformance,
} from '../../services/ownerAnalyticsApi';

const pieColors = ['#2f80ed', '#56ccf2', '#f2c94c', '#f2994a', '#eb5757'];

function OwnerAnalytics() {
  const [establishments, setEstablishments] = useState([]);
  const [selectedEst, setSelectedEst] = useState('all');
  const [state, setState] = useState({
    loading: true,
    error: '',
    analytics: [],
  });

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: '' }));
        const { data } = await fetchOwnerEstablishments();
        const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        if (!list.length) throw new Error('No establishments found for this account.');

        setEstablishments(list);
        const analytics = await Promise.all(
          list.map(async est => {
            const id = est.businessEstablishment_id ?? est.id ?? '';
            try {
              const [trend, reviews, checkins, categories, tags] = await Promise.all([
                fetchOwnerRatingTrend(id),
                fetchOwnerReviewCounts(id),
                fetchOwnerCheckins(id),
                fetchOwnerFeedbackCategories(id),
                fetchOwnerTagPerformance(id),
              ]);
              return {
                id,
                name: est.name ?? est.establishment_name ?? 'Establishment',
                ratingTrend: trend.data?.trend ?? [],
                reviewCounts: reviews.data?.monthly ?? [],
                checkins: checkins.data?.monthly ?? [],
                categories: categories.data?.categories ?? [],
                tags: tags.data?.tags ?? [],
              };
            } catch (err) {
              console.error('[OwnerAnalytics] failed for', id, err);
              return null;
            }
          }),
        );

        const filtered = analytics.filter(Boolean);
        const aggregateEntry = aggregateAnalytics(filtered);

        setState({
          loading: false,
          error: '',
          analytics: aggregateEntry ? [aggregateEntry, ...filtered] : filtered,
        });
      } catch (err) {
        console.error('[OwnerAnalytics] load failed', err);
        setState({
          loading: false,
          error: err.message || 'Unable to load performance analytics.',
          analytics: [],
        });
      }
    };

    loadAnalytics();
  }, []);

  const visibleEntries = useMemo(() => {
    if (selectedEst === 'all') {
      const aggregateEntry = state.analytics.find(entry => entry.id === 'all');
      return aggregateEntry ? [aggregateEntry] : [];
    }
    return state.analytics.filter(entry => entry.id === selectedEst);
  }, [selectedEst, state.analytics]);

  return (
    <OwnerLayout
      title="Performance analytics"
      subtitle="Monitor star ratings, review volume, visitor check-ins, and tag insights per establishment."
    >
      {state.error ? <p className="error-text">{state.error}</p> : null}
      {state.loading ? <p className="muted">Loading analytics…</p> : null}

      {!state.loading && !state.error ? (
        <>
          <div className="analytics-filter-bar">
            <label>
              Establishment
              <select value={selectedEst} onChange={event => setSelectedEst(event.target.value)}>
                <option value="all">All establishments (total)</option>
                {establishments.map(est => {
                  const id = est.businessEstablishment_id ?? est.id ?? '';
                  return (
                    <option key={id} value={id}>
                      {est.name ?? est.establishment_name ?? id}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          {visibleEntries.length === 0 ? (
            <p className="muted">No analytics available.</p>
          ) : (
            visibleEntries.map(entry => (
              <section key={entry.id} className="owner-analytics-section">
                <header className="section-heading">
                  <h2>{entry.name}</h2>
                  <p>ID: {entry.id}</p>
                </header>

                <div className="analytics-lower-grid owner-analytics-grid">
                  <article className="analytics-card span-2">
                    <header>
                      <h3>Star Rating Trend</h3>
                      <p>Average rating per month.</p>
                    </header>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={entry.ratingTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis domain={[3.5, 5]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="rating" stroke="#f2994a" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  </article>

                  <article className="analytics-card span-2">
                    <header>
                      <h3>Number of Reviews</h3>
                      <p>Monthly review count.</p>
                    </header>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={entry.reviewCounts}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="reviews" fill="#56ccf2" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </article>

                  <article className="analytics-card span-4">
                    <header>
                      <h3>Visitor Check-ins</h3>
                      <p>QR scans vs. manual captures per month.</p>
                    </header>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={entry.checkins}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="qr" stackId="a" fill="#2f80ed" name="QR scanned" />
                        <Bar dataKey="manual" stackId="a" fill="#f2c94c" name="Manual" />
                      </BarChart>
                    </ResponsiveContainer>
                  </article>
                </div>

                <div className="analytics-lower-grid owner-analytics-grid">
                  <article className="analytics-card span-2">
                    <header>
                      <h3>Feedback Category Breakdown</h3>
                      <p>Share of reviews per star rating.</p>
                    </header>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={entry.categories}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={60}
                          outerRadius={90}
                          label
                        >
                          {entry.categories.map((item, index) => (
                            <Cell key={`${item.name}-${index}`} fill={pieColors[index % pieColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </article>

                  <article className="analytics-card span-2">
                    <header>
                      <h3>Top Tags</h3>
                      <p>Most-used establishment tags ranked by visitor check-ins.</p>
                    </header>

                    {entry.tags.length ? (
                      <ol className="owner-tag-list">
                        {entry.tags.map(tag => (
                          <li key={tag.tag}>
                            <strong>{tag.tag}</strong> • {tag.visits} visits
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="muted">No tags recorded for this establishment.</p>
                    )}
                  </article>
                </div>
              </section>
            ))
          )}
        </>
      ) : null}
    </OwnerLayout>
  );
}

function aggregateAnalytics(entries) {
  if (!entries.length) return null;

  const mergeSeries = key => {
    const map = new Map();
    entries.forEach(item =>
      item[key].forEach(point => {
        const existing = map.get(point.month) ?? { month: point.month };
        Object.keys(point).forEach(k => {
          if (k === 'month') return;
          existing[k] = (existing[k] ?? 0) + point[k];
        });
        map.set(point.month, existing);
      }),
    );
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  };

  const aggregateCategories = () => {
    const map = new Map();
    entries.forEach(item =>
      item.categories.forEach(cat => {
        map.set(cat.name, (map.get(cat.name) ?? 0) + cat.value);
      }),
    );
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  };

  const aggregateTags = () => {
    const map = new Map();
    entries.forEach(item =>
      item.tags.forEach(tag => {
        map.set(tag.tag, (map.get(tag.tag) ?? 0) + tag.visits);
      }),
    );
    return Array.from(map.entries())
      .map(([tag, visits]) => ({ tag, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 5);
  };

  const mergedRating = mergeSeries('ratingTrend').map(point => ({
    month: point.month,
    rating: entries.length ? point.rating / entries.length : 0,
  }));

  return {
    id: 'all',
    name: 'All establishments (total)',
    ratingTrend: mergedRating,
    reviewCounts: mergeSeries('reviewCounts'),
    checkins: mergeSeries('checkins'),
    categories: aggregateCategories(),
    tags: aggregateTags(),
  };
}

export default OwnerAnalytics;
