import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import '../../styles/AdminDashboard.css';
import { fetchAllEstablishments, fetchEstablishmentDetails, fetchEstablishmentMediaForAdmin } from '../../services/btoApi';

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
  const [municipalityFilter, setMunicipalityFilter] = useState('all');
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
    latestApproval: null,
    media: [],
  });

  const formatDateTime = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
  };

  const toMediaList = (payload) =>
    Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.media)
      ? payload.media
      : Array.isArray(payload?.items)
      ? payload.items
      : [];


  const loadEstablishments = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await fetchAllEstablishments({ page: 1, limit: 200 });
      const items = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : [];
      setEstablishments(items);
      setError('');
    } catch (err) {
      console.error('Failed to load establishments', err);
      setError('Unable to load establishments right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEstablishments();
  }, [loadEstablishments]);

  const municipalityOptions = useMemo(() => {
    const values = new Map();
    establishments.forEach((item) => {
      const raw = (item.municipality_id || item.municipality || '').toString().trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      if (!values.has(key)) values.set(key, raw);
    });
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [establishments]);

  const categoryOptions = useMemo(() => {
    const values = new Map();
    establishments.forEach((item) => {
      const raw = (item.type || item.category || '').toString().trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      if (!values.has(key)) values.set(key, raw);
    });
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [establishments]);

  const statusOptions = useMemo(() => {
    const values = new Map();
    establishments.forEach((item) => {
      const raw = (item.status || '').toString().trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      if (!values.has(key)) values.set(key, raw);
    });
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [establishments]);

  const filteredEstablishments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return establishments.filter((item) => {
      const id = (item.businessEstablishment_id || item.id || '').toString().toLowerCase();
      const name = (item.name || '').toString().toLowerCase();
      const municipality = (item.municipality_id || item.municipality || '').toString().toLowerCase();
      const category = (item.type || item.category || '').toString().toLowerCase();
      const status = (item.status || '').toString().toLowerCase();

      if (term) {
        const haystack = `${name} ${id} ${municipality} ${category} ${status}`;
        if (!haystack.includes(term)) return false;
      }
      if (municipalityFilter !== 'all' && municipality !== municipalityFilter) return false;
      if (categoryFilter !== 'all' && category !== categoryFilter) return false;
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      return true;
    });
  }, [establishments, searchTerm, municipalityFilter, categoryFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, municipalityFilter, categoryFilter, statusFilter]);

  useEffect(() => {
    const max = Math.max(1, Math.ceil(filteredEstablishments.length / pageSize) || 1);
    setPage((prev) => Math.min(prev, max));
  }, [filteredEstablishments.length]);

  const totalPages = Math.max(1, Math.ceil(filteredEstablishments.length / pageSize));
  const paginatedEstablishments = useMemo(
    () => filteredEstablishments.slice((page - 1) * pageSize, page * pageSize),
    [filteredEstablishments, page],
  );
  const pageStart = filteredEstablishments.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(page * pageSize, filteredEstablishments.length);
  const hasActiveFilters =
    searchTerm.trim() ||
    municipalityFilter !== 'all' ||
    categoryFilter !== 'all' ||
    statusFilter !== 'all';


  const resolveTone = (status) =>
    statusToneMap[status] || statusToneMap[status?.toLowerCase()] || 'neutral';

  const openDetailModal = async (est) => {
    const estId = est.businessEstablishment_id || est.id;
    if (!estId) return;

    setDetailModal({
      open: true,
      loading: true,
      error: '',
      data: null,
      ownerProfile: null,
      latestApproval: null,
      media: [],
    });

    try {
      const [detailRes, spotRes, docsRes] = await Promise.all([
        fetchEstablishmentDetails(estId),
        fetchEstablishmentMediaForAdmin(estId, 'spot_gallery'),
        fetchEstablishmentMediaForAdmin(estId, 'submission_requirement'),
      ]);

      const detailPayload = detailRes?.data ?? {};

      setDetailModal({
        open: true,
        loading: false,
        error: '',
        data: detailPayload.establishment || detailPayload || null,
        ownerProfile: detailPayload.ownerProfile || null,
        latestApproval: detailPayload.latestApproval || null,
        spotMedia: toMediaList(spotRes?.data),
        requirementDocs: toMediaList(docsRes?.data),
      });
    } catch (err) {
      setDetailModal({
        open: true,
        loading: false,
        error: err.response?.data?.message || 'Unable to load establishment details.',
        data: null,
        ownerProfile: null,
        latestApproval: null,
        spotMedia: [],
        requirementDocs: [],
      });
    }
  };

  const closeDetailModal = () =>
    setDetailModal({ open: false, loading: false, error: '', data: null });

  return (
    <AdminLayout
      title="Establishments"
      subtitle="View every registered establishment across the province."
      headerActions={<></>}
    >
      <section className="account-management">
        <div className="section-heading">
          <h2>Registered Establishments</h2>
          <p>BTO admins can review status and details submitted by LGU admins and business owners.</p>
        </div>

        <div className="est-filter-bar">
          <div className="est-filter-item est-filter-item--search">
            <span>Search</span>
            <input
              type="text"
              placeholder="Name, ID, municipality, category"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="est-filter-item">
            <span>Municipality</span>
            <select
              value={municipalityFilter}
              onChange={(event) => setMunicipalityFilter(event.target.value)}
            >
              <option value="all">All municipalities</option>
              {municipalityOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
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
                setMunicipalityFilter('all');
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
            <span>Municipality</span>
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
            ) : filteredEstablishments.length === 0 ? (
              <li className="table-row table-grid">
                <div className="muted">No establishments found.</div>
              </li>
            ) : (
              paginatedEstablishments.map((item) => (
                <li key={item.businessEstablishment_id || item.id} className="table-row table-grid">
                  <div className="account-cell">
                    <p className="account-name">{item.name}</p>
                    <p className="account-email">
                      ID: {item.businessEstablishment_id || item.id}
                    </p>
                  </div>
                  <div className="muted">{item.municipality_id || item.municipality || '—'}</div>
                  <div>
                    <span className="role-chip role-muted">{item.type || item.category || '—'}</span>
                  </div>
                  <div>
                    <span className={`status-chip status-${resolveTone(item.status)}`}>
                      {item.status || '—'}
                    </span>
                  </div>
                  <div className="muted">
                    <div>Submitted: {formatDateTime(item.createdAt)}</div>
                    <div>Approved: {formatDateTime(item.approvedAt || item.verifiedAt)}</div>
                    <div>Updated: {formatDateTime(item.updatedAt)}</div>
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
              Showing {filteredEstablishments.length ? `${pageStart}–${pageEnd}` : '0'} of {filteredEstablishments.length}
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="pagination-button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || !filteredEstablishments.length}
              >
                Previous
              </button>
              <span className="pagination-page">Page {page} of {totalPages}</span>
              <button
                type="button"
                className="pagination-button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || !filteredEstablishments.length}
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
                <p>Review the submitted information for this listing.</p>
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
                    <p className="detail-label">Establishment ID</p>
                    <p className="detail-value mono">
                      {detailModal.data?.businessEstablishment_id ||
                        detailModal.data?.id ||
                        '—'}
                    </p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Municipality</p>
                    <p className="detail-value">
                      {detailModal.data?.municipality_id ||
                        detailModal.data?.municipality ||
                        '—'}
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
                    <p className="detail-label">Submitted</p>
                    <p className="detail-value">{formatDateTime(detailModal.data?.createdAt)}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Approved / Last Update</p>
                    <p className="detail-value">
                      {formatDateTime(detailModal.data?.approvedAt || detailModal.data?.updatedAt)}
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
                  <p className="detail-label">Spot Photos / Videos</p>
                  {detailModal.spotMedia?.length ? (
                    <div className="media-grid">
                      {detailModal.spotMedia.map((m) => (
                        <a
                          key={m.media_id || m.id}
                          className="media-thumb"
                          href={m.file_url}
                          target="_blank"
                          rel="noreferrer"
                          title={m.caption || m.file_url}
                        >
                          {m.file_type === 'video' ? (
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
    </AdminLayout>
  );
}

export default Establishments;
