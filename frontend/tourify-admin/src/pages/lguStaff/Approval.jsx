import { useCallback, useEffect, useMemo, useState } from 'react';
import LguStaffLayout from '../../components/LguStaffLayout';
import '../../styles/AdminDashboard.css';
import {
  fetchLguPendingEstablishments,
  fetchLguEstablishmentDetails,
  fetchLguEstablishmentMedia,
  endorseEstablishmentToAdmin,
} from '../../services/lguApi';

const normalizePending = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
};

const statusToneMap = {
  pending: 'warning',
  needs_admin_review: 'review', // add this
  approved: 'success',
  rejected: 'danger',
};

const resolveTone = (status) =>
  statusToneMap[status] || statusToneMap[status?.toLowerCase()] || 'neutral';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

function Approvals() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [endorsingId, setEndorsingId] = useState('');

  const [detailModal, setDetailModal] = useState({
    open: false,
    loading: false,
    error: '',
    establishment: null,
    owner: null,
    media: [],
  });

  const [endorseModal, setEndorseModal] = useState({
    open: false,
    estId: '',
    notes: '',
    submitting: false,
    feedback: '',
  });

  const loadPending = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await fetchLguPendingEstablishments({ limit: 50 });
      setItems(normalizePending(data));
      setError('');
    } catch (err) {
      console.error('Failed to load pending submissions', err);
      setError('Unable to load pending submissions right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const pendingItems = useMemo(() => items.slice(0, 20), [items]);

  const openDetailModal = async (estId) => {
    setDetailModal({ open: true, loading: true, error: '', establishment: null, owner: null, media: [] });
    try {
      const [detailRes, mediaRes] = await Promise.all([
        fetchLguEstablishmentDetails(estId),
        fetchLguEstablishmentMedia(estId),
      ]);

      const mediaPayload = mediaRes?.data;
      const mediaItems = Array.isArray(mediaPayload)
        ? mediaPayload
        : Array.isArray(mediaPayload?.items)
        ? mediaPayload.items
        : Array.isArray(mediaPayload?.media)
        ? mediaPayload.media
        : [];

      setDetailModal({
        open: true,
        loading: false,
        error: '',
        establishment: detailRes?.data?.establishment || detailRes?.data || null,
        owner: detailRes?.data?.ownerProfile || null,
        media: mediaItems,
      });
    } catch (err) {
      console.error('Failed to load establishment details', err);
      setDetailModal({
        open: true,
        loading: false,
        error: err.response?.data?.message || 'Unable to load submission details.',
        establishment: null,
        owner: null,
        media: [],
      });
    }
  };

  const closeDetailModal = () => {
    setDetailModal({
      open: false,
      loading: false,
      error: '',
      establishment: null,
      owner: null,
      media: [],
    });
  };

  const openEndorseModal = (estId) => {
    setEndorseModal({
      open: true,
      estId,
      notes: '',
      submitting: false,
      feedback: '',
    });
  };

  const closeEndorseModal = () => {
    setEndorseModal({
      open: false,
      estId: '',
      notes: '',
      submitting: false,
      feedback: '',
    });
  };

  const handleEndorse = async () => {
    if (!endorseModal.estId) return;
    setEndorsingId(endorseModal.estId);
    setEndorseModal((prev) => ({ ...prev, submitting: true, feedback: '' }));
    try {
      await endorseEstablishmentToAdmin(endorseModal.estId, { notes: endorseModal.notes });
      // mark locally so the button disables immediately
      setItems((prev) =>
        prev.map((item) =>
          (item.businessEstablishment_id || item.id) === endorseModal.estId
            ? { ...item, status: 'needs_admin_review' }
            : item
        )
      );
      setEndorseModal((prev) => ({
        ...prev,
        submitting: false,
        feedback: 'Submission endorsed to LGU admin.',
      }));
      closeEndorseModal();
      await loadPending();
    } catch (err) {
      setEndorseModal((prev) => ({
        ...prev,
        submitting: false,
        feedback:
          err.response?.data?.message ||
          err.message ||
          'Unable to endorse this submission right now.',
      }));
    } finally {
      setEndorsingId('');
    }
  };


  return (
    <LguStaffLayout
      title="Validate Submissions"
      subtitle="Review establishment updates and tourism content before endorsing to the LGU admin."
      searchPlaceholder="Search submissions..."
    >
      <section className="account-management">
        <div className="section-heading">
          <h2>Pending Items</h2>
          <p>Review details, add comments, and mark as endorsed once verified.</p>
        </div>

        <div className="table-shell">
          <div className="table-head table-grid">
            <span>Submission</span>
            <span>Submitted By</span>
            <span>Type</span>
            <span>Received</span>
            <span>Action</span>
          </div>

          <ul className="table-body">
            {loading ? (
              <li className="table-row table-grid">
                <div className="muted">Loading pending items…</div>
              </li>
            ) : error ? (
              <li className="table-row table-grid">
                <div className="muted">{error}</div>
              </li>
            ) : pendingItems.length === 0 ? (
              <li className="table-row table-grid">
                <div className="muted">No pending submissions right now.</div>
              </li>
            ) : (
              pendingItems.map((submission) => (
                <li
                  key={submission.businessEstablishment_id || submission.id}
                  className="table-row table-grid"
                >
                  <div className="account-cell">
                    <p className="account-name">
                      {submission.name || 'Unnamed submission'}
                    </p>
                    <p className="account-email">
                      ID: {submission.businessEstablishment_id || submission.id || '—'}
                    </p>
                  </div>
                  <div className="muted">
                    {submission.submittedBy ||
                      submission.ownerName ||
                      submission.owner_email ||
                      '—'}
                  </div>
                  <div className="status-stack column">
                    <span className={`status-chip status-${resolveTone(submission.status)}`}>
                      {submission.status || 'pending'}
                    </span>
                    {submission.status === 'needs_admin_review' && (
                      <span className="tag tag-success">Sent to LGU admin</span>
                    )}
                  </div>
                  <div className="muted">
                    {formatDate(submission.createdAt || submission.updatedAt)}
                  </div>
                  <div className="table-actions">
                    <button
                      type="button"
                      className="table-action-button"
                      onClick={() =>
                        openDetailModal(
                          submission.businessEstablishment_id || submission.id,
                        )
                      }
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="primary-cta"
                      onClick={() => openEndorseModal(submission.businessEstablishment_id || submission.id)}
                      disabled={
                        endorsingId === (submission.businessEstablishment_id || submission.id) ||
                        (submission.status && submission.status !== 'pending')
                      }
                    >
                      {endorsingId === (submission.businessEstablishment_id || submission.id)
                        ? 'Endorsing…'
                        : 'Endorse to admin'}
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
                <div className="muted">Loading…</div>
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
                    <p className="detail-value strong">
                      {detailModal.establishment?.name || '—'}
                    </p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">ID</p>
                    <p className="detail-value mono">
                      {detailModal.establishment?.businessEstablishment_id ||
                        detailModal.establishment?.id ||
                        '—'}
                    </p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Municipality</p>
                    <p className="detail-value">
                      {detailModal.establishment?.municipality_id ||
                        detailModal.establishment?.municipality ||
                        '—'}
                    </p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Category</p>
                    <p className="detail-value">
                      {detailModal.establishment?.type ||
                        detailModal.establishment?.category ||
                        '—'}
                    </p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Status</p>
                    <p className="detail-value chip">
                      {detailModal.establishment?.status || '—'}
                    </p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Last Updated</p>
                    <p className="detail-value">
                      {detailModal.establishment?.updatedAt
                        ? new Date(detailModal.establishment.updatedAt).toLocaleString()
                        : '—'}
                    </p>
                  </div>
                </div>

                <div className="detail-block">
                  <p className="detail-label">Address</p>
                  <p className="detail-value">
                    {detailModal.establishment?.address || '—'}
                  </p>
                </div>
                <div className="detail-block">
                  <p className="detail-label">Description</p>
                  <p className="detail-value">
                    {detailModal.establishment?.description || '—'}
                  </p>
                </div>

                <div className="detail-block">
                  <p className="detail-label">Owner</p>
                  <p className="detail-value">
                    {detailModal.owner?.full_name || '—'} ·{' '}
                    {detailModal.owner?.contact_no || '—'}
                  </p>
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

      {endorseModal.open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3>Endorse submission</h3>
                <p>Confirm endorsement and optionally leave notes for the LGU admin.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={closeEndorseModal}
              >
                ×
              </button>
            </header>

            <form
              className="modal-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleEndorse();
              }}
            >
              <div className="form-row full">
                <label className="form-label" htmlFor="endorse-notes">
                  Notes for admin (optional)
                </label>
                <textarea
                  id="endorse-notes"
                  rows={3}
                  placeholder="Add verification notes or remarks for the admin."
                  value={endorseModal.notes}
                  onChange={(event) =>
                    setEndorseModal((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
              </div>

              {endorseModal.feedback && (
                <div className="muted full" role="status">
                  {endorseModal.feedback}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="ghost-cta"
                  onClick={closeEndorseModal}
                  disabled={endorseModal.submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-cta"
                  disabled={endorseModal.submitting}
                >
                  {endorseModal.submitting ? 'Endorsing…' : 'Endorse submission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </LguStaffLayout>
  );
}

export default Approvals;
