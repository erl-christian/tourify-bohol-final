import { useEffect, useMemo, useState } from 'react';
import LguLayout from '../../components/LguLayout';
import '../../styles/AdminDashboard.css';
import {
  fetchLguAccounts,
  createLguStaff,
  createOwnerProfile,
  updateManagedAccountStatus,
  updateManagedAccount,
} from '../../services/lguApi';

const accountTabs = [
  { id: 'all', label: 'All Accounts' },
  { id: 'lgu_staff', label: 'LGU Staff' },
  { id: 'business_establishment', label: 'Establishment Owners' },
];

const initialStaffForm = { fullName: '', email: '', password: '', phone: '' };
const initialOwnerForm = { fullName: '', email: '', password: '', contactNo: '' };

function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('all');
  const [isStaffModalOpen, setStaffModalOpen] = useState(false);
  const [isOwnerModalOpen, setOwnerModalOpen] = useState(false);

  const [staffForm, setStaffForm] = useState(initialStaffForm);
  const [ownerForm, setOwnerForm] = useState(initialOwnerForm);
  const [submittingStaff, setSubmittingStaff] = useState(false);
  const [submittingOwner, setSubmittingOwner] = useState(false);

  const pageSize = 10;
  const [page, setPage] = useState(1);


  const [feedbackModal, setFeedbackModal] = useState({
    open: false,
    status: 'success',
    message: '',
  });

  const [statusModal, setStatusModal] = useState({
    open: false,
    target: null,
    nextState: true,
    loading: false,
    error: '',
  });

  const [editModal, setEditModal] = useState({
    open: false,
    target: null,
    form: { fullName: '', email: '', contactNo: '' },
    saving: false,
    error: '',
  });

  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const { data } = await fetchLguAccounts();
      setAccounts(data?.staff || []);
      setError('');
    } catch (err) {
      console.error('Failed to load LGU accounts', err);
      setError('Unable to load accounts right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const normalizedAccounts = useMemo(
    () =>
      accounts.map(({ account, profile }) => {
        const isActive = account?.is_active !== false;
        return {
          id: account?.account_id,
          name: profile?.full_name || account?.email,
          email: account?.email,
          roleId: account?.role,
          role:
            account?.role === 'lgu_staff'
              ? 'LGU Staff'
              : account?.role === 'business_establishment'
              ? 'Establishment Owner'
              : account?.role,
          municipalityId: profile?.municipality_id || '', // add this line here
          municipality: profile?.municipality_id || 'Not assigned',
          status: isActive ? 'Active' : 'Deactivated',
          isActive,
          lastSeen: account?.updatedAt
            ? new Date(account.updatedAt).toLocaleString()
            : '…',
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        };
      }),
    [accounts],
  );

  const roleCounts = useMemo(
    () =>
      normalizedAccounts.reduce(
        (acc, item) => {
          const key = item.roleId || 'unknown';
          acc.all += 1;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        },
        { all: 0 },
      ),
    [normalizedAccounts],
  );

  const filteredAccounts = useMemo(
    () =>
      activeTab === 'all'
        ? normalizedAccounts
        : normalizedAccounts.filter((account) => account.roleId === activeTab),
    [normalizedAccounts, activeTab],
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


  const handleStaffFormChange = (event) => {
    const { name, value } = event.target;
    setStaffForm((prev) => ({ ...prev, [name]: value }));
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
  };


  const handleOwnerFormChange = (event) => {
    const { name, value } = event.target;
    setOwnerForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateStaff = async (event) => {
    event.preventDefault();
    setSubmittingStaff(true);
    try {
      await createLguStaff({
        email: staffForm.email,
        password: staffForm.password,
        full_name: staffForm.fullName,
      });
      setFeedbackModal({
        open: true,
        status: 'success',
        message: `LGU staff ${staffForm.fullName} has been created.`,
      });
      setStaffForm(initialStaffForm);
      setStaffModalOpen(false);
      await loadAccounts();
    } catch (err) {
      setFeedbackModal({
        open: true,
        status: 'error',
        message:
          err.response?.data?.message ||
          'Unable to create LGU staff. Please try again.',
      });
    } finally {
      setSubmittingStaff(false);
    }
  };

  const handleCreateOwner = async (event) => {
    event.preventDefault();
    setSubmittingOwner(true);
    try {
      await createOwnerProfile({
        email: ownerForm.email,
        password: ownerForm.password,
        full_name: ownerForm.fullName,
        contact_no: ownerForm.contactNo,
      });
      setFeedbackModal({
        open: true,
        status: 'success',
        message: `Owner ${ownerForm.fullName} has been created.`,
      });
      setOwnerForm(initialOwnerForm);
      setOwnerModalOpen(false);
      await loadAccounts();
    } catch (err) {
      setFeedbackModal({
        open: true,
        status: 'error',
        message:
          err.response?.data?.message ||
          'Unable to create owner. Please try again.',
      });
    } finally {
      setSubmittingOwner(false);
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
      await updateManagedAccountStatus(statusModal.target.id, statusModal.nextState);
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
        message: `${statusModal.target.name} has been ${
          statusModal.nextState ? 'reactivated' : 'deactivated'
        }.`,
      });
      await loadAccounts();
    } catch (err) {
      setStatusModal((prev) => ({
        ...prev,
        loading: false,
        error:
          err.response?.data?.message ||
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
      contactNo: account.roleId === 'business_establishment' ? account.contactNo || '' : '',
    },
    saving: false,
    error: '',
  });
};

  const closeEditModal = () =>
    setEditModal({
      open: false,
      target: null,
      form: { fullName: '', email: '', contactNo: '' },
      saving: false,
      error: '',
    });

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditModal((prev) => ({ ...prev, form: { ...prev.form, [name]: value } }));
  };

  const handleUpdateAccount = async (e) => {
    e.preventDefault();
    if (!editModal.target) return;
    setEditModal((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      await updateManagedAccount(editModal.target.id, {
        email: editModal.form.email,
        full_name: editModal.form.fullName,
        contact_no:
          editModal.target.roleId === 'business_establishment'
            ? editModal.form.contactNo
            : undefined,
      });
      setFeedbackModal({
        open: true,
        status: 'success',
        message: `${editModal.target.name} has been updated.`,
      });
      closeEditModal();
      await loadAccounts();
    } catch (err) {
      setEditModal((prev) => ({
        ...prev,
        saving: false,
        error: err.response?.data?.message || 'Unable to update account. Please try again.',
      }));
    }
  };


  return (
    <LguLayout
      title="Accounts"
      subtitle="Invite municipal staff and establishment owners."
      searchPlaceholder="Search accounts..."
      onSearchSubmit={(value) => console.log('search', value)}
      headerActions={
        <div className="split-dropdown">
          <button
            type="button"
            className="primary-cta"
            onClick={() => setCreateMenuOpen((prev) => !prev)}
          >
            Create account ▾
          </button>
          {createMenuOpen && (
            <div className="split-dropdown-menu">
              <button
                type="button"
                onClick={() => {
                  setCreateMenuOpen(false);
                  setStaffModalOpen(true);
                }}
              >
                LGU Staff
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateMenuOpen(false);
                  setOwnerModalOpen(true);
                }}
              >
                Establishment Owner
              </button>
            </div>
          )}
        </div>
      }
    >
      <section className="account-management">
        <div className="section-heading">
          <h2>Municipal Accounts</h2>
          <p>
            Showing {roleCounts[activeTab] || roleCounts.all}{' '}
            {activeTab === 'all'
              ? 'accounts'
              : activeTab === 'lgu_staff'
              ? 'LGU staff'
              : 'establishment owners'}.
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
            {loading ? (
              <li className="table-row table-grid">
                <div className="muted">Loading accounts…</div>
              </li>
            ) : error ? (
              <li className="table-row table-grid">
                <div className="muted">{error}</div>
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
                    {account.roleId === 'lgu_staff' || account.roleId === 'business_establishment' ? (
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
                          className={`table-action-button ${account.isActive ? 'deactivate' : 'activate'}`}
                          onClick={() => openStatusModalForAccount(account, !account.isActive)}
                          disabled={statusModal.loading && statusModal.target?.id === account.id}
                        >
                          {account.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </>
                    ) : (
                      <span className="muted">—</span>
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

      {isStaffModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3>Invite LGU Staff</h3>
                <p>Set initial access for municipal operations personnel.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={() => setStaffModalOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="modal-content">
              <form className="modal-form" onSubmit={handleCreateStaff}>
                <div className="form-row">
                  <label className="form-label" htmlFor="staff-fullName">
                    Full name
                  </label>
                  <input
                    id="staff-fullName"
                    name="fullName"
                    type="text"
                    required
                    placeholder="Juan Dela Cruz"
                    value={staffForm.fullName}
                    onChange={handleStaffFormChange}
                  />
                </div>

                <div className="form-row form-grid">
                  <div>
                    <label className="form-label" htmlFor="staff-email">
                      Government email
                    </label>
                    <input
                      id="staff-email"
                      name="email"
                      type="email"
                      required
                      placeholder="firstname.lastname@lgu.gov.ph"
                      value={staffForm.email}
                      onChange={handleStaffFormChange}
                    />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="staff-password">
                      Temporary password
                    </label>
                    <input
                      id="staff-password"
                      name="password"
                      type="password"
                      required
                      placeholder="At least 8 characters"
                      value={staffForm.password}
                      onChange={handleStaffFormChange}
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="ghost-cta"
                    onClick={() => setStaffModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="primary-cta" disabled={submittingStaff}>
                    {submittingStaff ? 'Sending…' : 'Send Invitation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isOwnerModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3>Create Establishment Owner Profile</h3>
                <p>Provision credentials for a local business operator.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={() => setOwnerModalOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="modal-content">
              <form className="modal-form" onSubmit={handleCreateOwner}>
                <div className="form-row">
                  <label className="form-label" htmlFor="owner-fullName">
                    Owner name
                  </label>
                  <input
                    id="owner-fullName"
                    name="fullName"
                    type="text"
                    required
                    placeholder="Maria Santos"
                    value={ownerForm.fullName}
                    onChange={handleOwnerFormChange}
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="owner-email">
                    Email
                  </label>
                  <input
                    id="owner-email"
                    name="email"
                    type="email"
                    required
                    placeholder="owner@example.com"
                    value={ownerForm.email}
                    onChange={handleOwnerFormChange}
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="owner-password">
                    Temporary password
                  </label>
                  <input
                    id="owner-password"
                    name="password"
                    type="password"
                    required
                    placeholder="At least 8 characters"
                    value={ownerForm.password}
                    onChange={handleOwnerFormChange}
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="owner-contactNo">
                    Contact number (optional)
                  </label>
                  <input
                    id="owner-contactNo"
                    name="contactNo"
                    type="tel"
                    placeholder="+63 900 123 4567"
                    value={ownerForm.contactNo}
                    onChange={handleOwnerFormChange}
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="ghost-cta"
                    onClick={() => setOwnerModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="primary-cta" disabled={submittingOwner}>
                    {submittingOwner ? 'Saving…' : 'Save Owner'}
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
                  {statusModal.nextState ? 'Reactivate Account' : 'Deactivate Account'}
                </h3>
                <p>
                  {statusModal.nextState
                    ? 'Allow this account holder to log back in.'
                    : 'Immediately block access for this account.'}
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
          <h3>Update Account</h3>
          <p>Edit details for this municipal account.</p>
        </div>
        <button
          type="button"
          className="modal-close"
          aria-label="Close"
          onClick={closeEditModal}
          disabled={editModal.saving}
        >
          ×
        </button>
      </header>
      {editModal.error && <div className="modal-error">{editModal.error}</div>}
        <div className="modal-content">
          <form className="modal-form" onSubmit={handleUpdateAccount}>
            <div className="form-row">
              <label className="form-label" htmlFor="edit-fullName">Full name</label>
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
              <label className="form-label" htmlFor="edit-email">Email</label>
              <input
                id="edit-email"
                name="email"
                type="email"
                required
                value={editModal.form.email}
                onChange={handleEditChange}
              />
            </div>
            {editModal.target?.roleId === 'business_establishment' && (
              <div className="form-row">
                <label className="form-label" htmlFor="edit-contactNo">Contact number</label>
                <input
                  id="edit-contactNo"
                  name="contactNo"
                  type="tel"
                  value={editModal.form.contactNo}
                  onChange={handleEditChange}
                />
              </div>
            )}
            <div className="form-row">
              <label className="form-label">Municipality</label>
              <input type="text" value={editModal.target?.municipality || ''} readOnly className="readonly-input" />
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-cta" onClick={closeEditModal} disabled={editModal.saving}>
                Cancel
              </button>
              <button type="submit" className="primary-cta" disabled={editModal.saving}>
                {editModal.saving ? 'Saving…' : 'Update Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )}

    </LguLayout>
  );
}

export default Accounts;
