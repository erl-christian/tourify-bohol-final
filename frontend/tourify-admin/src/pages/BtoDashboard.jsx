import { useCallback, useEffect, useMemo, useState } from 'react';
import '../styles/AdminDashboard.css';
import { IoNotificationsOutline } from 'react-icons/io5';
import AdminLayout from '../components/AdminLayout';
import {
  fetchAdminStaffProfiles,
  fetchAllEstablishments,
  createLguAdmin,
  fetchMunicipalities,
  // updateLguAdmin,
} from '../services/btoApi';
import { useActionStatus } from '../context/ActionStatusContext';
import AdminAnalytics from './admin/Analytics';

const accountTabs = [
  { id: 'all', label: 'All Accounts' },
  { id: 'lgu_admin', label: 'LGU Admins' },
  { id: 'lgu_staff', label: 'LGU Staff' },
  { id: 'business_establishment', label: 'Owners' },  // <-- use backend role
];

const initialAdminForm = {
  fullName: '',
  username: '',
  email: '',
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
  const { showLoading, showSuccess, showError } = useActionStatus();

  const [municipalities, setMunicipalities] = useState([]);
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(true);


  const displayInitials = (() => {
    const name = sessionStorage.getItem('mockDisplayName') || 'BTO';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'BT';
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  })();

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
    showLoading('Creating LGU admin account...');

    try {
      await createLguAdmin({
        username: adminForm.username.trim(),
        email: adminForm.email.trim(),
        full_name: adminForm.fullName.trim(),
        municipality_id: adminForm.municipalityId,
      });

      showSuccess(`LGU admin ${adminForm.fullName} has been created.`);

      setAdminForm(initialAdminForm);
      setCreateModalOpen(false);
      await loadData();
    } catch (error) {
      showError(error.response?.data?.message || 'Unable to create LGU admin. Please try again.');
    } finally {
      setSubmittingAdmin(false);
    }
  };


  return (
    <AdminLayout
      title="Dashboard & Analytics"
      subtitle="Provincial overview, analytics insights, and account management in one page."
      headerActions={
        <>
          <button type="button" className="icon-pill" aria-label="Notifications">
            <IoNotificationsOutline />
          </button>
          <div className="header-avatar">{displayInitials}</div>
        </>
      }
    >
      <div className="bto-merged-content bto-merged-content--clean">
        <section className="merged-analytics-block merged-analytics-block--clean">
          <header className="merged-section-head">
            <h2>Provincial Insights</h2>
            <p>Tourism trends, visitor movement, and service sentiment in one view.</p>
          </header>
          <AdminAnalytics embedded />
        </section>
        <section className="merged-management-block">
          <header className="merged-section-head">
            <h2>Operations and Accounts</h2>
            <p>Manage LGU accounts and monitor registered establishments.</p>
          </header>

          <div className="account-establishment-grid account-establishment-grid--clean">
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
                    {/* <div className="table-actions">
                      {account.roleId === 'lgu_admin' && (
                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => openEditModal(account)}
                        >
                          Update
                        </button>
                      )}
                    </div> */}
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
    </section>
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
                    <label className="form-label" htmlFor="admin-username">
                      Username
                    </label>
                    <input
                      id="admin-username"
                      name="username"
                      type="text"
                      required
                      placeholder="lgu.tagbilaran.admin"
                      value={adminForm.username}
                      onChange={handleAdminFormChange}
                    />
                  </div>
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
    </AdminLayout>
  );
}

export default BtoDashboard;



