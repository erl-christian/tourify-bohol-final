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

  const pageSize = 10;
  const [page, setPage] = useState(1);


  const [detailModal, setDetailModal] = useState({
    open: false,
    loading: false,
    error: '',
    data: null,
    media: [],
  });

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

  useEffect(() => {
    const max = Math.max(1, Math.ceil(rows.length / pageSize) || 1);
    setPage((prev) => Math.min(prev, max));
  }, [rows.length]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page],
  );
  const pageStart = rows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(page * pageSize, rows.length);


  const resolveTone = (status) =>
    statusToneMap[status] || statusToneMap[status?.toLowerCase()] || 'neutral';

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
      title="Municipal Establishments"
      subtitle="Monitor establishments in your municipality."
      searchPlaceholder="Search establishments..."
      onSearchSubmit={(value) => {
        // optional: support simple search
        console.log('search', value);
      }}
    >
      <section className="account-management">
        <div className="section-heading">
          <h2>Registered Establishments</h2>
          <p>Read-only list of establishments in your municipality.</p>
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
            ) : rows.length === 0 ? (
              <li className="table-row table-grid">
                <div className="muted">No establishments found.</div>
              </li>
            ) : (
              rows.map((item) => (
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
              Showing {paginatedRows.length ? `${pageStart}–${pageEnd}` : '0'} of {paginatedRows.length}
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="pagination-button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || !paginatedRows.length}
              >
                Previous
              </button>
              <span className="pagination-page">Page {page} of {totalPages}</span>
              <button
                type="button"
                className="pagination-button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || !paginatedRows.length}
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

export default Establishments;
