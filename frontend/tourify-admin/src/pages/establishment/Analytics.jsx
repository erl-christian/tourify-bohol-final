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
import { useParams } from 'react-router-dom';
import EstablishmentLayout from '../../components/EstablishmentLayout';
import '../../styles/AdminDashboard.css';
import useEstablishmentWorkspace from './useEstablishmentWorkspace';

const pieColors = ['#2f80ed', '#56ccf2', '#f2c94c', '#f2994a', '#eb5757'];

function EstablishmentAnalytics() {
  const { estId } = useParams();
  const {
    loading,
    error,
    analyticsError,
    establishment,
    analytics,
  } = useEstablishmentWorkspace(estId);

  return (
    <EstablishmentLayout
      title="Establishment Analytics"
      subtitle="Simple and focused analytics for this establishment."
    >
      {loading ? <p className="muted">Loading analytics...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {analyticsError ? <p className="muted">{analyticsError}</p> : null}

      {!loading && !error && establishment ? (
        <section className="account-management">
          <div className="section-heading">
            <h2>{establishment.name || 'Establishment'}</h2>
            <p>Ratings, feedback volume, visits, and sentiment breakdown.</p>
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
      ) : null}
    </EstablishmentLayout>
  );
}

export default EstablishmentAnalytics;
