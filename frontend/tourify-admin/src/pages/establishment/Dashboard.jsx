import { Link, useParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import EstablishmentLayout from '../../components/EstablishmentLayout';
import '../../styles/AdminDashboard.css';
import useEstablishmentWorkspace, { resolveQrLink } from './useEstablishmentWorkspace';

const pieColors = ['#2f80ed', '#56ccf2', '#f2c94c', '#f2994a', '#eb5757'];

function EstablishmentDashboard() {
  const { estId } = useParams();
  const {
    loading,
    error,
    message,
    analyticsError,
    establishment,
    analytics,
    stats,
    refreshQr,
  } = useEstablishmentWorkspace(estId);

  return (
    <EstablishmentLayout
      title={establishment?.name || 'Establishment Dashboard'}
      subtitle="Clean snapshot of establishment performance and operations."
    >
      {loading ? <p className="muted">Loading dashboard...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="muted">{message}</p> : null}
      {analyticsError ? <p className="muted">{analyticsError}</p> : null}

      {!loading && !error && establishment ? (
        <>
          <section className="account-management">
            <div className="section-heading">
              <h2>Overview</h2>
              <p>All figures here are only for this establishment.</p>
            </div>
            <div className="stat-summary">
              <article className="stat-card">
                <div className="stat-details">
                  <p className="stat-label">Average Rating</p>
                  <p className="stat-value">{stats.latestRating}</p>
                  <p className="stat-trend trend-success">Current trend value</p>
                </div>
              </article>
              <article className="stat-card">
                <div className="stat-details">
                  <p className="stat-label">Total Reviews</p>
                  <p className="stat-value">{stats.totalReviews}</p>
                  <p className="stat-trend trend-success">Tourist submitted feedback</p>
                </div>
              </article>
              <article className="stat-card">
                <div className="stat-details">
                  <p className="stat-label">Check-ins</p>
                  <p className="stat-value">{stats.totalVisits}</p>
                  <p className="stat-trend trend-success">QR and manual visits</p>
                </div>
              </article>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-cta" onClick={refreshQr}>
                Refresh QR
              </button>
              {establishment.qr_code ? (
                <a
                  className="primary-cta"
                  href={resolveQrLink(establishment.qr_code)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open QR
                </a>
              ) : null}
              <Link className="ghost-cta" to={`/establishment/${estId}/feedback`}>
                Open Feedback
              </Link>
            </div>
          </section>

          <section className="account-management">
            <div className="section-heading">
              <h2>Analytics</h2>
              <p>Ratings, feedback volume, visits, and sentiment breakdown for this establishment.</p>
            </div>

            <div className="analytics-lower-grid owner-analytics-grid">
              <article className="analytics-card span-2">
                <header>
                  <h3>Rating Trend</h3>
                  <p>Monthly average star rating.</p>
                </header>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={analytics.ratingTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis domain={[0, 5]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="rating" stroke="#f2994a" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </article>

              <article className="analytics-card span-2">
                <header>
                  <h3>Review Count</h3>
                  <p>Number of reviews each month.</p>
                </header>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={analytics.reviewCounts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="reviews" fill="#56ccf2" />
                  </BarChart>
                </ResponsiveContainer>
              </article>

              <article className="analytics-card span-4">
                <header>
                  <h3>Visitor Check-ins</h3>
                  <p>QR and manual arrivals.</p>
                </header>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics.checkins}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="qr" stackId="a" fill="#2f80ed" name="QR" />
                    <Bar dataKey="manual" stackId="a" fill="#f2c94c" name="Manual" />
                  </BarChart>
                </ResponsiveContainer>
              </article>
            </div>

            <div className="analytics-lower-grid owner-analytics-grid">
              <article className="analytics-card span-2">
                <header>
                  <h3>Rating Breakdown</h3>
                  <p>Distribution of star scores.</p>
                </header>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={analytics.categories} dataKey="value" nameKey="name" outerRadius={90} label>
                      {analytics.categories.map((item, index) => (
                        <Cell key={`${item.name}-${index}`} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </article>
            </div>
          </section>
        </>
      ) : null}
    </EstablishmentLayout>
  );
}

export default EstablishmentDashboard;
