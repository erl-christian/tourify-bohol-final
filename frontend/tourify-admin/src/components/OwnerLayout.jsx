import PropTypes from 'prop-types';
import { NavLink, useNavigate  } from 'react-router-dom';
import { ownerNavSections } from '../data/ownerNavigation';
import '../styles/AdminDashboard.css';
import { signOut } from '../utils/auth';

function OwnerLayout({
  title,
  subtitle,
  searchPlaceholder,
  onSearchSubmit,
  headerActions,
  children,
}) {
  const navigate = useNavigate();

  const handleSearchSubmit = (event) => {
    if (!onSearchSubmit) return;
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSearchSubmit(formData.get('search') || '');
  };
  
    const handleSignOut = () => {
    signOut(navigate);
  };

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-nav">
        <div className="nav-brand">
          <div className="brand-mark">BO</div>
          <div>
            <h2>Business Owner</h2>
            <p>Tourism Partner Portal</p>
          </div>
        </div>

        <nav>
          {ownerNavSections.map((section) => (
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
            <div className="avatar">BO</div>
            <div>
              <p className="user-name">Business Owner</p>
              <p className="user-role">Tourism Establishment</p>
            </div>
          </div>
          <button  type="button" className="logout-cta" onClick={handleSignOut}>
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
                🔍
              </button>
            </form>
          ) : (
            <div />
          )}

          <div className="header-actions">
            {headerActions ?? (
              <>
                <button type="button" className="icon-pill" aria-label="Notifications">
                  🔔
                </button>
                <div className="header-avatar">BO</div>
              </>
            )}
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}

OwnerLayout.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  onSearchSubmit: PropTypes.func,
  headerActions: PropTypes.node,
  children: PropTypes.node.isRequired,
};

export default OwnerLayout;
