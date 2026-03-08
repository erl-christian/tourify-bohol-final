import PropTypes from 'prop-types';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { IoNotificationsOutline } from 'react-icons/io5';
import { buildEstablishmentNavSections } from '../data/establishmentNavigation';
import { signOut } from '../utils/auth';
import '../styles/AdminDashboard.css';

function EstablishmentLayout({ title, subtitle, children }) {
  const { estId } = useParams();
  const navigate = useNavigate();
  const navSections = buildEstablishmentNavSections(estId || '');

  const handleSignOut = () => {
    signOut(navigate);
  };

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-nav">
        <div className="nav-brand">
          <div className="brand-mark">ES</div>
          <div>
            <h2>Establishment</h2>
            <p>Operations Workspace</p>
          </div>
        </div>

        <nav>
          {navSections.map(section => (
            <div key={section.title} className="nav-section">
              <span className="section-title">{section.title}</span>
              <ul>
                {section.items.map(item => (
                  <li key={item.id}>
                    <NavLink to={item.path} className="nav-link">
                      <span className="nav-icon" aria-hidden="true">
                        <item.icon />
                      </span>
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="nav-footer">
          <div className="footer-user">
            <div className="avatar">ES</div>
            <div>
              <p className="user-name">Establishment Account</p>
              <p className="user-role">Tourism Business</p>
            </div>
          </div>
          <button type="button" className="logout-cta" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="dashboard-content">
        <header className="page-header">
          <div>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div />
          <div className="header-actions">
            <button type="button" className="icon-pill" aria-label="Notifications">
              <IoNotificationsOutline />
            </button>
            <div className="header-avatar">ES</div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

EstablishmentLayout.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  children: PropTypes.node.isRequired,
};

export default EstablishmentLayout;
