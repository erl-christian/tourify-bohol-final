import { useEffect, useMemo, useState, useCallback } from 'react';
import LguLayout from '../../components/LguLayout';
import '../../styles/AdminDashboard.css';
import {
  fetchLguEstablishments,
  fetchLguEstablishmentDetails,
  fetchLguEstablishmentMedia,
  fetchMunicipalOwners,
  createLguEstablishment,
  createOwnerProfile,
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

const establishmentTypeOptions = [
  'Accommodation',
  'Restaurant',
  'Tour Operator',
  'Dive Shop',
  'Homestay',
  'Activity',
  'Transport',
];

const ownershipTypeOptions = [
  { value: 'private', label: 'Private' },
  { value: 'government', label: 'Government' },
];

const initialCreateEstForm = {
  ownerAccountId: '',
  credentialEmail: '',
  officialName: '',
  type: '',
  ownershipType: 'private',
  address: '',
  contactInfo: '',
  accreditationNo: '',
};

const initialQuickOwnerForm = {
  fullName: '',
  username: '',
  email: '',
  contactNo: '',
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
  const [owners, setOwners] = useState([]);
  const [loadingOwners, setLoadingOwners] = useState(true);
  const [isCreateEstModalOpen, setCreateEstModalOpen] = useState(false);
  const [isQuickOwnerModalOpen, setQuickOwnerModalOpen] = useState(false);
  const [createEstForm, setCreateEstForm] = useState(initialCreateEstForm);
  const [quickOwnerForm, setQuickOwnerForm] = useState(initialQuickOwnerForm);
  const [savingEst, setSavingEst] = useState(false);
  const [savingOwner, setSavingOwner] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdEstAccount, setCreatedEstAccount] = useState(null);
  const currentRole = sessionStorage.getItem('mockRole') || '';


  const [detailModal, setDetailModal] = useState({
    open: false,
    loading: false,
    error: '',
    data: null,
    ownerProfile: null,
    ownerAccount: null,
    establishmentAccount: null,
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

  const loadOwners = async () => {
    try {
      setLoadingOwners(true);
      const { data } = await fetchMunicipalOwners();
      const items = Array.isArray(data?.items) ? data.items : [];
      setOwners(items);
    } catch (err) {
      console.error('Failed to load owners', err);
    } finally {
      setLoadingOwners(false);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
  };


  useEffect(() => {
    loadEstablishments();
    loadOwners();
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
      ownerAccount: null,
      establishmentAccount: null,
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
        ownerAccount: detailPayload.ownerAccount || null,
        establishmentAccount: detailPayload.establishmentAccount || null,
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
        ownerAccount: null,
        establishmentAccount: null,
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
      ownerAccount: null,
      establishmentAccount: null,
      spotMedia: [],
      requirementDocs: [],
      latestApproval: null,
      latestApprovalActor: null,
    });

  const ownerOptions = useMemo(
    () =>
      owners
        .filter((item) => item?.account?.account_id)
        .map((item) => ({
          accountId: item.account.account_id,
          fullName: item.profile?.full_name || item.account.username || item.account.email,
          username: item.account.username || '-',
          email: item.account.email || '-',
          isActive: item.account.is_active !== false,
        })),
    [owners],
  );

  const handleCreateEstablishmentFormChange = (event) => {
    const { name, value } = event.target;
    setCreateEstForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleQuickOwnerFormChange = (event) => {
    const { name, value } = event.target;
    setQuickOwnerForm((prev) => ({ ...prev, [name]: value }));
  };

  const closeCreateEstModal = () => {
    setCreateEstModalOpen(false);
    setCreateEstForm(initialCreateEstForm);
    setCreateError('');
  };

  const closeQuickOwnerModal = () => {
    setQuickOwnerModalOpen(false);
    setQuickOwnerForm(initialQuickOwnerForm);
  };

  const handleCreateEstablishmentSubmit = async (event) => {
    event.preventDefault();
    setSavingEst(true);
    setCreateError('');

    try {
      const { data } = await createLguEstablishment({
        owner_account_id: createEstForm.ownerAccountId,
        credential_email: createEstForm.credentialEmail,
        official_name: createEstForm.officialName,
        type: createEstForm.type,
        ownership_type: createEstForm.ownershipType,
        address: createEstForm.address || undefined,
        contact_info: createEstForm.contactInfo || undefined,
        accreditation_no: createEstForm.accreditationNo || undefined,
      });

      closeCreateEstModal();
      setCreatedEstAccount({
        establishmentName: data?.establishment?.name || createEstForm.officialName,
        ownerUsername: data?.owner?.username || '',
        accountId: data?.establishment_account?.account_id || '',
        username: data?.establishment_account?.username || '',
        tempPassword: data?.establishment_account?.temp_password || '',
        loginUrl: data?.establishment_account?.account_login_url || '/login',
        credentialEmail:
          data?.establishment_account?.credential_email || createEstForm.credentialEmail || '',
        inviteEmailSent: Boolean(data?.inviteEmailSent),
      });
      await Promise.all([loadEstablishments(), loadOwners()]);
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Unable to create establishment.');
    } finally {
      setSavingEst(false);
    }
  };

  const handleQuickOwnerSubmit = async (event) => {
    event.preventDefault();
    setSavingOwner(true);
    setCreateError('');

    try {
      const { data } = await createOwnerProfile({
        full_name: quickOwnerForm.fullName,
        username: quickOwnerForm.username,
        email: quickOwnerForm.email,
        contact_no: quickOwnerForm.contactNo || undefined,
      });

      await loadOwners();
      const newAccountId = data?.account?.account_id || '';
      if (newAccountId) {
        setCreateEstForm((prev) => ({ ...prev, ownerAccountId: newAccountId }));
      }
      closeQuickOwnerModal();
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Unable to create owner account.');
    } finally {
      setSavingOwner(false);
    }
  };

  return (
    <LguLayout
      title="Municipal Establishments"
      subtitle="Monitor establishments in your municipality."
      headerActions={
        <button
          type="button"
          className="primary-cta"
          onClick={() => {
            setCreateError('');
            setCreateEstModalOpen(true);
          }}
        >
          Create Establishment
        </button>
      }
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
            <span>Establishment Account</span>
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
                  <div className="muted">
                    <div>{item.establishment_account?.username || '-'}</div>
                    <div>{item.establishment_account?.email || '-'}</div>
                    <div>ID: {item.establishment_account?.account_id || '-'}</div>
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
                    <a
                      className="ghost-cta"
                      href={item.account_login_url || '/login'}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Login
                    </a>
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

      {isCreateEstModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3>Create Establishment</h3>
                <p>Register the official establishment first, then owner can complete details.</p>
              </div>
              <button type="button" className="modal-close" aria-label="Close" onClick={closeCreateEstModal}>
                ×
              </button>
            </header>

            <div className="modal-content">
              <form className="modal-form" onSubmit={handleCreateEstablishmentSubmit}>
                <div className="form-row">
                  <label className="form-label" htmlFor="create-owner-account">
                    Business owner
                  </label>
                  <select
                    id="create-owner-account"
                    name="ownerAccountId"
                    required
                    value={createEstForm.ownerAccountId}
                    onChange={handleCreateEstablishmentFormChange}
                    disabled={loadingOwners || savingEst}
                  >
                    <option value="" disabled>
                      {loadingOwners ? 'Loading owners...' : 'Select owner account'}
                    </option>
                    {ownerOptions.map((item) => (
                      <option key={item.accountId} value={item.accountId}>
                        {item.fullName} ({item.username}) {item.isActive ? '' : '[Inactive]'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <button
                    type="button"
                    className="ghost-cta"
                    onClick={() => setQuickOwnerModalOpen(true)}
                    disabled={currentRole !== 'lgu_admin'}
                    title={currentRole !== 'lgu_admin' ? 'Only LGU Admin can create owner accounts' : ''}
                  >
                    Create Owner Account
                  </button>
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="create-credential-email">
                    Credentials email
                  </label>
                  <input
                    id="create-credential-email"
                    name="credentialEmail"
                    type="email"
                    required
                    value={createEstForm.credentialEmail}
                    onChange={handleCreateEstablishmentFormChange}
                    placeholder="owner@example.com"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="create-official-name">
                    Official registered name
                  </label>
                  <input
                    id="create-official-name"
                    name="officialName"
                    type="text"
                    required
                    value={createEstForm.officialName}
                    onChange={handleCreateEstablishmentFormChange}
                    placeholder="Official establishment name"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="create-type">
                    Category
                  </label>
                  <select
                    id="create-type"
                    name="type"
                    required
                    value={createEstForm.type}
                    onChange={handleCreateEstablishmentFormChange}
                  >
                    <option value="" disabled>
                      Select category
                    </option>
                    {establishmentTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="create-ownership-type">
                    Ownership type
                  </label>
                  <select
                    id="create-ownership-type"
                    name="ownershipType"
                    value={createEstForm.ownershipType}
                    onChange={handleCreateEstablishmentFormChange}
                  >
                    {ownershipTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="create-address">
                    Address
                  </label>
                  <input
                    id="create-address"
                    name="address"
                    type="text"
                    value={createEstForm.address}
                    onChange={handleCreateEstablishmentFormChange}
                    placeholder="Barangay, municipality"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="create-contact-info">
                    Contact info
                  </label>
                  <input
                    id="create-contact-info"
                    name="contactInfo"
                    type="text"
                    value={createEstForm.contactInfo}
                    onChange={handleCreateEstablishmentFormChange}
                    placeholder="+63 9xx / email"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="create-accreditation">
                    Accreditation/permit no.
                  </label>
                  <input
                    id="create-accreditation"
                    name="accreditationNo"
                    type="text"
                    value={createEstForm.accreditationNo}
                    onChange={handleCreateEstablishmentFormChange}
                    placeholder="DOT/LGU permit"
                  />
                </div>

                {createError ? <div className="modal-error">{createError}</div> : null}

                <div className="modal-actions">
                  <button type="button" className="ghost-cta" onClick={closeCreateEstModal} disabled={savingEst}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-cta" disabled={savingEst}>
                    {savingEst ? 'Creating...' : 'Create Establishment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isQuickOwnerModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3>Create Owner Account</h3>
                <p>Create owner now, then link owner to the establishment.</p>
              </div>
              <button type="button" className="modal-close" aria-label="Close" onClick={closeQuickOwnerModal}>
                ×
              </button>
            </header>

            <div className="modal-content">
              <form className="modal-form" onSubmit={handleQuickOwnerSubmit}>
                <div className="form-row">
                  <label className="form-label" htmlFor="quick-owner-name">
                    Full name
                  </label>
                  <input
                    id="quick-owner-name"
                    name="fullName"
                    type="text"
                    required
                    value={quickOwnerForm.fullName}
                    onChange={handleQuickOwnerFormChange}
                  />
                </div>
                <div className="form-row">
                  <label className="form-label" htmlFor="quick-owner-username">
                    Username
                  </label>
                  <input
                    id="quick-owner-username"
                    name="username"
                    type="text"
                    required
                    value={quickOwnerForm.username}
                    onChange={handleQuickOwnerFormChange}
                  />
                </div>
                <div className="form-row">
                  <label className="form-label" htmlFor="quick-owner-email">
                    Email
                  </label>
                  <input
                    id="quick-owner-email"
                    name="email"
                    type="email"
                    required
                    value={quickOwnerForm.email}
                    onChange={handleQuickOwnerFormChange}
                  />
                </div>
                <div className="form-row">
                  <label className="form-label" htmlFor="quick-owner-contact">
                    Contact no. (optional)
                  </label>
                  <input
                    id="quick-owner-contact"
                    name="contactNo"
                    type="text"
                    value={quickOwnerForm.contactNo}
                    onChange={handleQuickOwnerFormChange}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="ghost-cta" onClick={closeQuickOwnerModal} disabled={savingOwner}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-cta" disabled={savingOwner}>
                    {savingOwner ? 'Creating...' : 'Create Owner Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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
                  <p className="detail-label">Establishment Account</p>
                  <p className="detail-value">Username: {detailModal.establishmentAccount?.username || '-'}</p>
                  <p className="detail-value">Email: {detailModal.establishmentAccount?.email || '-'}</p>
                  <p className="detail-value">Account ID: {detailModal.establishmentAccount?.account_id || '-'}</p>
                  <p className="detail-value">
                    Account Status: {detailModal.establishmentAccount?.is_active === false ? 'Deactivated' : 'Active'}
                  </p>
                  <p className="detail-value">Owner Username: {detailModal.ownerAccount?.username || '-'}</p>
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

      {createdEstAccount ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3>Establishment Account Generated</h3>
                <p>
                  {createdEstAccount.inviteEmailSent
                    ? 'Credentials were sent to the provided email.'
                    : 'Credentials email was not sent. You can still share the generated credentials manually.'}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={() => setCreatedEstAccount(null)}
              >
                ×
              </button>
            </header>
            <div className="modal-content">
              <div className="detail-block">
                <p className="detail-label">Establishment</p>
                <p className="detail-value">{createdEstAccount.establishmentName || '-'}</p>
              </div>
              <div className="detail-block">
                <p className="detail-label">Linked Owner Username</p>
                <p className="detail-value">{createdEstAccount.ownerUsername || '-'}</p>
              </div>
              <div className="detail-block">
                <p className="detail-label">Generated Account Details</p>
                <p className="detail-value">Account ID: {createdEstAccount.accountId || '-'}</p>
                <p className="detail-value">Username: {createdEstAccount.username || '-'}</p>
                <p className="detail-value">Temporary Password: {createdEstAccount.tempPassword || '-'}</p>
                <p className="detail-value">
                  Credentials Email: {createdEstAccount.credentialEmail || '-'}
                </p>
                <p className="detail-value">
                  Email Status: {createdEstAccount.inviteEmailSent ? 'Sent' : 'Not sent'}
                </p>
                <p className="detail-value">
                  Login URL:{' '}
                  <a href={createdEstAccount.loginUrl || '/login'} target="_blank" rel="noreferrer">
                    {createdEstAccount.loginUrl || '/login'}
                  </a>
                </p>
              </div>
              <div className="modal-actions">
                <button type="button" className="primary-cta" onClick={() => setCreatedEstAccount(null)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </LguLayout>
  );
}

export default Establishments;



