import { useEffect, useMemo, useState } from 'react';
import LguStaffLayout from '../../components/LguStaffLayout';
import '../../styles/AdminDashboard.css';
import {
  fetchLguEstablishments,
  fetchLguEstablishmentDetails,
} from '../../services/lguApi';
import { fetchEstablishmentMedia } from '../../services/establishmentApi';

const statusToneMap = {
  verified: 'success',
  approved: 'success',
  pending: 'warning',
  needs_review: 'review',
  rejected: 'danger',
};

const describeStatus = status => {
  if (!status) return 'Pending review';
  const normalized = status.toLowerCase();
  switch (normalized) {
    case 'approved':
    case 'verified':
      return 'Approved and endorsed';
    case 'rejected':
      return 'Returned for follow-up';
    case 'needs_review':
      return 'Needs additional info';
    default:
      return 'Pending LGU admin decision';
  }
};

const normalizeList = raw => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
};

const resolveTone = status => {
  if (!status) return 'neutral';
  const trimmed = status.trim();
  return (
    statusToneMap[trimmed] ||
    statusToneMap[trimmed.toLowerCase()] ||
    statusToneMap[trimmed.replace(/\s+/g, '_').toLowerCase()] ||
    'neutral'
  );
};

const formatDate = value => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

function Activities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailModal, setDetailModal] = useState({
    open: false,
    loading: false,
    establishment: null,
    media: [],
    error: '',
  });

  useEffect(() => {
    const loadActivities = async () => {
      try {
        setLoading(true);
        const { data } = await fetchLguEstablishments({ limit: 80 });
        setActivities(normalizeList(data));
        setError('');
      } catch (err) {
        console.error('Failed to load tourism activity log', err);
        setError('Unable to load tourism activities right now.');
      } finally {
        setLoading(false);
      }
    };

    loadActivities();
  }, []);

  const recentActivities = useMemo(
    () =>
      [...activities]
        .sort((a, b) => {
          const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bDate - aDate;
        })
        .slice(0, 25),
    [activities],
  );

  const closeDetailModal = () =>
    setDetailModal({
      open: false,
      loading: false,
      establishment: null,
      media: [],
      error: '',
    });

  const handleViewDetails = async estId => {
    if (!estId) return;
    setDetailModal(prev => ({ ...prev, open: true, loading: true, error: '', media: [] }));
    try {
      const [detailRes, mediaRes] = await Promise.all([
        fetchLguEstablishmentDetails(estId),
        fetchEstablishmentMedia(estId).catch(() => ({ data: [] })),
      ]);

      const establishment = detailRes.data?.establishment ?? detailRes.data ?? null;
      setDetailModal({
        open: true,
        loading: false,
        establishment,
        media: Array.isArray(mediaRes.data) ? mediaRes.data : [],
        error: '',
      });
    } catch (err) {
      console.error('Failed to load establishment details', err);
      setDetailModal({
        open: true,
        loading: false,
        establishment: null,
        media: [],
        error: 'Unable to load establishment details right now.',
      });
    }
  };

  return (
    <LguStaffLayout
      title="Tourism Activity Log"
      subtitle="Track establishment updates, decisions, and recent tourism submissions."
      searchPlaceholder="Search activities..."
    >
      <section className="account-management">
        <div className="section-heading">
          <h2>Recent Establishment Activity</h2>
          <p>
            This log highlights the latest actions from your municipality—approved,
            returned, and pending tourism submissions.
          </p>
        </div>

        <div className="table-shell">
          <div className="table-head table-grid">
            <span>Submission</span>
            <span>Status</span>
            <span>Notes</span>
            <span>Updated</span>
            <span>Action</span>
          </div>

          <ul className="table-body">
            {loading ? (
              <li className="table-row table-grid">
                <div className="muted">Loading activity…</div>
              </li>
            ) : error ? (
              <li className="table-row table-grid">
                <div className="muted">{error}</div>
              </li>
            ) : recentActivities.length === 0 ? (
              <li className="table-row table-grid">
                <div className="muted">No recorded tourism activity yet.</div>
              </li>
            ) : (
              recentActivities.map(item => {
                const id = item.businessEstablishment_id || item.id;
                return (
                  <li key={id} className="table-row table-grid">
                    <div className="account-cell">
                      <p className="account-name">{item.name || 'Unnamed submission'}</p>
                      <p className="account-email">ID: {id || '—'}</p>
                    </div>
                    <div>
                      <span className={`status-chip status-${resolveTone(item.status)}`}>
                        {item.status || 'pending'}
                      </span>
                    </div>
                    <div className="muted">
                      {item.latestAction || describeStatus(item.status)}
                    </div>
                    <div className="muted">
                      {formatDate(item.updatedAt || item.createdAt)}
                    </div>
                    <div>
                      <button
                        type="button"
                        className="ghost-cta"
                        onClick={() => handleViewDetails(id)}
                      >
                        View details
                      </button>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </section>

      {detailModal.open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3>{detailModal.establishment?.name ?? 'Establishment details'}</h3>
                <p className="muted">
                  ID: {detailModal.establishment?.businessEstablishment_id ?? '—'}
                </p>
              </div>
              <button type="button" className="ghost-btn" onClick={closeDetailModal}>
                Close
              </button>
            </header>

            {detailModal.loading ? (
              <p className="muted">Loading establishment…</p>
            ) : detailModal.error ? (
              <p className="error-text">{detailModal.error}</p>
            ) : (
              <>
                <section className="establishment-detail-grid">
                  <div>
                    <p className="muted">Category</p>
                    <p>{detailModal.establishment?.type ?? '—'}</p>
                  </div>
                  <div>
                    <p className="muted">Status</p>
                    <span
                      className={`status-chip status-${resolveTone(detailModal.establishment?.status)}`}
                    >
                      {detailModal.establishment?.status ?? 'pending'}
                    </span>
                  </div>
                  <div>
                    <p className="muted">Municipality</p>
                    <p>{detailModal.establishment?.municipality_id ?? '—'}</p>
                  </div>
                  <div>
                    <p className="muted">Last updated</p>
                    <p>{formatDate(detailModal.establishment?.updatedAt)}</p>
                  </div>
                </section>

                <section className="establishment-detail-info">
                  <div>
                    <p className="muted">Address</p>
                    <p>{detailModal.establishment?.address ?? '—'}</p>
                  </div>
                  <div>
                    <p className="muted">Contact</p>
                    <p>{detailModal.establishment?.contact_info ?? '—'}</p>
                  </div>
                  <div>
                    <p className="muted">Description</p>
                    <p>{detailModal.establishment?.description ?? 'No description provided.'}</p>
                  </div>
                </section>

                <section className="establishment-media-section">
                  <div className="section-heading compact">
                    <h4>Uploaded media</h4>
                    <p className="muted">
                      {detailModal.media.length
                        ? `${detailModal.media.length} file${
                            detailModal.media.length === 1 ? '' : 's'
                          }`
                        : 'No media uploaded yet.'}
                    </p>
                  </div>
                  {detailModal.media.length ? (
                    <div className="media-grid">
                      {detailModal.media.map(item => (
                        <figure key={item._id ?? item.url} className="media-grid-item">
                          {item.url?.match(/\.(mp4|mov|avi|mkv)$/i) ? (
                            <video src={item.url} controls />
                          ) : (
                            <img src={item.url} alt={item.caption ?? 'media upload'} />
                          )}
                          {item.caption ? <figcaption>{item.caption}</figcaption> : null}
                        </figure>
                      ))}
                    </div>
                  ) : null}
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </LguStaffLayout>
  );
}

export default Activities;
