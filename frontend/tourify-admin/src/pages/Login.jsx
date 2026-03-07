import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, changePasswordFirstLogin } from '../services/authApi';
import '../styles/Login.css';

import boholBgVideo from '../assets/LOVE Bohol - Tourism Philippines (720p, h264).mp4';

const BOHOL_LOGO_URL =
  'https://tourism.bohol.gov.ph/wp-content/uploads/2025/01/Behold-Bohol-Logo-HD-small-1.png';

const BOHOL_HERO_IMAGE =
  'https://tourism.bohol.gov.ph/wp-content/uploads/2025/02/Travel-Highlights-Collage-2025.webp';


function Login() {
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  // const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [modalStep, setModalStep] = useState('loading');

  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSaving, setChangePasswordSaving] = useState(false);
  const [pendingLogin, setPendingLogin] = useState(null);
  const [identifier, setIdentifier] = useState('');

  const [showFirstNewPassword, setShowFirstNewPassword] = useState(false);
  const [showFirstConfirmPassword, setShowFirstConfirmPassword] = useState(false);


  const navigate = useNavigate();

  const togglePassword = () => {
    setPasswordVisible((prev) => !prev);
  };

  const dismissErrorModal = () => {
    setShowErrorModal(false);
    setError('');
  };

  const finishSuccessModal = (targetRoute) => {
    setShowSuccessModal(false);
    setModalStep('loading');
    navigate(targetRoute);
  };

  const resolveNextRoute = (normalizedRole) => {
    switch (normalizedRole) {
      case 'bto_admin':
      case 'bto_staff':
        return '/admin/dashboard';
      case 'lgu_admin':
        return '/lgu/dashboard';
      case 'lgu_staff':
        return '/lgu-staff/dashboard';
      case 'business_establishment':
        return '/owner/dashboard';
      default:
        throw new Error(`Unsupported role: ${normalizedRole}`);
    }
  };


  const persistSession = ({ token, normalizedRole, municipality, businessName, displayName, displayRole }) => {
    sessionStorage.setItem('accessToken', token);
    sessionStorage.setItem('mockRole', normalizedRole);
    if (municipality) sessionStorage.setItem('mockMunicipality', municipality);
    if (businessName) sessionStorage.setItem('mockBusiness', businessName);
    if (displayName) sessionStorage.setItem('mockDisplayName', displayName);
    if (displayRole) sessionStorage.setItem('mockDisplayRole', displayRole);
  };

  const completeLogin = ({ token, normalizedRole, municipality, businessName, displayName, displayRole, nextRoute }) => {
    persistSession({ token, normalizedRole, municipality, businessName, displayName, displayRole });

    setShowSuccessModal(true);
    setModalStep('loading');

    setTimeout(() => {
      setModalStep('success');
      setTimeout(() => finishSuccessModal(nextRoute), 1200);
    }, 1200);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setShowErrorModal(false);

    try {
      const { data } = await login({ identifier, password });

      const { token, account } = data || {};
      const apiRole = account?.role;

      const roleMap = {
        BTO_ADMIN: 'bto_admin',
        BTO_STAFF: 'bto_staff',
        LGU_ADMIN: 'lgu_admin',
        LGU_STAFF: 'lgu_staff',
        BUSINESS_ESTABLISHMENT: 'business_establishment',
      };

      const normalizedRole = roleMap[apiRole] || apiRole;
      const displayName = account?.full_name || account?.username || account?.email || 'User';
      const displayRole =
        normalizedRole === 'bto_staff'
          ? 'BTO Staff'
          : normalizedRole === 'bto_admin'
          ? 'BTO Admin'
          : normalizedRole === 'lgu_admin'
          ? 'LGU Admin'
          : normalizedRole === 'lgu_staff'
          ? 'LGU Staff'
          : normalizedRole === 'business_establishment'
          ? 'Establishment Owner'
          : 'User';

      if (!token || !normalizedRole) {
        throw new Error('Invalid login response.');
      }

      const nextRoute = resolveNextRoute(normalizedRole);
      const mustChangePassword = Boolean(account?.must_change_password);

      if (mustChangePassword) {
        setPendingLogin({
          token,
          normalizedRole,
          municipality: data.municipality,
          businessName: data.businessName,
          displayName,
          displayRole,
          nextRoute,
        });
        setChangePasswordForm({ newPassword: '', confirmPassword: '' });
        setChangePasswordError('');
        setShowChangePasswordModal(true);
        setShowFirstNewPassword(false);
        setShowFirstConfirmPassword(false);
        return;
      }

      completeLogin({
        token,
        normalizedRole,
        municipality: data.municipality,
        businessName: data.businessName,
        displayName,
        displayRole,
        nextRoute,
      });
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Login failed.';
      setError(message);
      setShowErrorModal(true);
      setShowSuccessModal(false);
      setModalStep('loading');
    }
  };

  const handleFirstPasswordSubmit = async (event) => {
    event.preventDefault();
    setChangePasswordError('');

    if (!pendingLogin?.token) {
      setChangePasswordError('Login session expired. Please sign in again.');
      return;
    }

    if (changePasswordForm.newPassword.length < 8) {
      setChangePasswordError('Password must be at least 8 characters.');
      return;
    }

    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      setChangePasswordError('Passwords do not match.');
      return;
    }

    try {
      setChangePasswordSaving(true);

      await changePasswordFirstLogin(
        {
          newPassword: changePasswordForm.newPassword,
          confirmPassword: changePasswordForm.confirmPassword,
        },
        pendingLogin.token
      );

      const loginPayload = pendingLogin;
      setShowChangePasswordModal(false);
      setPendingLogin(null);

      completeLogin(loginPayload);
    } catch (err) {
      const message =
        err.response?.data?.message || err.message || 'Failed to update password.';
      setChangePasswordError(message);
    } finally {
      setChangePasswordSaving(false);
    }
  };

  return (
    <div className="login-root">
      <div
        className="login-bg-pan"
        aria-hidden="true"
        style={{ '--bg-url': `url(${BOHOL_HERO_IMAGE})` }}
      >
      <div className="login-bg-track">
          <span className="login-bg-half login-bg-half--normal" />
          <span className="login-bg-half login-bg-half--mirror" />
        </div>
      </div>
      <div className="login-card">
        <section className="login-form-area">
          <header className="form-header">
          <div className="brand-row">
            <img src={BOHOL_LOGO_URL} alt="Behold Bohol logo" className="brand-logo" />
            <div>
              <p className="brand-kicker">Provincial Government of Bohol</p>
              <h1>Tourism Staff Portal</h1>
            </div>
          </div>
          <p className="form-subtitle">
            Secure access for BTO and LGU tourism staff to manage operations, accounts, analytics,
            and feedback.
          </p>
        </header>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="identifier">Username</label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                placeholder="Enter your username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
              />
            </div>

            <div className="form-field">
              <div className="field-head">
                <label htmlFor="password">Password</label>
                <a className="link" href="#">
                  Forgot password?
                </a>
              </div>
              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  type={isPasswordVisible ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={togglePassword}
                  aria-pressed={isPasswordVisible}
                >
                  {isPasswordVisible ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button type="submit" className="primary-button">
              Sign in
            </button>
          </form>
        </section>

        <aside className="login-hero">
          <video className="hero-bg-video" autoPlay loop muted playsInline preload="metadata">
            <source src={boholBgVideo} type="video/mp4" />
          </video>
          <div className="hero-overlay" />

          <div className="hero-content">
            <p className="hero-tag">Behold Bohol</p>
            <h2>Your command center for destination management</h2>
            <p className="hero-copy">
              Review tourism activity, support local destinations, and coordinate staff from one
              unified admin portal.
            </p>
          </div>

          {/* <div className="hero-figure">
            <img src={BOHOL_LOGO_URL} alt="Behold Bohol Tourism logo" />
            <p>Official Tourism Office Branding</p>
          </div> */}
        </aside>

      </div>

      {showErrorModal && (
        <div
          className="login-modal-backdrop"
          role="alertdialog"
          aria-modal="true"
          onClick={dismissErrorModal}
        >
          <div className="login-modal-card" onClick={(event) => event.stopPropagation()}>
            <header className="login-modal-header">
              <h3>Invalid credentials</h3>
              <p>{error || 'Please double-check your username and password.'}</p>
            </header>
            <div className="login-modal-actions">
              <button type="button" className="primary-button" onClick={dismissErrorModal}>
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangePasswordModal && (
        <div className="login-modal-backdrop" role="dialog" aria-modal="true">
          <div className="login-modal-card login-modal-change-password">
            <header className="login-modal-header">
              <h3>Change temporary password</h3>
              <p>
                This is your first login. Set a new password before entering the dashboard.
              </p>
            </header>

            <form className="login-form login-modal-form" onSubmit={handleFirstPasswordSubmit}>
              <div className="form-field">
                <label htmlFor="first-new-password">New password</label>
                <div className="password-field">
                  <input
                    id="first-new-password"
                    name="first-new-password"
                    type={showFirstNewPassword ? 'text' : 'password'}
                    value={changePasswordForm.newPassword}
                    onChange={(event) =>
                      setChangePasswordForm((prev) => ({
                        ...prev,
                        newPassword: event.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowFirstNewPassword((prev) => !prev)}
                    aria-pressed={showFirstNewPassword}
                    aria-label={showFirstNewPassword ? 'Hide new password' : 'Show new password'}
                  >
                    {showFirstNewPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="first-confirm-password">Confirm new password</label>
                <div className="password-field">
                  <input
                    id="first-confirm-password"
                    name="first-confirm-password"
                    type={showFirstConfirmPassword ? 'text' : 'password'}
                    value={changePasswordForm.confirmPassword}
                    onChange={(event) =>
                      setChangePasswordForm((prev) => ({
                        ...prev,
                        confirmPassword: event.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowFirstConfirmPassword((prev) => !prev)}
                    aria-pressed={showFirstConfirmPassword}
                    aria-label={showFirstConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showFirstConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>


              {changePasswordError ? (
                <p className="login-modal-error">{changePasswordError}</p>
              ) : null}

              <div className="login-modal-actions">
                <button type="submit" className="primary-button" disabled={changePasswordSaving}>
                  {changePasswordSaving ? 'Saving...' : 'Save and continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="login-modal-backdrop" role="alertdialog" aria-modal="true">
          <div className="login-modal-card login-modal-success">
            <div className={`login-modal-spinner ${modalStep === 'success' ? 'login-modal-spinner--done' : ''}`}>
              <div className="login-modal-loading-circle" />
              <div className="login-modal-checkmark">
                <span />
                <span />
              </div>
            </div>
            <p className="login-modal-message">
              {modalStep === 'success' ? 'Logged in successfully!' : 'Signing you in...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;

