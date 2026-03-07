import PropTypes from 'prop-types';
import { NavLink } from 'react-router-dom';
import { IoNotificationsOutline, IoSearchOutline } from 'react-icons/io5';
import { adminNavSections } from '../data/adminNavigation';
import '../styles/AdminDashboard.css';
import { useNavigate } from 'react-router-dom';
import { signOut } from '../utils/auth';


function AdminLayout({
  title,
  subtitle,
  searchPlaceholder,
  onSearchSubmit,
  headerActions,
  children,
}) {
const handleSearchSubmit = (event) => {
  if (!onSearchSubmit) return;
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  onSearchSubmit(formData.get('search') || '');
};

const navigate = useNavigate();
const handleSignOut = () => signOut(navigate);
const getInitials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'TB';
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
};

const sessionRole = sessionStorage.getItem('mockRole') || '';
const displayName =
  sessionStorage.getItem('mockDisplayName') ||
  (sessionRole === 'bto_staff' ? 'BTO Staff' : 'BTO Admin');
const displayRole =
  sessionStorage.getItem('mockDisplayRole') ||
  (sessionRole === 'bto_staff' ? 'BTO Staff' : 'BTO Head Administrator');

const avatarInitials = getInitials(displayName);

return (
    <div className="dashboard-shell">
      <aside className="dashboard-nav">
        <div className="nav-brand">
          <div className="brand-mark">TB</div>
          <div>
            <h2>Tourify BTO</h2>
            <p>Provincial Control Center</p>
          </div>
        </div>

        <nav>
          {adminNavSections.map((section) => (
            <div key={section.title} className="nav-section">
              <span className="section-title">{section.title}</span>
              <ul>
                {section.items.map((item) => (
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
            <div className="avatar">{avatarInitials}</div>
            <div>
              <p className="user-name">{displayName}</p>
              <p className="user-role">{displayRole}</p>
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
            {subtitle && <p>{subtitle}</p>}
          </div>

          {searchPlaceholder ? (
            <form className="search-field" role="search" onSubmit={handleSearchSubmit}>
              <input name="search" type="search" placeholder={searchPlaceholder} />
              <button type="submit" aria-label="Search">
                <IoSearchOutline />
              </button>
            </form>
          ) : (
            <div />
          )}

          <div className="header-actions">
            {headerActions ?? (
              <>
                <button type="button" className="icon-pill" aria-label="Notifications">
                  <IoNotificationsOutline />
                </button>
                <div className="header-avatar">{avatarInitials}</div>
              </>
            )}
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}

AdminLayout.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  onSearchSubmit: PropTypes.func,
  headerActions: PropTypes.node,
  children: PropTypes.node.isRequired,
  
};

export default AdminLayout;

