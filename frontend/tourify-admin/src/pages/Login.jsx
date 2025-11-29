import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/authApi';
import heroImage from '../assets/react.svg';
import '../styles/Login.css';

function Login() {
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [modalStep, setModalStep] = useState('loading');

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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setShowErrorModal(false);

    try {
      const { data } = await login({ email, password });
      console.log('login response', data);

      const { token, account } = data || {};
      const apiRole = account?.role;

      const roleMap = {
        BTO_ADMIN: 'bto_admin',
        LGU_ADMIN: 'lgu_admin',
        LGU_STAFF: 'lgu_staff',
        BUSINESS_ESTABLISHMENT: 'business_establishment',
      };

      const normalizedRole = roleMap[apiRole] || apiRole;

      if (!token || !normalizedRole) {
        throw new Error('Invalid login response.');
      }

      sessionStorage.setItem('accessToken', token);
      sessionStorage.setItem('mockRole', normalizedRole);
      if (data.municipality) sessionStorage.setItem('mockMunicipality', data.municipality);
      if (data.businessName) sessionStorage.setItem('mockBusiness', data.businessName);

      let nextRoute = '';
      switch (normalizedRole) {
        case 'bto_admin':
          nextRoute = '/admin/dashboard';
          break;
        case 'lgu_admin':
          nextRoute = '/lgu/dashboard';
          break;
        case 'lgu_staff':
          nextRoute = '/lgu-staff/dashboard';
          break;
        case 'business_establishment':
          nextRoute = '/owner/dashboard';
          break;
        default:
          throw new Error(`Unsupported role: ${normalizedRole}`);
      }

      setShowSuccessModal(true);
      setModalStep('loading');

      setTimeout(() => {
        setModalStep('success');
        setTimeout(() => finishSuccessModal(nextRoute), 1200);
      }, 1200);
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Login failed.';
      setError(message);
      setShowErrorModal(true);
      setShowSuccessModal(false);
      setModalStep('loading');
    }
  };

  return (
    <div className="login-root">
      <div className="login-card">
        <section className="login-form-area">
          <header className="form-header">
            <h1>Login</h1>
            <p className="form-subtitle">
              BTO-admin managed access for LGU portals across Bohol.
            </p>
          </header>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
          <div className="hero-content">
            <p className="hero-tag">Welcome back</p>
            <h2>Very good works are waiting for you</h2>
            <p className="hero-copy">
              Review tourism requests, manage LGU accounts, and keep Bohol’s
              experiences running smoothly.
            </p>
          </div>

          <div className="hero-figure">
            <img src={heroImage} alt="Tourism officer greeting the viewer" />
          </div>
        </aside>
      </div>

      {showErrorModal && (
        <div className="login-modal-backdrop" role="alertdialog" aria-modal="true" onClick={dismissErrorModal}>
          <div className="login-modal-card" onClick={(event) => event.stopPropagation()}>
            <header className="login-modal-header">
              <h3>Invalid credentials</h3>
              <p>{error || 'Please double-check your email and password.'}</p>
            </header>
            <div className="login-modal-actions">
              <button type="button" className="primary-button" onClick={dismissErrorModal}>
                Try again
              </button>
            </div>
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
