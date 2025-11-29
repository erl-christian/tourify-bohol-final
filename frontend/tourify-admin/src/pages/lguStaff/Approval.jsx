import { useCallback, useEffect, useMemo, useState } from 'react';
import LguStaffLayout from '../../components/LguStaffLayout';
import '../../styles/AdminDashboard.css';
import {
  fetchLguPendingEstablishments,
  fetchLguEstablishmentDetails,
  endorseEstablishmentToAdmin,
} from '../../services/lguApi';

const normalizePending = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

function Approvals() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [detailModal, setDetailModal] = useState({
    open: false,
    loading: false,
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
    setDetailModal((prev) => ({ ...prev, open: true, loading: true }));
    try {
      const { data } = await fetchLguEstablishmentDetails(estId);
      setDetailModal({
        open: true,
        loading: false,
        establishment: data.establishment,
        owner: data.ownerProfile,
        media: data.establishmentMedia || [],
      });
    } catch (err) {
      console.error('Failed to load establishment details', err);
      setDetailModal({
        open: true,
        loading: false,
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
    setEndorseModal((prev) => ({ ...prev, submitting: true, feedback: '' }));
    try {
      await endorseEstablishmentToAdmin(endorseModal.estId, {
        notes: endorseModal.notes,
      });
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
                  <div>
                    <span className="role-chip role-muted">
                      {submission.type || submission.category || '—'}
                    </span>
                  </div>
                  <div className="muted">
                    {formatDate(submission.createdAt || submission.updatedAt)}
                  </div>
                  <div className="action-buttons">
                    <button
                      type="button"
                      className="ghost-cta"
                      onClick={() =>
                        openDetailModal(
                          submission.businessEstablishment_id || submission.id,
                        )
                      }
                    >
                      View details
                    </button>
                    <button
                      type="button"
                      className="primary-cta"
                      onClick={() =>
                        openEndorseModal(
                          submission.businessEstablishment_id || submission.id,
                        )
                      }
                      disabled={submission.status && submission.status !== 'pending'}
                    >
                      Endorse to admin
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
          <div className="modal-card wide">
            <header className="modal-header">
              <div>
                <h3>Owner submission</h3>
                <p>Review all details and media before endorsement.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={closeDetailModal}
              >
                ×
              </button>
            </header>

            {detailModal.loading ? (
              <div className="muted">Loading…</div>
            ) : !detailModal.establishment ? (
              <div className="muted">Unable to load submission details.</div>
            ) : (
              <div className="detail-grid">
                <div>
                  <h4>Establishment</h4>
                  <p><strong>Name:</strong> {detailModal.establishment.name}</p>
                  <p><strong>Category:</strong> {detailModal.establishment.type}</p>
                  <p><strong>Address:</strong> {detailModal.establishment.address || '—'}</p>
                  <p><strong>Status:</strong> {detailModal.establishment.status}</p>
                </div>
                <div>
                  <h4>Owner profile</h4>
                  <p><strong>Name:</strong> {detailModal.owner?.full_name || '—'}</p>
                  <p><strong>Contact:</strong> {detailModal.owner?.contact_no || '—'}</p>
                  <p><strong>Account ID:</strong> {detailModal.owner?.account_id || '—'}</p>
                </div>
                <div className="detail-full">
                  <h4>Description</h4>
                  <p>{detailModal.establishment.description || '—'}</p>
                </div>

                <div className="detail-full">
                  <h4>Media</h4>
                  {detailModal.media.length === 0 ? (
                    <div className="muted">No media uploaded.</div>
                  ) : (
                    <div className="media-grid">
                      {detailModal.media.map((media) => (
                        <div key={media.media_id} className="media-card">
                          {media.file_type === 'video' ? (
                            <video controls src={media.file_url} />
                          ) : (
                            <img
                              src={media.file_url}
                              alt={media.caption || media.media_id}
                            />
                          )}
                          {media.caption && (
                            <div className="media-caption">{media.caption}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
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
