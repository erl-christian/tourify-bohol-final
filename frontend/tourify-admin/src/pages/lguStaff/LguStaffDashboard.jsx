// frontend/tourify-admin/src/pages/lguStaff/LguStaffDashboard.jsx
import { useEffect, useMemo, useState } from 'react';
import LguStaffLayout from '../../components/LguStaffLayout';
import '../../styles/AdminDashboard.css';
import {
  fetchLguEstablishments,
  fetchLguPendingEstablishments,
  fetchLguEstablishmentDetails,
} from '../../services/lguApi';
import { fetchMunicipalities } from '../../services/btoApi';
import { fetchEstablishmentMedia } from '../../services/establishmentApi';

const statusToneMap = {
  verified: 'success',
  approved: 'success',
  pending: 'warning',
  needs_review: 'review',
  rejected: 'danger',
};

const normalizeList = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
};

const normalizeMunicipalities = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.municipalities)) return raw.municipalities;
  if (Array.isArray(raw?.data)) return raw.data;
  if (raw && typeof raw === 'object') return Object.values(raw);
  return [];
};

const resolveTone = (status) => {
  if (!status) return 'neutral';
  const lower = status.toLowerCase();
  return statusToneMap[status] || statusToneMap[lower] || 'neutral';
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

function LguStaffDashboard() {
  const [municipalityName, setMunicipalityName] = useState('Your Municipality');
  const [establishments, setEstablishments] = useState([]);
  const [pendingEstablishments, setPendingEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [detailModal, setDetailModal] = useState({
    open: false,
    loading: false,
    establishment: null,
    media: [],
    error: '',
  });

  const closeDetailModal = () =>
  setDetailModal({ open: false, loading: false, establishment: null, media: [], error: '' });

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

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);

        const [estRes, pendingRes, municipalitiesRes] = await Promise.all([
          fetchLguEstablishments({ limit: 50 }),
          fetchLguPendingEstablishments({ limit: 50 }),
          fetchMunicipalities().catch((err) => {
            console.warn('Municipality lookup failed', err);
            return null;
          }),
        ]);

        const estItems = normalizeList(estRes?.data);
        const pendingItems = normalizeList(pendingRes?.data);

        setEstablishments(estItems);
        setPendingEstablishments(pendingItems);

        const municipalities = normalizeMunicipalities(municipalitiesRes?.data);
        const sessionMunicipality =
          typeof window !== 'undefined'
            ? sessionStorage.getItem('mockMunicipality')
            : null;

        const municipalityCandidate =
          pendingItems[0]?.municipality_id ||
          estItems[0]?.municipality_id ||
          sessionMunicipality;

        if (municipalityCandidate) {
          const found = municipalities.find((item) => {
            const id = item.municipality_id || item.id;
            return (
              id === municipalityCandidate || item.name === municipalityCandidate
            );
          });
          setMunicipalityName(found?.name || municipalityCandidate);
        } else {
          setMunicipalityName('Your Municipality');
        }

        setError('');
      } catch (err) {
        console.error('LGU staff dashboard load failed', err);
        setError('Unable to load municipal data right now.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const totalEstablishments = establishments.length;

  const approvedCount = useMemo(
    () =>
      establishments.filter((item) =>
        ['approved', 'verified'].includes((item.status || '').toLowerCase()),
      ).length,
    [establishments],
  );
  const pendingCount = pendingEstablishments.length;
  const rejectedCount = useMemo(
    () =>
      establishments.filter(
        (item) => (item.status || '').toLowerCase() === 'rejected',
      ).length,
    [establishments],
  );

  const metrics = useMemo(
    () => [
      { label: 'Municipality', value: municipalityName },
      { label: 'Total Establishments', value: totalEstablishments },
      { label: 'Pending Reviews', value: pendingCount },
      { label: 'Approved / Verified', value: approvedCount },
      { label: 'Rejected', value: rejectedCount },
    ],
    [
      approvedCount,
      municipalityName,
      pendingCount,
      rejectedCount,
      totalEstablishments,
    ],
  );

  const approvedItems = useMemo(
    () =>
      establishments
        .filter((item) =>
          ['approved', 'verified'].includes((item.status || '').toLowerCase()),
        )
        .slice(0, 8),
    [establishments],
  );

  const rejectedItems = useMemo(
    () =>
      establishments
        .filter(
          (item) => (item.status || '').toLowerCase() === 'rejected',
        )
        .slice(0, 8),
    [establishments],
  );

  const resolvedDecisions = [...approvedItems, ...rejectedItems];

  const priorities = useMemo(
    () => pendingEstablishments.slice(0, 10),
    [pendingEstablishments],
  );

  return (
    <LguStaffLayout
      title={`${municipalityName} Staff Overview`}
      subtitle={`Logged in as LGU staff. Validate submissions and support the ${municipalityName} tourism admin.`}
      searchPlaceholder="Search submissions or establishments..."
    >
      <section className="account-management">
        <div className="section-heading">
          <h2>Municipal Snapshot</h2>
          <p>
            Live indicators for {municipalityName}. These metrics mirror what the LGU admin sees.
          </p>
        </div>

        <div className="table-shell">
          <div className="table-head table-grid">
            <span>Metric</span>
            <span>Value</span>
          </div>

          <ul className="table-body">
            {loading ? (
              <li className="table-row table-grid">
                <div className="muted">Loading overview…</div>
              </li>
            ) : error ? (
              <li className="table-row table-grid">
                <div className="muted">{error}</div>
              </li>
            ) : (
              metrics.map((metric) => (
                <li key={metric.label} className="table-row table-grid">
                  <span>{metric.label}</span>
                  <span>
                    {typeof metric.value === 'number'
                      ? metric.value.toLocaleString()
                      : metric.value || '—'}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="account-management">
        <div className="section-heading">
          <h2>Recent Decisions</h2>
          <p>Approved and rejected submissions that need follow-up coordination.</p>
        </div>

        <div className="table-shell">
          <div className="table-head table-grid">
            <span>Submission</span>
            <span>Status</span>
            <span>Last decision</span>
            <span>Action</span>
          </div>

          <ul className="table-body">
            {loading ? (
              <li className="table-row table-grid">
                <div className="muted">Loading decisions…</div>
              </li>
            ) : error ? (
              <li className="table-row table-grid">
                <div className="muted">{error}</div>
              </li>
            ) : resolvedDecisions.length === 0 ? (
              <li className="table-row table-grid">
                <div className="muted">No approvals or rejections recorded yet.</div>
              </li>
            ) : (
              resolvedDecisions.map((item) => (
                <li
                  key={item.businessEstablishment_id || item.id}
                  className="table-row table-grid"
                >
                  <div className="account-cell">
                    <p className="account-name">{item.name || 'Unnamed establishment'}</p>
                    <p className="account-email">
                      ID: {item.businessEstablishment_id || item.id || '—'}
                    </p>
                  </div>
                  <div>
                    <span className={`status-chip status-${resolveTone(item.status)}`}>
                      {item.status || '—'}
                    </span>
                  </div>
                  <div className="muted">
                    {formatDate(item.updatedAt || item.createdAt)}
                  </div>
                  <div>
                    <button
                      type="button"
                      className="ghost-cta"
                      onClick={() => handleViewDetails(item.businessEstablishment_id || item.id)}
                    >
                      View details
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="account-management">
        <div className="section-heading">
          <h2>Today’s Priorities</h2>
          <p>Pending submissions that need LGU staff validation before endorsement.</p>
        </div>

        <div className="table-shell">
          <div className="table-head table-grid">
            <span>Establishment</span>
            <span>Category</span>
            <span>Status</span>
            <span>Last update</span>
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
            ) : priorities.length === 0 ? (
              <li className="table-row table-grid">
                <div className="muted">No pending submissions. You’re all caught up!</div>
              </li>
            ) : (
              priorities.map((item) => (
                <li
                  key={item.businessEstablishment_id || item.id}
                  className="table-row table-grid"
                >
                  <div className="account-cell">
                    <p className="account-name">{item.name || 'Unnamed establishment'}</p>
                    <p className="account-email">
                      ID: {item.businessEstablishment_id || item.id || '—'}
                    </p>
                  </div>
                  <div className="muted">{item.type || '—'}</div>
                  <div>
                    <span className={`status-chip status-${resolveTone(item.status)}`}>
                      {item.status || 'pending'}
                    </span>
                  </div>
                  <div className="muted">
                    {formatDate(item.updatedAt || item.createdAt)}
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

export default LguStaffDashboard;
