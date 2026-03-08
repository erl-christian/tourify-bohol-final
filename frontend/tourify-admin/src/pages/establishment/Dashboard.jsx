import { Link, useParams } from 'react-router-dom';
import EstablishmentLayout from '../../components/EstablishmentLayout';
import '../../styles/AdminDashboard.css';
import useEstablishmentWorkspace, { resolveQrLink } from './useEstablishmentWorkspace';

function EstablishmentDashboard() {
  const { estId } = useParams();
  const {
    loading,
    error,
    message,
    analyticsError,
    establishment,
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
              <Link className="ghost-cta" to={`/establishment/${estId}/analytics`}>
                Open Analytics
              </Link>
              <Link className="ghost-cta" to={`/establishment/${estId}/feedback`}>
                Open Feedback
              </Link>
            </div>
          </section>
        </>
      ) : null}
    </EstablishmentLayout>
  );
}

export default EstablishmentDashboard;
