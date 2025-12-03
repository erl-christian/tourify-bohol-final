import { useCallback, useEffect, useMemo, useState } from 'react';
import '../styles/AdminDashboard.css';
import AdminLayout from '../components/AdminLayout';
import {
  fetchAdminStaffProfiles,
  fetchAllEstablishments,
  createLguAdmin,
  fetchMunicipalities,
  updateLguAdmin,
} from '../services/btoApi';


const quickActions = [
  {
    id: 'add-admin',
    title: 'Pre-register LGU Admin',
    description: 'Issue provincial access to a municipal tourism lead.',
    enabled: true,
  },
  {
    id: 'view-staff',
    title: 'View Staff Accounts',
    description: 'LGU admins manage staff; BTO monitors their activity.',
    enabled: false,
  },
  {
    id: 'view-owners',
    title: 'View Establishment Owners',
    description: 'Owners join via LGU invitations; visibility only.',
    enabled: false,
  },
  {
    id: 'register-establishment',
    title: 'Review Establishments',
    description: 'Track verification workflows started by LGUs.',
    enabled: false,
  },
];

const accountTabs = [
  { id: 'all', label: 'All Accounts' },
  { id: 'lgu_admin', label: 'LGU Admins' },
  { id: 'lgu_staff', label: 'LGU Staff' },
  { id: 'business_establishment', label: 'Owners' },  // <-- use backend role
];

const initialAdminForm = {
  fullName: '',
  email: '',
  password: '',
  municipalityId: '',
  phone: '',
  notes: '',
};

const statusToneMap = {
  Active: 'success',
  Verified: 'success',
  pending: 'warning',
  Pending: 'warning',
  'Pending audit': 'warning',
  'For approval': 'review',
  'needs_review': 'review',
  'Needs review': 'review',
  Suspended: 'danger',
};

function BtoDashboard() {
  const [activeTab, setActiveTab] = useState('all');
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [adminForm, setAdminForm] = useState(initialAdminForm);

  const [staff, setStaff] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState('');

  const [establishments, setEstablishments] = useState([]);
  const [loadingEstablishments, setLoadingEstablishments] = useState(true);
  const [establishmentsError, setEstablishmentsError] = useState('');

  const [submittingAdmin, setSubmittingAdmin] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState({
    open: false,
    status: 'success',
    message: '',
  });

  const [municipalities, setMunicipalities] = useState([]);
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(true);

  const [editModal, setEditModal] = useState({
    open: false,
    target: null,
    form: { fullName: '', email: '', municipalityId: '' },
    saving: false,
    error: '',
  });

  const normalizeMunicipalityPayload = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    if (Array.isArray(raw?.data)) return raw.data;
    if (Array.isArray(raw?.municipalities)) return raw.municipalities;
    if (raw && typeof raw === 'object') {
      return Object.values(raw);
    }
    return [];
  };

  const loadData = useCallback(async () => {
    try {
      setLoadingStaff(true);
      setLoadingEstablishments(true);
      setLoadingMunicipalities(true);

      const [staffRes, establishmentsRes, muniRes] = await Promise.all([
        fetchAdminStaffProfiles(),
        fetchAllEstablishments(),
        fetchMunicipalities(),
      ]);

      setStaff(staffRes.data?.staff || []);
      setEstablishments(establishmentsRes.data?.items || establishmentsRes.data || []);
      setMunicipalities(normalizeMunicipalityPayload(muniRes?.data));
      setStaffError('');
      setEstablishmentsError('');
    } catch (error) {
      console.error('Failed to load dashboard data', error);
      setStaffError('Unable to load accounts right now.');
      setEstablishmentsError('Unable to load establishments.');
    } finally {
      setLoadingStaff(false);
      setLoadingEstablishments(false);
      setLoadingMunicipalities(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const accounts = useMemo(
    () =>
      staff.map(({ account, profile }) => ({
        id: account.account_id,
        name: profile?.full_name ?? account.email,
        email: account.email,
        municipalityId: profile?.municipality_id ?? '',
        municipality: profile?.municipality_id ?? 'Not assigned',
        roleId: account.role,
        role:
          account.role === 'lgu_admin'
            ? 'LGU Admin'
            : account.role === 'lgu_staff'
            ? 'LGU Staff'
            : account.role === 'business_establishment'
            ? 'Owner'
            : account.role,
        status: 'Active',
        lastSeen: account.updatedAt
          ? new Date(account.updatedAt).toLocaleString()
          : '…',
      })),
    [staff],
  );

  const establishmentRows = useMemo(
    () =>
      establishments.map((est) => ({
        id: est.businessEstablishment_id || est.id,
        name: est.name,
        municipality: est.municipality_id || est.municipality || '—',
        category: est.type || est.category || '—',
        status: est.status,
        nextAction:
          est.status === 'pending'
            ? 'Awaiting validation'
            : est.status === 'needs_review'
            ? 'Check feedback'
            : '—',
      })),
    [establishments],
  );

  const roleCounts = useMemo(
    () =>
      accounts.reduce(
        (acc, account) => {
          const key = account.roleId || 'unknown';
          acc.all += 1;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        },
        { all: 0 },
      ),
    [accounts],
  );

  const filteredAccounts = useMemo(
    () =>
      activeTab === 'all'
        ? accounts
        : accounts.filter((account) => account.roleId === activeTab),
    [accounts, activeTab],
  );

  const activeTabMeta = accountTabs.find((tab) => tab.id === activeTab);
  const currentCount =
    activeTab === 'all' ? roleCounts.all : roleCounts[activeTab] || 0;

  const resolveStatusTone = (status) =>
    statusToneMap[status] || statusToneMap[status?.toLowerCase()] || 'neutral';

  const openCreateModal = () => {
    setAdminForm(initialAdminForm);
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
  };

  const handleAdminFormChange = (event) => {
    const { name, value } = event.target;
    setAdminForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateAdmin = async (event) => {
    event.preventDefault();
    setSubmittingAdmin(true);

    try {
      await createLguAdmin({
        email: adminForm.email,
        password: adminForm.password,
        full_name: adminForm.fullName,
        municipality_id: adminForm.municipalityId,
      });

      setFeedbackModal({
        open: true,
        status: 'success',
        message: `LGU admin ${adminForm.fullName} has been created.`,
      });

      setAdminForm(initialAdminForm);
      setCreateModalOpen(false);
      await loadData();
    } catch (error) {
      setFeedbackModal({
        open: true,
        status: 'error',
        message:
          error.response?.data?.message ||
          'Unable to create LGU admin. Please try again.',
      });
    } finally {
      setSubmittingAdmin(false);
    }
  };

  const openEditModal = (account) => {
  setEditModal({
    open: true,
    target: account,
    form: {
      fullName: account.name || '',
      email: account.email || '',
      municipalityId: account.municipalityId || '',
    },
    saving: false,
    error: '',
  });
};

const closeEditModal = () =>
  setEditModal({
    open: false,
    target: null,
    form: { fullName: '', email: '', municipalityId: '' },
    saving: false,
    error: '',
  });

const handleEditChange = (event) => {
  const { name, value } = event.target;
  setEditModal((prev) => ({ ...prev, form: { ...prev.form, [name]: value } }));
};

const handleUpdateAccount = async (event) => {
  event.preventDefault();
  if (!editModal.target) return;
  setEditModal((prev) => ({ ...prev, saving: true, error: '' }));
  try {
    await updateLguAdmin(editModal.target.id, {
      email: editModal.form.email,
      full_name: editModal.form.fullName,
      municipality_id: editModal.form.municipalityId,
    });
    setFeedbackModal({
      open: true,
      status: 'success',
      message: `LGU admin ${editModal.form.fullName} has been updated.`,
    });
    closeEditModal();
    await loadData();
  } catch (error) {
    setEditModal((prev) => ({
      ...prev,
      saving: false,
      error:
        error.response?.data?.message ||
        'Unable to update account. Please try again.',
    }));
  }
};


  return (
    <AdminLayout
      title="Account Management"
      subtitle="Provision LGU admins, staff, and establishment owners while tracking verification progress across the province."
      searchPlaceholder="Search accounts or establishments..."
      onSearchSubmit={(value) => console.log('search', value)}
      headerActions={
        <>
          <button type="button" className="icon-pill" aria-label="Notifications">
            🔔
          </button>
          <div className="header-avatar">AC</div>
        </>
      }
    >
      <div className="bto-fixed-content">
        <section className="quick-actions">
          {quickActions.map((action) => {
            const isEnabled = action.enabled;
            const isPrimaryAction = action.id === 'add-admin';
            return (
              <button
                type="button"
                key={action.id}
                className={`quick-card${isEnabled ? '' : ' quick-card--disabled'}`}
                disabled={!isEnabled}
                onClick={isPrimaryAction ? openCreateModal : undefined}
                title={
                  isEnabled
                    ? undefined
                    : 'Creation managed by LGU admins; BTO has read visibility.'
                }
              >
                <span className="quick-title">{action.title}</span>
                <span className="quick-desc">{action.description}</span>
                {!isEnabled && <span className="quick-note">View only</span>}
              </button>
            );
          })}
        </section>
        
        <div className="account-establishment-grid">
        <section className="account-management">
          <div className="section-heading">
            <h2>All Accounts</h2>
            <p>
              Showing {currentCount}{' '}
              {activeTabMeta ? activeTabMeta.label.toLowerCase() : 'accounts'}. Use filters to focus on a specific role.
            </p>
          </div>

          <div className="account-controls">
            <div className="tab-group">
              {accountTabs.map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                  <span className="tab-count">
                    {tab.id === 'all' ? roleCounts.all : roleCounts[tab.id] || 0}
                  </span>
                </button>
              ))}
            </div>

            <div className="account-actions">
              <button type="button" className="primary-cta" onClick={openCreateModal}>
                Pre-register LGU Admin
              </button>
              <button type="button" className="ghost-cta">
                Export CSV
              </button>
            </div>
          </div>

          <div className="table-shell scrollable-table">
            <div className="table-head table-grid">
              <span>Name</span>
              <span>Municipality</span>
              <span>Role</span>
              <span>Status</span>
              <span>Last Activity</span>
              <span>Actions</span>
            </div>

            <ul className="table-body">
              {loadingStaff ? (
                <li className="table-row table-grid">
                  <div className="muted">Loading accounts…</div>
                </li>
              ) : staffError ? (
                <li className="table-row table-grid">
                  <div className="muted">{staffError}</div>
                </li>
              ) : filteredAccounts.length === 0 ? (
                <li className="table-row table-grid">
                  <div className="muted">No accounts found for this filter.</div>
                </li>
              ) : (
                filteredAccounts.map((account) => (
                  <li key={account.id} className="table-row table-grid">
                    <div className="account-cell">
                      <p className="account-name">{account.name}</p>
                      <p className="account-email">{account.email}</p>
                    </div>
                    <div className="muted">{account.municipality}</div>
                    <div>
                      <span className="role-chip">{account.role}</span>
                    </div>
                    <div>
                      <span className={`status-chip status-${resolveStatusTone(account.status)}`}>
                        {account.status}
                      </span>
                    </div>
                    <div className="muted">{account.lastSeen}</div>
                    <div className="table-actions">
                      {account.roleId === 'lgu_admin' && (
                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => openEditModal(account)}
                        >
                          Update
                        </button>
                      )}
                    </div>
                  </li>
                  
                ))
              )}
            </ul>
          </div>
        </section>

        <section className="establishments-section">
          <div className="section-heading">
            <h2>Registered Establishments</h2>
            <p>Track verification and compliance requirements for all Bohol tourism operators.</p>
          </div>

          <div className="table-shell scrollable-table">
            <div className="table-head table-grid">
              <span>Establishment</span>
              <span>Municipality</span>
              <span>Category</span>
              <span>Status</span>
              <span>Next Action</span>
            </div>

            <ul className="table-body">
              {loadingEstablishments ? (
                <li className="table-row table-grid">
                  <div className="muted">Loading establishments…</div>
                </li>
              ) : establishmentsError ? (
                <li className="table-row table-grid">
                  <div className="muted">{establishmentsError}</div>
                </li>
              ) : establishmentRows.length === 0 ? (
                <li className="table-row table-grid">
                  <div className="muted">No establishments found.</div>
                </li>
              ) : (
                establishmentRows.map((item) => (
                  <li key={item.id} className="table-row table-grid">
                    <div className="account-cell">
                      <p className="account-name">{item.name}</p>
                      <p className="account-email">ID: {item.id}</p>
                    </div>
                    <div className="muted">{item.municipality}</div>
                    <div>
                      <span className="role-chip role-muted">{item.category}</span>
                    </div>
                    <div>
                      <span className={`status-chip status-${resolveStatusTone(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="muted">{item.nextAction}</div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      </div>
    </div>
      {isCreateModalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="createAdminTitle"
        >
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3 id="createAdminTitle">Pre-register LGU Administrator</h3>
                <p>
                  Generate an invitation for the municipal tourism head. They will complete the setup upon receiving the email.
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={closeCreateModal}
              >
                ×
              </button>
            </header>

            <div className="modal-content">
              <form className="modal-form" onSubmit={handleCreateAdmin}>
                <div className="form-row">
                  <label className="form-label" htmlFor="admin-fullName">
                    Full name
                  </label>
                  <input
                    id="admin-fullName"
                    name="fullName"
                    type="text"
                    required
                    placeholder="Maria Cortez"
                    value={adminForm.fullName}
                    onChange={handleAdminFormChange}
                  />
                </div>

                <div className="form-row form-grid">
                  <div>
                    <label className="form-label" htmlFor="admin-email">
                      Government email
                    </label>
                    <input
                      id="admin-email"
                      name="email"
                      type="email"
                      required
                      placeholder="firstname.lastname@municipality.gov.ph"
                      value={adminForm.email}
                      onChange={handleAdminFormChange}
                    />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="admin-password">
                      Temporary password
                    </label>
                    <input
                      id="admin-password"
                      name="password"
                      type="password"
                      required
                      placeholder="At least 8 characters"
                      value={adminForm.password}
                      onChange={handleAdminFormChange}
                    />
                  </div>
                </div>

                <div className="form-row">
                <label className="form-label" htmlFor="admin-municipality">
                  Municipality assignment
                </label>
                <select
                  id="admin-municipality"
                  name="municipalityId"
                  required
                  value={adminForm.municipalityId}
                  onChange={handleAdminFormChange}
                  disabled={loadingMunicipalities || submittingAdmin}
                >
                  <option value="" disabled>
                    {loadingMunicipalities ? 'Loading municipalities…' : 'Select municipality'}
                  </option>
                  {!loadingMunicipalities &&
                    (Array.isArray(municipalities) ? municipalities : []).map(
                      (municipality) => (
                        <option
                          key={municipality.municipality_id || municipality.id}
                          value={municipality.municipality_id || municipality.id}
                        >
                          {municipality.name}
                        </option>
                      ),
                    )}
                </select>
              </div>

                <div className="form-row form-grid">
                  <div>
                    <label className="form-label" htmlFor="admin-phone">
                      Contact number (optional)
                    </label>
                    <input
                      id="admin-phone"
                      name="phone"
                      type="tel"
                      placeholder="+63 912 345 6789"
                      value={adminForm.phone}
                      onChange={handleAdminFormChange}
                    />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="admin-role">
                      Role
                    </label>
                    <input
                      id="admin-role"
                      name="role"
                      type="text"
                      value="LGU Administrator"
                      readOnly
                      className="readonly-input"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="admin-notes">
                    Notes for invitation (optional)
                  </label>
                  <textarea
                    id="admin-notes"
                    name="notes"
                    rows={3}
                    placeholder="Include onboarding reminders or provincial policies."
                    value={adminForm.notes}
                    onChange={handleAdminFormChange}
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="ghost-cta" onClick={closeCreateModal}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-cta" disabled={submittingAdmin}>
                    {submittingAdmin ? 'Sending…' : 'Send Invitation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {feedbackModal.open && (
        <div className="modal-backdrop" role="alertdialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3>
                  {feedbackModal.status === 'success'
                    ? 'Success'
                    : 'Something went wrong'}
                </h3>
                <p>{feedbackModal.message}</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={() =>
                  setFeedbackModal({ open: false, status: 'success', message: '' })
                }
              >
                ×
              </button>
            </header>
            <div className="modal-actions">
              <button
                type="button"
                className="primary-cta"
                onClick={() =>
                  setFeedbackModal({ open: false, status: 'success', message: '' })
                }
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal.open && (
  <div className="modal-backdrop" role="dialog" aria-modal="true">
    <div className="modal-card">
      <header className="modal-header">
        <div>
          <h3>Update LGU Administrator</h3>
          <p>Edit the details for this BTO-created account.</p>
        </div>
        <button
          type="button"
          className="modal-close"
          aria-label="Close"
          onClick={closeEditModal}
          disabled={editModal.saving}
        >
          A-
        </button>
      </header>
      {editModal.error && <div className="modal-error">{editModal.error}</div>}
          <div className="modal-content">
            <form className="modal-form" onSubmit={handleUpdateAccount}>
              <div className="form-row">
                <label className="form-label" htmlFor="edit-fullName">
                  Full name
                </label>
                <input
                  id="edit-fullName"
                  name="fullName"
                  type="text"
                  required
                  value={editModal.form.fullName}
                  onChange={handleEditChange}
                />
              </div>

              <div className="form-row">
                <label className="form-label" htmlFor="edit-email">
                  Government email
                </label>
                <input
                  id="edit-email"
                  name="email"
                  type="email"
                  required
                  value={editModal.form.email}
                  onChange={handleEditChange}
                />
              </div>

              <div className="form-row">
                <label className="form-label" htmlFor="edit-municipality">
                  Municipality assignment
                </label>
                <select
                  id="edit-municipality"
                  name="municipalityId"
                  required
                  value={editModal.form.municipalityId}
                  onChange={handleEditChange}
                  disabled={loadingMunicipalities || editModal.saving}
                >
                  <option value="" disabled>
                    {loadingMunicipalities
                      ? 'Loading municipalities…'
                      : 'Select municipality'}
                  </option>
                  {(Array.isArray(municipalities) ? municipalities : []).map((m) => (
                    <option
                      key={m.municipality_id || m.id}
                      value={m.municipality_id || m.id}
                    >
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="ghost-cta"
                  onClick={closeEditModal}
                  disabled={editModal.saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-cta"
                  disabled={editModal.saving}
                >
                  {editModal.saving ? 'Saving…' : 'Update Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}

    </AdminLayout>
  );
}

export default BtoDashboard;
