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
    ownerProfile: null,
    spotMedia: [],
    requirementDocs: [],
    latestApproval: null,
    latestApprovalActor: null,
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


  const openDetailModal = useCallback(async (est) => {
    const estId = est.businessEstablishment_id || est.id;
    if (!estId) return;

    setDetailModal({
      open: true,
      loading: true,
      error: '',
      data: null,
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
        data: detailPayload.establishment || detailPayload || null,
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
        error: err.response?.data?.message || 'Unable to load establishment details.',
        data: null,
        ownerProfile: null,
        spotMedia: [],
        requirementDocs: [],
        latestApproval: null,
        latestApprovalActor: null,
      });
    }
  }, []);

  const closeDetailModal = () =>
    setDetailModal({
      open: false,
      loading: false,
      error: '',
      data: null,
      ownerProfile: null,
      spotMedia: [],
      requirementDocs: [],
      latestApproval: null,
      latestApprovalActor: null,
    });

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
            <span>Timeline</span>
            <span>Status</span>
            <span>Submitted / Updated</span>
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
                  <div className="muted">
                    <div>Submitted: {formatDateTime(item.createdAt)}</div>
                    <div>Updated: {formatDateTime(item.updatedAt)}</div>
                  </div>
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
                    <p className="detail-value strong">{detailModal.data?.name || '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Establishment ID</p>
                    <p className="detail-value mono">
                      {detailModal.data?.businessEstablishment_id || detailModal.data?.id || '-'}
                    </p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Municipality ID</p>
                    <p className="detail-value">{detailModal.data?.municipality_id || '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Category</p>
                    <p className="detail-value">{detailModal.data?.type || detailModal.data?.category || '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Ownership Type</p>
                    <p className="detail-value">{detailModal.data?.ownership_type || '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Status</p>
                    <p className="detail-value chip">{detailModal.data?.status || '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Contact Info</p>
                    <p className="detail-value">{detailModal.data?.contact_info || '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Accreditation No.</p>
                    <p className="detail-value">{detailModal.data?.accreditation_no || '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Budget Min</p>
                    <p className="detail-value">{detailModal.data?.budget_min ?? '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Budget Max</p>
                    <p className="detail-value">{detailModal.data?.budget_max ?? '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Latitude</p>
                    <p className="detail-value">{detailModal.data?.latitude ?? '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Longitude</p>
                    <p className="detail-value">{detailModal.data?.longitude ?? '-'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Created</p>
                    <p className="detail-value">{formatDateTime(detailModal.data?.createdAt)}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Updated</p>
                    <p className="detail-value">{formatDateTime(detailModal.data?.updatedAt)}</p>
                  </div>
                </div>

                <div className="detail-block">
                  <p className="detail-label">Address</p>
                  <p className="detail-value">{detailModal.data?.address || '-'}</p>
                </div>

                <div className="detail-block">
                  <p className="detail-label">Description</p>
                  <p className="detail-value">{detailModal.data?.description || '-'}</p>
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
    </LguLayout>
  );
}

export default Approvals;
