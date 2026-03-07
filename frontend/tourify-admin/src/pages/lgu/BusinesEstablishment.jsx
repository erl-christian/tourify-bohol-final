import { useEffect, useMemo, useState, useCallback } from 'react';
import LguLayout from '../../components/LguLayout';
import '../../styles/AdminDashboard.css';
import {
  fetchLguEstablishments,
  fetchLguEstablishmentDetails,
  fetchLguEstablishmentMedia,
} from '../../services/lguApi';

const statusToneMap = {
  verified: 'success',
  Verified: 'success',
  pending: 'warning',
  Pending: 'warning',
  needs_review: 'review',
  'Needs review': 'review',
  rejected: 'danger',
};

function Establishments() {
  const [establishments, setEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const pageSize = 10;
  const [page, setPage] = useState(1);


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

  const toMediaList = (payload) =>
  Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.media)
    ? payload.media
    : Array.isArray(payload?.items)
    ? payload.items
    : [];


  const loadEstablishments = async () => {
    try {
      setLoading(true);
      const { data } = await fetchLguEstablishments();
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setEstablishments(items);
      setError('');
    } catch (err) {
      console.error('Failed to load establishments', err);
      setError('Unable to load establishments right now.');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
  };


  useEffect(() => {
    loadEstablishments();
  }, []);

  const rows = useMemo(() => establishments, [establishments]);

  const categoryOptions = useMemo(() => {
    const values = new Map();
    rows.forEach((item) => {
      const raw = (item.type || item.category || '').toString().trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      if (!values.has(key)) values.set(key, raw);
    });
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const statusOptions = useMemo(() => {
    const values = new Map();
    rows.forEach((item) => {
      const raw = (item.status || '').toString().trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      if (!values.has(key)) values.set(key, raw);
    });
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return rows.filter((item) => {
      const id = (item.businessEstablishment_id || item.id || '').toString().toLowerCase();
      const name = (item.name || '').toString().toLowerCase();
      const category = (item.type || item.category || '').toString().toLowerCase();
      const status = (item.status || '').toString().toLowerCase();

      if (term) {
        const haystack = `${name} ${id} ${category} ${status}`;
        if (!haystack.includes(term)) return false;
      }
      if (categoryFilter !== 'all' && category !== categoryFilter) return false;
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      return true;
    });
  }, [rows, searchTerm, categoryFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, categoryFilter, statusFilter]);

  useEffect(() => {
    const max = Math.max(1, Math.ceil(filteredRows.length / pageSize) || 1);
    setPage((prev) => Math.min(prev, max));
  }, [filteredRows.length]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page],
  );
  const pageStart = filteredRows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(page * pageSize, filteredRows.length);
  const hasActiveFilters = searchTerm.trim() || categoryFilter !== 'all' || statusFilter !== 'all';


  const resolveTone = (status) =>
    statusToneMap[status] || statusToneMap[status?.toLowerCase()] || 'neutral';

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
      title="Municipal Establishments"
      subtitle="Monitor establishments in your municipality."
      headerActions={<></>}
    >
      <section className="account-management">
        <div className="section-heading">
          <h2>Registered Establishments</h2>
          <p>Read-only list of establishments in your municipality.</p>
        </div>

        <div className="est-filter-bar">
          <div className="est-filter-item est-filter-item--search">
            <span>Search</span>
            <input
              type="text"
              placeholder="Name, ID, category, status"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="est-filter-item">
            <span>Category</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">All categories</option>
              {categoryOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="est-filter-item">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              {statusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="est-filter-actions">
            <button
              type="button"
              className="ghost-cta"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
                setStatusFilter('all');
              }}
              disabled={!hasActiveFilters}
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="table-shell">
          <div className="table-head table-grid">
            <span>Establishment</span>
            <span>Category</span>
            <span>Status</span>
            <span>Dates</span>
            <span>Actions</span>
          </div>

          <ul className="table-body">
            {loading ? (
              <li className="table-row table-grid">
                <div className="muted">Loading establishments…</div>
              </li>
            ) : error ? (
              <li className="table-row table-grid">
                <div className="muted">{error}</div>
              </li>
            ) : filteredRows.length === 0 ? (
              <li className="table-row table-grid">
                <div className="muted">No establishments found.</div>
              </li>
            ) : (
              paginatedRows.map((item) => (
                <li key={item.businessEstablishment_id || item.id} className="table-row table-grid">
                  <div className="account-cell">
                    <p className="account-name">{item.name}</p>
                    <p className="account-email">ID: {item.businessEstablishment_id || item.id}</p>
                  </div>
                  <div className="muted">{item.type || item.category || '—'}</div>
                  <div>
                    <span className={`status-chip status-${resolveTone(item.status)}`}>
                      {item.status || '—'}
                    </span>
                  </div>
                  <div className="muted">
                    <div>Submitted: {formatDateTime(item.createdAt)}</div>
                    <div>Updated: {formatDateTime(item.approvedAt || item.verifiedAt || item.updatedAt)}</div>
                  </div>
                  <div className="table-actions">
                    <button
                      type="button"
                      className="table-action-button"
                      onClick={() => openDetailModal(item)}
                    >
                      View
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="pagination-bar">
            <div className="pagination-info">
              Showing {filteredRows.length ? `${pageStart}-${pageEnd}` : '0'} of {filteredRows.length}
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="pagination-button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || !filteredRows.length}
              >
                Previous
              </button>
              <span className="pagination-page">Page {page} of {totalPages}</span>
              <button
                type="button"
                className="pagination-button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || !filteredRows.length}
              >
                Next
              </button>
            </div>
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

export default Establishments;



