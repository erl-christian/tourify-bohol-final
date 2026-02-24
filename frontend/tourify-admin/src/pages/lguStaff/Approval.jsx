import { useCallback, useEffect, useMemo, useState } from 'react';
import LguStaffLayout from '../../components/LguStaffLayout';
import '../../styles/AdminDashboard.css';
import {
  fetchLguPendingEstablishments,
  fetchLguEstablishmentDetails,
  fetchLguEstablishmentMedia,
  actOnEstablishment,
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

function Approvals() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // const [endorsingId, setEndorsingId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [detailModal, setDetailModal] = useState({
    open: false,
    loading: false,
    error: '',
    establishment: null,
    ownerProfile: null,
    spotMedia: [],
    requirementDocs: [],
    latestApproval: null,
    latestApprovalActor: null,
  });

  // const [endorseModal, setEndorseModal] = useState({
  //   open: false,
  //   estId: '',
  //   notes: '',
  //   submitting: false,
  //   feedback: '',
  // });

  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
  };

  const toMediaList = (payload) =>
  Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.media)
    ? payload.media
    : Array.isArray(payload?.items)
    ? payload.items
    : [];

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
    setDetailModal({
      open: true,
      loading: true,
      error: '',
      establishment: null,
      ownerProfile: null,
      spotMedia: [],
      requirementDocs: [],
      latestApproval: null,
      latestApprovalActor: null,
    });

    try {
      const [detailRes, spotRes, docsRes] = await Promise.all([
        fetchLguEstablishmentDetails(estId),
        fetchLguEstablishmentMedia(estId, 'spot_gallery'),
        fetchLguEstablishmentMedia(estId, 'submission_requirement'),
      ]);

      const detailPayload = detailRes?.data ?? {};

      setDetailModal({
        open: true,
        loading: false,
        error: '',
        establishment: detailPayload.establishment || detailPayload || null,
        ownerProfile: detailPayload.ownerProfile || null,
        spotMedia: toMediaList(spotRes?.data),
        requirementDocs: toMediaList(docsRes?.data),
        latestApproval: detailPayload.latestApproval || null,
        latestApprovalActor: detailPayload.latestApprovalActor || null,
      });
    } catch (err) {
      setDetailModal({
        open: true,
        loading: false,
        error: err.response?.data?.message || 'Unable to load submission details.',
        establishment: null,
        ownerProfile: null,
        spotMedia: [],
        requirementDocs: [],
        latestApproval: null,
        latestApprovalActor: null,
      });
    }
  };

  const closeDetailModal = () => {
    setDetailModal({
      open: false,
      loading: false,
      error: '',
      establishment: null,
      ownerProfile: null,
      spotMedia: [],
      requirementDocs: [],
      latestApproval: null,
      latestApprovalActor: null,
    });
  };

  // const openEndorseModal = (estId) => {
  //   setEndorseModal({
  //     open: true,
  //     estId,
  //     notes: '',
  //     submitting: false,
  //     feedback: '',
  //   });
  // };

  // const closeEndorseModal = () => {
  //   setEndorseModal({
  //     open: false,
  //     estId: '',
  //     notes: '',
  //     submitting: false,
  //     feedback: '',
  //   });
  // };

  // const handleEndorse = async () => {
  //   if (!endorseModal.estId) return;
  //   setEndorsingId(endorseModal.estId);
  //   setEndorseModal((prev) => ({ ...prev, submitting: true, feedback: '' }));
  //   try {
  //     await endorseEstablishmentToAdmin(endorseModal.estId, { notes: endorseModal.notes });
  //     // mark locally so the button disables immediately
  //     setItems((prev) =>
  //       prev.map((item) =>
  //         (item.businessEstablishment_id || item.id) === endorseModal.estId
  //           ? { ...item, status: 'needs_admin_review' }
  //           : item
  //       )
  //     );
  //     setEndorseModal((prev) => ({
  //       ...prev,
  //       submitting: false,
  //       feedback: 'Submission endorsed to LGU admin.',
  //     }));
  //     closeEndorseModal();
  //     await loadPending();
  //   } catch (err) {
  //     setEndorseModal((prev) => ({
  //       ...prev,
  //       submitting: false,
  //       feedback:
  //         err.response?.data?.message ||
  //         err.message ||
  //         'Unable to endorse this submission right now.',
  //     }));
  //   } finally {
  //     setEndorsingId('');
  //   }
  // };


  return (
    <LguStaffLayout
        title="Validate Submissions"
        subtitle="Review establishment submissions and approve or return them directly."
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
            <span>Submitted / Updated</span>
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
                    {/* {submission.status === 'needs_admin_review' && (
                      <span className="tag tag-success">Sent to LGU admin</span>
                    )} */}
                  </div>
                  <div className="muted">
                    <div>Submitted: {formatDateTime(submission.createdAt)}</div>
                    <div>Updated: {formatDateTime(submission.updatedAt)}</div>
                  </div>
                  <div className="table-actions">
                    <button
                      type="button"
                      className="table-action-button"
                      onClick={() => openDetailModal(submission.businessEstablishment_id || submission.id)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="primary-cta"
                      disabled={submitting}
                      onClick={() => handleAction(submission.businessEstablishment_id || submission.id, 'approve')}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="ghost-cta"
                      disabled={submitting}
                      onClick={() => handleAction(submission.businessEstablishment_id || submission.id, 'return')}
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
                    <p className="detail-value strong">{detailModal.establishment ?.name || '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Establishment ID</p>
                    <p className="detail-value mono">
                      {detailModal.establishment ?.businessEstablishment_id || detailModal.establishment ?.id || '-'}
                    </p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Municipality ID</p>
                    <p className="detail-value">{detailModal.establishment ?.municipality_id || '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Category</p>
                    <p className="detail-value">{detailModal.establishment ?.type || detailModal.establishment ?.category || '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Ownership Type</p>
                    <p className="detail-value">{detailModal.establishment ?.ownership_type || '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Status</p>
                    <p className="detail-value chip">{detailModal.establishment ?.status || '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Contact Info</p>
                    <p className="detail-value">{detailModal.establishment ?.contact_info || '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Accreditation No.</p>
                    <p className="detail-value">{detailModal.establishment ?.accreditation_no || '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Budget Min</p>
                    <p className="detail-value">{detailModal.establishment ?.budget_min ?? '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Budget Max</p>
                    <p className="detail-value">{detailModal.establishment ?.budget_max ?? '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Latitude</p>
                    <p className="detail-value">{detailModal.establishment ?.latitude ?? '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Longitude</p>
                    <p className="detail-value">{detailModal.establishment ?.longitude ?? '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Created</p>
                    <p className="detail-value">{formatDateTime(detailModal.establishment ?.createdAt)}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Updated</p>
                    <p className="detail-value">{formatDateTime(detailModal.establishment ?.updatedAt)}</p>
                  </div>
                </div>

                <div className="detail-block">
                  <p className="detail-label">Address</p>
                  <p className="detail-value">{detailModal.establishment ?.address || '-'}</p>
                </div>

                <div className="detail-block">
                  <p className="detail-label">Description</p>
                  <p className="detail-value">{detailModal.establishment ?.description || '-'}</p>
                </div>

                <div className="detail-block">
                  <p className="detail-label">Owner Profile</p>
                  <p className="detail-value">Name: {detailModal.ownerProfile?.full_name || '-'}</p>
                  <p className="detail-value">Contact No: {detailModal.ownerProfile?.contact_no || '-'}</p>
                  <p className="detail-value">Owner Account ID: {detailModal.ownerProfile?.account_id || '-'}</p>
                  <p className="detail-value">Role: {detailModal.ownerProfile?.role || '-'}</p>
                </div>

                <div className="detail-block">
                  <p className="detail-label">Latest Decision</p>
                  <p className="detail-value">{detailModal.latestApproval?.approval_status || 'No decision yet'}</p>
                  <p className="detail-value">
                    By: {detailModal.latestApprovalActor?.full_name || '-'} ({detailModal.latestApprovalActor?.position || '-'})
                  </p>
                  <p className="detail-value">Action: {detailModal.latestApproval?.action || '-'}</p>
                  <p className="detail-value">Date: {formatDateTime(detailModal.latestApproval?.action_date)}</p>
                  <p className="detail-value">Remarks: {detailModal.latestApproval?.remarks || '-'}</p>
                </div>

                <div className="detail-block">
                  <p className="detail-label">Spot Photos / Videos</p>
                  {detailModal.spotMedia?.length ? (
                    <div className="media-grid">
                      {detailModal.spotMedia.map((m, index) => (
                        <a
                          key={m.media_id || m.id || index}
                          className="media-thumb"
                          href={m.file_url}
                          target="_blank"
                          rel="noreferrer"
                          title={m.caption || m.file_url}
                        >
                          {m.file_type === 'video' || m.file_type?.startsWith('video') ? (
                            <video controls src={m.file_url} />
                          ) : (
                            <img src={m.file_url} alt={m.caption || 'Spot media'} />
                          )}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No spot photos/videos.</p>
                  )}
                </div>

                <div className="detail-block">
                  <p className="detail-label">Submission Documents</p>
                  {detailModal.requirementDocs?.length ? (
                    <div className="doc-list">
                      {detailModal.requirementDocs.map((d, index) => (
                        <p key={d.media_id || d.id || index}>
                          <a href={d.file_url} target="_blank" rel="noreferrer">
                            {d.original_name || d.caption || `Document ${index + 1}`}
                          </a>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No submission documents.</p>
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

      {/* {endorseModal.open && (
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
      )} */}
    </LguStaffLayout>
  );
}

export default Approvals;
