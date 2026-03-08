import { useEffect, useMemo, useState } from 'react';
import LguStaffLayout from '../../components/LguStaffLayout';
import '../../styles/AdminDashboard.css';
import LguStaffAnalytics from './Analytics.jsx';
import {
  fetchLguEstablishments,
  fetchLguEstablishmentDetails,
  fetchLguEstablishmentMedia,
} from '../../services/lguApi';
import { fetchMunicipalities } from '../../services/btoApi';

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
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
};

function LguStaffDashboard() {
  const [municipalityName, setMunicipalityName] = useState('Your Municipality');
  const [establishments, setEstablishments] = useState([]);
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

  const handleViewDetails = async (estId) => {
    if (!estId) return;
    setDetailModal({ open: true, loading: true, establishment: null, media: [], error: '' });
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

      const establishment = detailRes.data?.establishment ?? detailRes.data ?? null;

      setDetailModal({
        open: true,
        loading: false,
        establishment,
        media: mediaItems,
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

        const [estRes, municipalitiesRes] = await Promise.all([
          fetchLguEstablishments({ limit: 50 }),
          fetchMunicipalities().catch((err) => {
            console.warn('Municipality lookup failed', err);
            return null;
          }),
        ]);

        const estItems = normalizeList(estRes?.data);

        setEstablishments(estItems);

        const municipalities = normalizeMunicipalities(municipalitiesRes?.data);
        const sessionMunicipality =
          typeof window !== 'undefined'
            ? sessionStorage.getItem('mockMunicipality')
            : null;

        const municipalityCandidate =
          estItems[0]?.municipality_id ||
          sessionMunicipality;

        if (municipalityCandidate) {
          const found = municipalities.find((item) => {
            const id = item.municipality_id || item.id;
            return id === municipalityCandidate || item.name === municipalityCandidate;
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
      { label: 'Approved / Verified', value: approvedCount },
      { label: 'Rejected', value: rejectedCount },
    ],
    [
      approvedCount,
      municipalityName,
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
        .filter((item) => (item.status || '').toLowerCase() === 'rejected')
        .slice(0, 8),
    [establishments],
  );

  const resolvedDecisions = [...approvedItems, ...rejectedItems];
  const priorities = useMemo(
    () =>
      [...establishments]
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .slice(0, 10),
    [establishments],
  );

  return (
    <LguStaffLayout
      title={`${municipalityName} Dashboard & Analytics`}
      subtitle={`Logged in as LGU staff. Review analytics and establishment updates for ${municipalityName} in one page.`}
      searchPlaceholder="Search submissions or establishments..."
    >
      <div className="lgu-merged-content">
        <section className="merged-analytics-block merged-analytics-block--clean">
          <header className="merged-section-head">
            <h2>Municipal Insights</h2>
            <p>Live tourism trends and movement analytics for {municipalityName}.</p>
          </header>
          <LguStaffAnalytics embedded />
        </section>

        <section className="merged-management-block lgu-management-block">
          <header className="merged-section-head">
            <h2>Operations Overview</h2>
            <p>Monitor municipal metrics and recent establishment updates.</p>
          </header>

          <section className="account-management">
            <div className="section-heading">
              <h2>Municipal Snapshot</h2>
              <p>
                Live indicators for {municipalityName}. These metrics mirror what the LGU admin sees.
              </p>
            </div>

            <div className="table-shell">
              <div className="table-head table-grid table-grid-2">
                <span>Metric</span>
                <span>Value</span>
              </div>

              <ul className="table-body">
                {loading ? (
                  <li className="table-row table-grid table-grid-2">
                    <div className="muted">Loading overview...</div>
                  </li>
                ) : error ? (
                  <li className="table-row table-grid table-grid-2">
                    <div className="muted">{error}</div>
                  </li>
                ) : (
                  metrics.map((metric) => (
                    <li key={metric.label} className="table-row table-grid table-grid-2">
                      <span>{metric.label}</span>
                      <span>
                        {typeof metric.value === 'number'
                          ? metric.value.toLocaleString()
                          : metric.value || 'N/A'}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </section>

          <div className="account-establishment-grid account-establishment-grid--clean">
            <section className="account-management">
              <div className="section-heading">
                <h2>Recent Decisions</h2>
                <p>Approved and rejected establishments for follow-up coordination.</p>
              </div>

              <div className="table-shell">
                <div className="table-head table-grid table-grid-4">
                  <span>Submission</span>
                  <span>Status</span>
                  <span>Last decision</span>
                  <span>Action</span>
                </div>

                <ul className="table-body">
                  {loading ? (
                    <li className="table-row table-grid table-grid-4">
                      <div className="muted">Loading decisions...</div>
                    </li>
                  ) : error ? (
                    <li className="table-row table-grid table-grid-4">
                      <div className="muted">{error}</div>
                    </li>
                  ) : resolvedDecisions.length === 0 ? (
                    <li className="table-row table-grid table-grid-4">
                      <div className="muted">No decisions recorded yet.</div>
                    </li>
                  ) : (
                    resolvedDecisions.map((item) => (
                      <li
                        key={item.businessEstablishment_id || item.id}
                        className="table-row table-grid table-grid-4"
                      >
                        <div className="account-cell">
                          <p className="account-name">{item.name || 'Unnamed establishment'}</p>
                          <p className="account-email">
                            ID: {item.businessEstablishment_id || item.id || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className={`status-chip status-${resolveTone(item.status)}`}>
                            {item.status || 'N/A'}
                          </span>
                        </div>
                        <div className="muted">
                          {formatDate(item.updatedAt || item.createdAt)}
                        </div>
                        <div>
                          <button
                            type="button"
                            className="table-action-button"
                            onClick={() => handleViewDetails(item.businessEstablishment_id || item.id)}
                          >
                            View
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
                <h2>Recent Establishment Updates</h2>
                <p>Latest establishments created and updated in your municipality.</p>
              </div>

              <div className="table-shell">
                <div className="table-head table-grid table-grid-5">
                  <span>Establishment</span>
                  <span>Category</span>
                  <span>Status</span>
                  <span>Last update</span>
                  <span>Action</span>
                </div>

                <ul className="table-body">
                  {loading ? (
                    <li className="table-row table-grid table-grid-5">
                      <div className="muted">Loading establishments...</div>
                    </li>
                  ) : error ? (
                    <li className="table-row table-grid table-grid-5">
                      <div className="muted">{error}</div>
                    </li>
                  ) : priorities.length === 0 ? (
                    <li className="table-row table-grid table-grid-5">
                      <div className="muted">No establishments yet.</div>
                    </li>
                  ) : (
                    priorities.map((item) => (
                      <li
                        key={item.businessEstablishment_id || item.id}
                        className="table-row table-grid table-grid-5"
                      >
                        <div className="account-cell">
                          <p className="account-name">{item.name || 'Unnamed establishment'}</p>
                          <p className="account-email">
                            ID: {item.businessEstablishment_id || item.id || 'N/A'}
                          </p>
                        </div>
                        <div className="muted">{item.type || 'N/A'}</div>
                        <div>
                          <span className={`status-chip status-${resolveTone(item.status)}`}>
                            {item.status || 'approved'}
                          </span>
                        </div>
                        <div className="muted">
                          {formatDate(item.updatedAt || item.createdAt)}
                        </div>
                        <div>
                          <button
                            type="button"
                            className="table-action-button"
                            onClick={() => handleViewDetails(item.businessEstablishment_id || item.id)}
                          >
                            View
                          </button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </section>
          </div>
        </section>
      </div>

      {detailModal.open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3>Establishment Details</h3>
                <p className="muted">
                  ID: {detailModal.establishment?.businessEstablishment_id ?? 'N/A'}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={closeDetailModal}
                disabled={detailModal.loading}
              >
                x
              </button>
            </header>

            {detailModal.loading ? (
              <div className="modal-content">
                <div className="muted">Loading...</div>
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
                      {detailModal.establishment?.name || 'N/A'}
                    </p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Category</p>
                    <p className="detail-value">
                      {detailModal.establishment?.type || detailModal.establishment?.category || 'N/A'}
                    </p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Status</p>
                    <p className="detail-value chip">
                      {detailModal.establishment?.status || 'N/A'}
                    </p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Municipality</p>
                    <p className="detail-value">
                      {detailModal.establishment?.municipality_id || detailModal.establishment?.municipality || 'N/A'}
                    </p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Last Updated</p>
                    <p className="detail-value">
                      {detailModal.establishment?.updatedAt
                        ? new Date(detailModal.establishment.updatedAt).toLocaleString()
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Contact</p>
                    <p className="detail-value">
                      {detailModal.establishment?.contact_info || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="detail-block">
                  <p className="detail-label">Address</p>
                  <p className="detail-value">
                    {detailModal.establishment?.address || 'N/A'}
                  </p>
                </div>
                <div className="detail-block">
                  <p className="detail-label">Description</p>
                  <p className="detail-value">
                    {detailModal.establishment?.description || 'No description provided.'}
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
    </LguStaffLayout>
  );
}

export default LguStaffDashboard;
