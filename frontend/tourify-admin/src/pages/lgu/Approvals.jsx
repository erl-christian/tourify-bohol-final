import { useEffect, useMemo, useState, useCallback } from 'react';
import LguLayout from '../../components/LguLayout';
import '../../styles/AdminDashboard.css';
import {
  fetchLguPendingEstablishments,
  actOnEstablishment,
  fetchLguEstablishmentDetails,
  fetchLguEstablishmentMedia,
} from '../../services/lguApi';

const statusToneMap = {
  pending: 'warning',
  needs_admin_review: 'review',
  approved: 'success',
  rejected: 'danger',
};

function Approvals() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [detailModal, setDetailModal] = useState({
    open: false,
    loading: false,
    error: '',
    data: null,
    media: [],
  });

  const loadPending = async () => {
    try {
      setLoading(true);
      const { data } = await fetchLguPendingEstablishments();
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setPending(items);
      setError('');
    } catch (err) {
      console.error('Failed to load approvals', err);
      setError('Unable to load pending approvals right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const rows = useMemo(() => pending, [pending]);
  const resolveTone = (status) =>
    statusToneMap[status] || statusToneMap[status?.toLowerCase()] || 'neutral';

  const handleAction = async (establishmentId, action) => {
    setSubmitting(true);
    try {
      await actOnEstablishment(establishmentId, { action });
      await loadPending();
    } catch (err) {
      console.error('Failed to update establishment', err);
    } finally {
      setSubmitting(false);
    }
  };

  const openDetailModal = useCallback(async (est) => {
    const estId = est.businessEstablishment_id || est.id;
    if (!estId) return;
    setDetailModal({ open: true, loading: true, error: '', data: null, media: [] });
    try {
      const [detailRes, mediaRes] = await Promise.all([
        fetchLguEstablishmentDetails(estId),
        fetchLguEstablishmentMedia(estId),
      ]);
      const mediaItems = Array.isArray(mediaRes?.data) ? mediaRes.data : mediaRes?.data?.items || [];
      setDetailModal({
        open: true,
        loading: false,
        error: '',
        data: detailRes?.data?.establishment || detailRes?.data || null,
        media: mediaItems,
      });
    } catch (err) {
      setDetailModal({
        open: true,
        loading: false,
        error: err.response?.data?.message || 'Unable to load establishment details.',
        data: null,
        media: [],
      });
    }
  }, []);

  const closeDetailModal = () =>
    setDetailModal({ open: false, loading: false, error: '', data: null, media: [] });

  return (
    <LguLayout
      title="Approval Queue"
      subtitle="Approve or return submissions from municipal staff and owners."
      searchPlaceholder="Search submissions..."
      onSearchSubmit={(value) => console.log('search', value)}
    >
      <section className="account-management">
        <div className="section-heading">
          <h2>Pending Approvals</h2>
          <p>Review submissions awaiting LGU action.</p>
        </div>

        <div className="table-shell">
          <div className="table-head table-grid">
            <span>Submission</span>
            <span>Submitted By</span>
            <span>Status</span>
            <span>Submitted</span>
            <span>Actions</span>
          </div>

          <ul className="table-body">
            {loading ? (
              <li className="table-row table-grid">
                <div className="muted">Loading approvals…</div>
              </li>
            ) : error ? (
              <li className="table-row table-grid">
                <div className="muted">{error}</div>
              </li>
            ) : rows.length === 0 ? (
              <li className="table-row table-grid">
                <div className="muted">No pending submissions.</div>
              </li>
            ) : (
              rows.map((item) => (
                <li key={item.businessEstablishment_id} className="table-row table-grid">
                  <div className="account-cell">
                    <p className="account-name">{item.name}</p>
                    <p className="account-email">ID: {item.businessEstablishment_id}</p>
                  </div>
                  <div className="muted">{item.submittedBy || '—'}</div>
                  <div>
                    <span className={`status-chip status-${resolveTone(item.status)}`}>
                      {item.status || 'pending'}
                    </span>
                  </div>
                  <div className="muted">
                    {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '—'}
                  </div>
                  <div className="table-actions">
                    <button
                      type="button"
                      className="table-action-button"
                      onClick={() => openDetailModal(item)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="primary-cta"
                      disabled={submitting}
                      onClick={() => handleAction(item.businessEstablishment_id, 'approve')}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="ghost-cta"
                      disabled={submitting}
                      onClick={() => handleAction(item.businessEstablishment_id, 'return')}
                    >
                      Return
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      {detailModal.open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3>Establishment Details</h3>
                <p>Review submission details and media.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={closeDetailModal}
                disabled={detailModal.loading}
              >
                ×
              </button>
            </header>

            {detailModal.loading ? (
              <div className="modal-content">
                <div className="muted">Loading details…</div>
              </div>
            ) : detailModal.error ? (
              <div className="modal-content">
                <div className="modal-error">{detailModal.error}</div>
              </div>
            ) : (
              <div className="modal-content">
                <div className="detail-grid">
                  <div className="detail-pair">
                    <p className="detail-label">Name</p>
                    <p className="detail-value strong">{detailModal.data?.name || '—'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">ID</p>
                    <p className="detail-value mono">
                      {detailModal.data?.businessEstablishment_id || detailModal.data?.id || '—'}
                    </p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Municipality</p>
                    <p className="detail-value">
                      {detailModal.data?.municipality_id || detailModal.data?.municipality || '—'}
                    </p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Category</p>
                    <p className="detail-value">
                      {detailModal.data?.type || detailModal.data?.category || '—'}
                    </p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Status</p>
                    <p className="detail-value chip">{detailModal.data?.status || '—'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Last Updated</p>
                    <p className="detail-value">
                      {detailModal.data?.updatedAt
                        ? new Date(detailModal.data.updatedAt).toLocaleString()
                        : '—'}
                    </p>
                  </div>
                </div>

                <div className="detail-block">
                  <p className="detail-label">Address</p>
                  <p className="detail-value">{detailModal.data?.address || '—'}</p>
                </div>
                <div className="detail-block">
                  <p className="detail-label">Description</p>
                  <p className="detail-value">{detailModal.data?.description || '—'}</p>
                </div>

                <div className="detail-block">
                  <p className="detail-label">Media</p>
                  {detailModal.media?.length ? (
                    <div className="media-grid">
                      {detailModal.media.map((m) => (
                        <a
                          key={m.media_id || m.id}
                          className="media-thumb"
                          href={m.file_url}
                          target="_blank"
                          rel="noreferrer"
                          title={m.caption || m.file_url}
                        >
                          {m.file_type?.startsWith('image') ? (
                            <img src={m.file_url} alt={m.caption || 'Media'} />
                          ) : (
                            <span className="media-file">{m.file_type || 'file'}</span>
                          )}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No media attached.</p>
                  )}
                </div>

                <div className="modal-actions">
                  <button type="button" className="primary-cta" onClick={closeDetailModal}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </LguLayout>
  );
}

export default Approvals;
