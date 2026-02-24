import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import '../../styles/AdminDashboard.css';
import {
  fetchAdminStaffProfiles,
  createLguAdmin,
  fetchMunicipalities,
  updateLguAdminStatus,
  updateLguAdmin,
} from '../../services/btoApi';

const accountTabs = [
  { id: 'all', label: 'All Accounts' },
  { id: 'lgu_admin', label: 'LGU Admins' },
  { id: 'lgu_staff', label: 'LGU Staff' },
];

const initialAdminForm = {
  fullName: '',
  email: '',
  password: '',
  municipalityId: '',
  phone: '',
  notes: '',
};

function Accounts() {
  const [activeTab, setActiveTab] = useState('all');
  const [adminForm, setAdminForm] = useState(initialAdminForm);
  const [isModalOpen, setModalOpen] = useState(false);

  const [staff, setStaff] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState('');

  const [municipalities, setMunicipalities] = useState([]);
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(true);

  const pageSize = 10;
  const [page, setPage] = useState(1);


  const [submittingAdmin, setSubmittingAdmin] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState({
    open: false,
    status: 'success',
    message: '',
  });

  const [editModal, setEditModal] = useState({
    open: false,
    target: null,
    form: { fullName: '', email: '', municipalityId: '' },
    saving: false,
    error: '',
  });


  const [statusModal, setStatusModal] = useState({
    open: false,
    target: null,
    nextState: true,
    loading: false,
    error: '',
  });

  const normalizeMunicipalities = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    if (Array.isArray(raw?.data)) return raw.data;
    if (Array.isArray(raw?.municipalities)) return raw.municipalities;
    if (raw && typeof raw === 'object') {
      return Object.values(raw);
    }
    return [];
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
  };


  const loadData = useCallback(async () => {
    try {
      setLoadingStaff(true);
      setLoadingMunicipalities(true);

      const [staffRes, municipalitiesRes] = await Promise.all([
        fetchAdminStaffProfiles(),
        fetchMunicipalities(),
      ]);

      setStaff(staffRes.data?.staff || []);
      setMunicipalities(normalizeMunicipalities(municipalitiesRes?.data));
      setStaffError('');
    } catch (error) {
      console.error('Failed to load accounts', error);
      setStaffError('Unable to load accounts right now.');
    } finally {
      setLoadingStaff(false);
      setLoadingMunicipalities(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const accounts = useMemo(
    () =>
      staff.map(({ account, profile }) => {
        const isActive = account.is_active !== false;
        return {
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
              : account.role,
          status: isActive ? 'Active' : 'Deactivated',
          isActive,
          lastSeen: account.updatedAt
            ? new Date(account.updatedAt).toLocaleString()
            : '�?"',
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        };
      }),
    [staff],
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

  useEffect(() => setPage(1), [activeTab]);

  useEffect(() => {
    const max = Math.max(1, Math.ceil(filteredAccounts.length / pageSize) || 1);
    setPage((prev) => Math.min(prev, max));
  }, [filteredAccounts.length]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));
  const paginatedAccounts = useMemo(
    () => filteredAccounts.slice((page - 1) * pageSize, page * pageSize),
    [filteredAccounts, page],
  );
  const pageStart = filteredAccounts.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(page * pageSize, filteredAccounts.length);


  const activeTabMeta = accountTabs.find((tab) => tab.id === activeTab);
  const currentCount =
    activeTab === 'all' ? roleCounts.all : roleCounts[activeTab] || 0;

  const openModal = () => {
    setAdminForm(initialAdminForm);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
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
      setModalOpen(false);
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

  const openStatusModalForAccount = (account, nextState) => {
    setStatusModal({
      open: true,
      target: account,
      nextState,
      loading: false,
      error: '',
    });
  };

  const closeStatusModal = () => {
    setStatusModal({
      open: false,
      target: null,
      nextState: true,
      loading: false,
      error: '',
    });
  };

  const handleStatusSubmit = async () => {
    if (!statusModal.target) return;
    setStatusModal((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      await updateLguAdminStatus(statusModal.target.id, statusModal.nextState);
      setStatusModal({
        open: false,
        target: null,
        nextState: true,
        loading: false,
        error: '',
      });
      setFeedbackModal({
        open: true,
        status: 'success',
        message: `LGU admin ${statusModal.target.name} has been ${
          statusModal.nextState ? 'reactivated' : 'deactivated'
        }.`,
      });
      await loadData();
    } catch (error) {
      setStatusModal((prev) => ({
        ...prev,
        loading: false,
        error:
          error.response?.data?.message ||
          'Unable to update account status. Please try again.',
      }));
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
      title="LGU Accounts"
      subtitle="Manage LGU admins and staff across the province."
      searchPlaceholder="Search accounts..."
      onSearchSubmit={(value) => console.log('search', value)}
      headerActions={
        <button type="button" className="primary-cta" onClick={openModal}>
          Invite LGU Admin
        </button>
      }
    >
      <section className="account-management">
        <div className="section-heading">
          <h2>Accounts</h2>
          <p>
            Showing {currentCount}{' '}
            {activeTabMeta ? activeTabMeta.label.toLowerCase() : 'accounts'}.
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
        </div>

        <div className="table-shell">
          <div className="table-head table-grid accounts-grid">
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
              paginatedAccounts.map((account) => (
                <li key={account.id} className="table-row table-grid accounts-grid">
                  <div className="account-cell">
                    <p className="account-name">{account.name}</p>
                    <p className="account-email">{account.email}</p>
                  </div>
                  <div className="muted">{account.municipality}</div>
                  <div>
                    <span className="role-chip">{account.role}</span>
                  </div>
                  <div>
                    <span
                      className={`status-chip status-${
                        account.isActive ? 'success' : 'danger'
                      }`}
                    >
                      {account.status}
                    </span>
                  </div>
                  <div className="muted">{account.lastSeen}</div>
                  <div className="muted">
                  <div>Created: {formatDateTime(account.createdAt)}</div>
                  <div>Updated: {formatDateTime(account.updatedAt)}</div>
                </div>
                  <div className="table-actions">
                    {account.roleId === 'lgu_admin' ? (
                      <>
                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => openEditModal(account)}
                        >
                          Update
                        </button>
                        <button
                          type="button"
                          className={`table-action-button ${
                            account.isActive ? 'deactivate' : 'activate'
                          }`}
                          onClick={() =>
                            openStatusModalForAccount(account, !account.isActive)
                          }
                          disabled={
                            statusModal.loading &&
                            statusModal.target?.id === account.id
                          }
                        >
                          {account.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </>
                    ) : (
                      <span className="muted">�?"</span>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
          
        </div>
        <div className="pagination-bar">
  <div className="pagination-info">
    Showing {filteredAccounts.length ? `${pageStart}–${pageEnd}` : '0'} of {filteredAccounts.length}
  </div>
  <div className="pagination-controls">
    <button
      type="button"
      className="pagination-button"
      onClick={() => setPage((p) => Math.max(1, p - 1))}
      disabled={page === 1 || !filteredAccounts.length}
    >
      Previous
    </button>
    <span className="pagination-page">Page {page} of {totalPages}</span>
    <button
      type="button"
      className="pagination-button"
      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
      disabled={page === totalPages || !filteredAccounts.length}
    >
      Next
    </button>
  </div>
</div>

      </section>

      {isModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3>Invite LGU Administrator</h3>
                <p>Send credentials so the LGU admin can activate their account.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={closeModal}
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

                <div className="modal-actions">
                  <button type="button" className="ghost-cta" onClick={closeModal}>
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

      {statusModal.open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3>
                  {statusModal.nextState ? 'Reactivate LGU Admin' : 'Deactivate LGU Admin'}
                </h3>
                <p>
                  {statusModal.nextState
                    ? 'Allow this administrator to log back into the LGU portal.'
                    : 'Immediately block access for this administrator.'}
                  <br />
                  <strong>{statusModal.target?.name}</strong>
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={closeStatusModal}
                disabled={statusModal.loading}
              >
                ×
              </button>
            </header>
            {statusModal.error && <div className="modal-error">{statusModal.error}</div>}
            <div className="modal-actions">
              <button
                type="button"
                className="ghost-cta"
                onClick={closeStatusModal}
                disabled={statusModal.loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={statusModal.nextState ? 'primary-cta' : 'danger-cta'}
                onClick={handleStatusSubmit}
                disabled={statusModal.loading}
              >
                {statusModal.loading
                  ? 'Updating…'
                  : statusModal.nextState
                  ? 'Activate'
                  : 'Deactivate'}
              </button>
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
                <p>Edit details for this BTO-created account.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={closeEditModal}
                disabled={editModal.saving}
              >
                x
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
                        ? 'Loading municipalities�?�'
                        : 'Select municipality'}
                    </option>
                    {(Array.isArray(municipalities) ? municipalities : []).map(
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
                    {editModal.saving ? 'Saving�?�' : 'Update Account'}
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

export default Accounts;
