import { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import LguLayout from '../components/LguLayout';
import LguStaffLayout from '../components/LguStaffLayout';
import OwnerLayout from '../components/OwnerLayout';
import {
  fetchMyAccount,
  updateMyAccount,
  changeMyPassword,
} from '../services/authApi';
import '../styles/AdminDashboard.css';

const layoutByRole = {
  bto_admin: AdminLayout,
  bto_staff: AdminLayout,
  lgu_admin: LguLayout,
  lgu_staff: LguStaffLayout,
  business_establishment: OwnerLayout,
};

function AccountSettings() {
  const role = sessionStorage.getItem('mockRole') || '';
  const Layout = layoutByRole[role] || AdminLayout;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [profileForm, setProfileForm] = useState({
    username: '',
    fullName: '',
    contactNo: '',
    email: '',
    municipality: '',
    position: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [profileNotice, setProfileNotice] = useState({ type: '', message: '' });
  const [passwordNotice, setPasswordNotice] = useState({ type: '', message: '' });
  const [profileConfirmOpen, setProfileConfirmOpen] = useState(false);
  const [passwordConfirmOpen, setPasswordConfirmOpen] = useState(false);



  const loadMyAccount = async () => {
    try {
        setLoading(true);
        const { data } = await fetchMyAccount();

        const roleFromApi = data?.account?.role || '';

        const fallbackPosition =
        roleFromApi === 'bto_admin'
            ? 'BTO Admin'
            : roleFromApi === 'bto_staff'
            ? 'BTO Staff'
            : roleFromApi === 'lgu_admin'
            ? 'LGU Admin'
            : roleFromApi === 'lgu_staff'
            ? 'LGU Staff'
            : roleFromApi === 'business_establishment'
            ? 'Owner'
            : '';

        setProfileForm({
        username: data?.account?.username || '',
        fullName: data?.profile?.full_name || '',
        contactNo: data?.profile?.contact_no || '',
        email: data?.account?.email || '',
        municipality:
            data?.profile?.municipality_id || (roleFromApi.startsWith('bto_') ? 'Bohol' : ''),
        position: data?.profile?.position || fallbackPosition,
        });


        setLoadError('');
    } catch (err) {
        setLoadError(err.response?.data?.message || 'Unable to load your account details.');
    } finally {
         setLoading(false);
    }
  };

  useEffect(() => {
    loadMyAccount();
  }, []);

  const handleProfileChange = event => {
    const { name, value } = event.target;
    setProfileForm(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = event => {
    const { name, value } = event.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
  };

    const submitProfile = event => {
        event.preventDefault();
        if (profileSaving) return;
        setProfileNotice({ type: '', message: '' });
        setProfileConfirmOpen(true);
    };

    const confirmProfileUpdate = async () => {
        setProfileConfirmOpen(false); // close confirm modal first
        setProfileSaving(true);
        setProfileNotice({ type: '', message: '' });

        try {
            await updateMyAccount({
            username: profileForm.username,
            full_name: profileForm.fullName,
            contact_no: profileForm.contactNo,
            });

            sessionStorage.setItem('mockDisplayName', profileForm.fullName || profileForm.username);
            setProfileNotice({ type: 'success', message: 'Profile updated successfully.' });
        } catch (err) {
            setProfileNotice({
            type: 'error',
            message: err.response?.data?.message || 'Failed to update profile.',
            });
        } finally {
            setProfileSaving(false);
        }
    };

    const cancelProfileUpdate = () => {
        if (profileSaving) return;
        setProfileConfirmOpen(false);
    };



    const submitPassword = event => {
        event.preventDefault();
        if (passwordSaving) return;

        setPasswordNotice({ type: '', message: '' });

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordNotice({ type: 'error', message: 'Passwords do not match.' });
            return;
        }

        setPasswordConfirmOpen(true);
    };

    const confirmPasswordUpdate = async () => {
        setPasswordConfirmOpen(false); // close confirm modal first
        setPasswordSaving(true);
        setPasswordNotice({ type: '', message: '' });

        try {
            await changeMyPassword({
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword,
            confirmPassword: passwordForm.confirmPassword,
            });

            setPasswordNotice({ type: 'success', message: 'Password changed successfully.' });
            setPasswordForm({
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
            });
        } catch (err) {
            setPasswordNotice({
            type: 'error',
            message: err.response?.data?.message || 'Failed to change password.',
            });
        } finally {
            setPasswordSaving(false);
        }
        };

        const cancelPasswordUpdate = () => {
        if (passwordSaving) return;
        setPasswordConfirmOpen(false);
    };



  return (
    <Layout
      title="My Account"
      subtitle="Only your own account can be edited here. Municipality and position are locked."
    >
      <section className="account-management">
        {loading ? <p className="muted">Loading account details...</p> : null}
        {loadError ? <div className="modal-error">{loadError}</div> : null}

        {!loading && !loadError ? (
          <>
            <div className="table-shell" style={{ marginBottom: '1rem' }}>
              <div className="section-heading">
                <h2>Profile Details</h2>
                <p>Editable: username, full name, contact number</p>
              </div>

              <form className="modal-form" onSubmit={submitProfile}>
                <div className="form-row">
                  <label className="form-label" htmlFor="my-email">Email</label>
                  <input id="my-email" value={profileForm.email} readOnly className="readonly-input" />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="my-username">Username</label>
                  <input
                    id="my-username"
                    name="username"
                    type="text"
                    required
                    value={profileForm.username}
                    onChange={handleProfileChange}
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="my-fullName">Full name</label>
                  <input
                    id="my-fullName"
                    name="fullName"
                    type="text"
                    required
                    value={profileForm.fullName}
                    onChange={handleProfileChange}
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="my-contactNo">Contact number</label>
                  <input
                    id="my-contactNo"
                    name="contactNo"
                    type="tel"
                    value={profileForm.contactNo}
                    onChange={handleProfileChange}
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="my-municipality">Municipality</label>
                  <input
                    id="my-municipality"
                    value={profileForm.municipality}
                    readOnly
                    className="readonly-input"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="my-position">Position</label>
                  <input
                    id="my-position"
                    value={profileForm.position}
                    readOnly
                    className="readonly-input"
                  />
                </div>

                {profileNotice.message ? (
                  <div className={profileNotice.type === 'error' ? 'modal-error' : 'muted'}>
                    {profileNotice.message}
                  </div>
                ) : null}

                <div className="modal-actions">
                  <button type="submit" className="primary-cta" disabled={profileSaving}>
                    {profileSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>

            <div className="table-shell">
              <div className="section-heading">
                <h2>Change Password</h2>
                <p>No OTP required. Use your current password.</p>
              </div>

              <form className="modal-form" onSubmit={submitPassword}>
                <div className="form-row">
                  <label className="form-label" htmlFor="currentPassword">Current password</label>
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    required
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordChange}
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="newPassword">New password</label>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    required
                    value={passwordForm.newPassword}
                    onChange={handlePasswordChange}
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="confirmPassword">Confirm new password</label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordChange}
                  />
                </div>

                {passwordNotice.message ? (
                  <div className={passwordNotice.type === 'error' ? 'modal-error' : 'muted'}>
                    {passwordNotice.message}
                  </div>
                ) : null}

                <div className="modal-actions">
                  <button type="submit" className="primary-cta" disabled={passwordSaving}>
                    {passwordSaving ? 'Updating...' : 'Change Password'}
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : null}
      </section>
      {profileConfirmOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal-card">
            <header className="modal-header">
                <div>
                <h3>Confirm Profile Update</h3>
                <p>Are you sure you want to save changes to your account profile?</p>
                </div>
                <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={cancelProfileUpdate}
                disabled={profileSaving}
                >
                ×
                </button>
            </header>

            <div className="modal-actions">
                <button
                type="button"
                className="ghost-cta"
                onClick={cancelProfileUpdate}
                disabled={profileSaving}
                >
                Cancel
                </button>
                <button
                type="button"
                className="primary-cta"
                onClick={confirmProfileUpdate}
                disabled={profileSaving}
                >
                {profileSaving ? 'Saving...' : 'Confirm Update'}
                </button>
            </div>
            </div>
        </div>
        )}
        {(profileSaving || passwordSaving) && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-live="polite">
            <div className="modal-card account-loading-modal">
            <div className="account-loading-visual" aria-hidden="true">
                <div className="account-loading-spinner">
                <span />
                </div>
            </div>

            <h3>Saving Changes...</h3>
            <p className="muted">
                {profileSaving
                ? 'Updating your profile. Please wait.'
                : 'Updating your password. Please wait.'}
            </p>
            </div>
        </div>
        )}
            {passwordConfirmOpen && (
            <div className="modal-backdrop" role="dialog" aria-modal="true">
                <div className="modal-card">
                <header className="modal-header">
                    <div>
                    <h3>Confirm Password Change</h3>
                    <p>Are you sure you want to update your password?</p>
                    </div>
                    <button
                    type="button"
                    className="modal-close"
                    aria-label="Close"
                    onClick={cancelPasswordUpdate}
                    disabled={passwordSaving}
                    >
                    ×
                    </button>
                </header>

                <div className="modal-actions">
                    <button
                    type="button"
                    className="ghost-cta"
                    onClick={cancelPasswordUpdate}
                    disabled={passwordSaving}
                    >
                    Cancel
                    </button>
                    <button
                    type="button"
                    className="primary-cta"
                    onClick={confirmPasswordUpdate}
                    disabled={passwordSaving}
                    >
                    {passwordSaving ? 'Updating...' : 'Confirm Change'}
                    </button>
                </div>
                </div>
            </div>
            )}

    </Layout>
  );
}

export default AccountSettings;
