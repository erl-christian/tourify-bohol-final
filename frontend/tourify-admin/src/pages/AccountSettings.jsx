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
  const accountScope = sessionStorage.getItem('mockAccountScope') || '';
  const Layout = layoutByRole[role] || AdminLayout;
  const isScopedEstablishmentAccount =
    role === 'business_establishment' && accountScope === 'establishment';

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

  const [passwordVisibility, setPasswordVisibility] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
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

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const togglePasswordVisibility = (field) => {
    setPasswordVisibility((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const submitProfile = (event) => {
    event.preventDefault();
    if (profileSaving) return;
    setProfileNotice({ type: '', message: '' });
    setProfileConfirmOpen(true);
  };

  const confirmProfileUpdate = async () => {
    setProfileConfirmOpen(false);
    setProfileSaving(true);
    setProfileNotice({ type: '', message: '' });

    try {
      const payload = {
        username: profileForm.username.trim(),
      };

      if (!isScopedEstablishmentAccount) {
        payload.full_name = profileForm.fullName.trim();
        payload.contact_no = profileForm.contactNo;
      }

      await updateMyAccount(payload);

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

  const submitPassword = (event) => {
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
    setPasswordConfirmOpen(false);
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
      setPasswordVisibility({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
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

  const profileNoticeClassName =
    profileNotice.type === 'error'
      ? 'account-settings-notice account-settings-notice--error'
      : 'account-settings-notice account-settings-notice--success';

  const passwordNoticeClassName =
    passwordNotice.type === 'error'
      ? 'account-settings-notice account-settings-notice--error'
      : 'account-settings-notice account-settings-notice--success';

  return (
    <Layout
      title="My Account"
      subtitle={
        isScopedEstablishmentAccount
          ? 'Only username and password are editable for this establishment account.'
          : 'Only your own account can be edited here. Municipality and position are locked.'
      }
    >
      <section className="account-management account-settings-wrap">
        {loading ? <p className="muted">Loading account details...</p> : null}
        {loadError ? <div className="modal-error">{loadError}</div> : null}

        {!loading && !loadError ? (
          <div className="account-settings-grid">
            <article className="table-shell account-settings-card">
              <div className="section-heading account-settings-heading">
                <h2>Profile Details</h2>
                <p>
                  {isScopedEstablishmentAccount
                    ? 'Editable: username only.'
                    : 'Editable: username, full name, contact number.'}
                </p>
              </div>

              <form className="modal-form account-settings-form" onSubmit={submitProfile}>
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
                    required={!isScopedEstablishmentAccount}
                    value={profileForm.fullName}
                    onChange={handleProfileChange}
                    readOnly={isScopedEstablishmentAccount}
                    className={isScopedEstablishmentAccount ? 'readonly-input' : ''}
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
                    readOnly={isScopedEstablishmentAccount}
                    className={isScopedEstablishmentAccount ? 'readonly-input' : ''}
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
                  <div className={profileNoticeClassName}>
                    {profileNotice.message}
                  </div>
                ) : null}

                <div className="modal-actions account-settings-actions">
                  <button type="submit" className="primary-cta" disabled={profileSaving}>
                    {profileSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </article>

            <article className="table-shell account-settings-card">
              <div className="section-heading account-settings-heading">
                <h2>Change Password</h2>
                <p>No OTP required. Use your current password.</p>
              </div>

              <form className="modal-form account-settings-form" onSubmit={submitPassword}>
                <div className="form-row">
                  <label className="form-label" htmlFor="currentPassword">Current password</label>
                  <div className="account-password-field">
                    <input
                      id="currentPassword"
                      name="currentPassword"
                      type={passwordVisibility.currentPassword ? 'text' : 'password'}
                      required
                      value={passwordForm.currentPassword}
                      onChange={handlePasswordChange}
                    />
                    <button
                      type="button"
                      className="account-password-toggle"
                      onClick={() => togglePasswordVisibility('currentPassword')}
                      aria-label={passwordVisibility.currentPassword ? 'Hide current password' : 'Show current password'}
                      aria-pressed={passwordVisibility.currentPassword}
                    >
                      {passwordVisibility.currentPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="newPassword">New password</label>
                  <div className="account-password-field">
                    <input
                      id="newPassword"
                      name="newPassword"
                      type={passwordVisibility.newPassword ? 'text' : 'password'}
                      required
                      value={passwordForm.newPassword}
                      onChange={handlePasswordChange}
                    />
                    <button
                      type="button"
                      className="account-password-toggle"
                      onClick={() => togglePasswordVisibility('newPassword')}
                      aria-label={passwordVisibility.newPassword ? 'Hide new password' : 'Show new password'}
                      aria-pressed={passwordVisibility.newPassword}
                    >
                      {passwordVisibility.newPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="confirmPassword">Confirm new password</label>
                  <div className="account-password-field">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={passwordVisibility.confirmPassword ? 'text' : 'password'}
                      required
                      value={passwordForm.confirmPassword}
                      onChange={handlePasswordChange}
                    />
                    <button
                      type="button"
                      className="account-password-toggle"
                      onClick={() => togglePasswordVisibility('confirmPassword')}
                      aria-label={passwordVisibility.confirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      aria-pressed={passwordVisibility.confirmPassword}
                    >
                      {passwordVisibility.confirmPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                {passwordNotice.message ? (
                  <div className={passwordNoticeClassName}>
                    {passwordNotice.message}
                  </div>
                ) : null}

                <div className="modal-actions account-settings-actions">
                  <button type="submit" className="primary-cta" disabled={passwordSaving}>
                    {passwordSaving ? 'Updating...' : 'Change Password'}
                  </button>
                </div>
              </form>
            </article>
          </div>
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
                x
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
                x
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
