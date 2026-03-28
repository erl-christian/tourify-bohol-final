import { useEffect, useMemo, useState } from 'react';
import LguLayout from '../../components/LguLayout';
import '../../styles/AdminDashboard.css';
import LguAnalytics from './Analytics.jsx';
import {
  fetchLguAccounts,
  fetchLguEstablishments,
} from '../../services/lguApi';

const statusToneMap = {
  verified: 'success',
  approved: 'success',
  pending: 'warning',
  NeedsReview: 'warning',
  needs_review: 'review',
  rejected: 'danger',
};

const normalizeList = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
};

const ACCOUNT_PAGE_SIZE = 8;
const ESTABLISHMENT_PAGE_SIZE = 8;
const accountTabs = [
  { id: 'all', label: 'All' },
  { id: 'admin_staff', label: 'Admin & Staff' },
  { id: 'business_establishment', label: 'Owners' },
];

function LguDashboard() {
  const [municipalityName, setMunicipalityName] = useState('Your Municipality');
  const [accounts, setAccounts] = useState([]);
  const [establishments, setEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accountPage, setAccountPage] = useState(1);
  const [establishmentPage, setEstablishmentPage] = useState(1);
  const [activeAccountTab, setActiveAccountTab] = useState('all');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [accountsRes, establishmentsRes] = await Promise.all([
          fetchLguAccounts(),
          fetchLguEstablishments(),
        ]);

        const staff = accountsRes.data?.staff || [];
        setAccounts(staff);
        setEstablishments(normalizeList(establishmentsRes.data));

        const firstProfile = staff[0]?.profile;
        if (firstProfile?.municipality_name) {
          setMunicipalityName(firstProfile.municipality_name);
        } else if (firstProfile?.municipality_id) {
          setMunicipalityName(firstProfile.municipality_id);
        }
        setError('');
      } catch (err) {
        console.error('Failed to load LGU overview', err);
        setError('Unable to load municipal data right now.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const staffCount = useMemo(
    () => accounts.filter((item) => item.account?.role === 'lgu_staff').length,
    [accounts],
  );

  const ownerCount = useMemo(
    () =>
      accounts.filter((item) => item.account?.role === 'business_establishment')
        .length,
    [accounts],
  );

  const approvedCount = useMemo(
    () =>
      establishments.filter((item) =>
        ['approved', 'verified'].includes(item.status?.toLowerCase()),
      ).length,
    [establishments],
  );

  const totalEstablishments = establishments.length;

  const recentEstablishments = useMemo(
    () =>
      [...establishments]
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)),
    [establishments],
  );

  const accountRoleCounts = useMemo(
    () =>
      accounts.reduce(
        (acc, item) => {
          const role = item.account?.role || 'unknown';
          acc.all += 1;
          if (role === 'lgu_admin' || role === 'lgu_staff') {
            acc.admin_staff += 1;
          }
          if (role === 'business_establishment') {
            acc.business_establishment += 1;
          }
          return acc;
        },
        { all: 0, admin_staff: 0, business_establishment: 0 },
      ),
    [accounts],
  );

  const filteredAccounts = useMemo(
    () =>
      activeAccountTab === 'all'
        ? accounts
        : activeAccountTab === 'admin_staff'
        ? accounts.filter(
            (item) => item.account?.role === 'lgu_admin' || item.account?.role === 'lgu_staff',
          )
        : accounts.filter((item) => item.account?.role === activeAccountTab),
    [accounts, activeAccountTab],
  );

  const accountTotalPages = Math.max(1, Math.ceil(filteredAccounts.length / ACCOUNT_PAGE_SIZE));
  const safeAccountPage = Math.min(accountPage, accountTotalPages);
  const pagedAccounts = useMemo(() => {
    const start = (safeAccountPage - 1) * ACCOUNT_PAGE_SIZE;
    return filteredAccounts.slice(start, start + ACCOUNT_PAGE_SIZE);
  }, [filteredAccounts, safeAccountPage]);
  const accountRangeStart = filteredAccounts.length
    ? (safeAccountPage - 1) * ACCOUNT_PAGE_SIZE + 1
    : 0;
  const accountRangeEnd = filteredAccounts.length
    ? Math.min(safeAccountPage * ACCOUNT_PAGE_SIZE, filteredAccounts.length)
    : 0;

  const establishmentTotalPages = Math.max(
    1,
    Math.ceil(recentEstablishments.length / ESTABLISHMENT_PAGE_SIZE),
  );
  const safeEstablishmentPage = Math.min(establishmentPage, establishmentTotalPages);
  const pagedRecentEstablishments = useMemo(() => {
    const start = (safeEstablishmentPage - 1) * ESTABLISHMENT_PAGE_SIZE;
    return recentEstablishments.slice(start, start + ESTABLISHMENT_PAGE_SIZE);
  }, [recentEstablishments, safeEstablishmentPage]);
  const establishmentRangeStart = recentEstablishments.length
    ? (safeEstablishmentPage - 1) * ESTABLISHMENT_PAGE_SIZE + 1
    : 0;
  const establishmentRangeEnd = recentEstablishments.length
    ? Math.min(safeEstablishmentPage * ESTABLISHMENT_PAGE_SIZE, recentEstablishments.length)
    : 0;

  useEffect(() => {
    if (accountPage > accountTotalPages) {
      setAccountPage(accountTotalPages);
    }
  }, [accountPage, accountTotalPages]);

  useEffect(() => {
    setAccountPage(1);
  }, [activeAccountTab]);

  useEffect(() => {
    if (establishmentPage > establishmentTotalPages) {
      setEstablishmentPage(establishmentTotalPages);
    }
  }, [establishmentPage, establishmentTotalPages]);

  const metrics = [
    { label: 'Municipality', value: municipalityName },
    { label: 'LGU Staff', value: staffCount },
    { label: 'Establishment Owners', value: ownerCount },
    { label: 'Total Establishments', value: totalEstablishments },
    { label: 'Approved Establishments', value: approvedCount },
  ];

  const dashboardHighlights = useMemo(
    () => [
      {
        id: 'municipality',
        label: 'Municipality',
        value: municipalityName,
        hint: 'Active LGU workspace',
      },
      {
        id: 'staff-count',
        label: 'LGU Staff',
        value: staffCount,
        hint: 'Municipal support officers',
      },
      {
        id: 'owner-count',
        label: 'Establishment Owners',
        value: ownerCount,
        hint: 'Business owner accounts',
      },
      {
        id: 'establishment-count',
        label: 'Registered Establishments',
        value: totalEstablishments,
        hint: `${approvedCount} approved/verified`,
      },
    ],
    [municipalityName, staffCount, ownerCount, totalEstablishments, approvedCount],
  );

  const resolveTone = (status) =>
    statusToneMap[status] || statusToneMap[status?.toLowerCase()] || 'neutral';

  return (
    <LguLayout
      title={`${municipalityName} Dashboard & Analytics`}
      subtitle={`Logged in as LGU administrator for ${municipalityName}. Review insights, accounts, and establishments in one page.`}
    >
      <div className="bto-merged-content bto-merged-content--clean">
        <section className="bto-overview-strip">
          <header className="merged-section-head bto-overview-head">
            <h2>Dashboard Overview</h2>
            <p>Quick municipal snapshot with direct access to operations and analytics.</p>
          </header>
          <div className="bto-overview-actions">
            <a href="#lgu-operations-accounts-section" className="ghost-cta bto-link-cta">
              Go to Operations
            </a>
            <a href="#lgu-analytics-insights-section" className="ghost-cta bto-link-cta">
              Go to Analytics
            </a>
          </div>
          <div className="bto-overview-grid">
            {dashboardHighlights.map((item) => (
              <article key={item.id} className="bto-overview-card">
                <p className="bto-overview-label">{item.label}</p>
                <h3>{item.value}</h3>
                <p className="bto-overview-hint">{item.hint}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="lgu-operations-accounts-section"
          className="merged-management-block merged-management-block--clean lgu-management-block"
        >
          <header className="merged-section-head">
            <h2>Operations and Accounts</h2>
            <p>Track account coverage and establishment updates for {municipalityName}.</p>
          </header>

          <section className="account-management">
            <div className="section-heading">
              <h2>Key Municipal Metrics</h2>
              <p>
                Live snapshot for {municipalityName}. These numbers update as accounts and establishments change.
              </p>
            </div>

            {loading ? (
              <div className="muted">Loading overview...</div>
            ) : error ? (
              <div className="muted">{error}</div>
            ) : (
              <div className="table-shell">
                <div className="table-head table-grid table-grid-2">
                  <span>Metric</span>
                  <span>Value</span>
                </div>

                <ul className="table-body">
                  {metrics.map((metric) => (
                    <li key={metric.label} className="table-row table-grid table-grid-2">
                      <span>{metric.label}</span>
                      <span>{metric.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <div className="account-establishment-grid account-establishment-grid--clean">
            <section className="account-management">
              <div className="section-heading">
                <h2>Accounts in Municipality</h2>
                <p>LGU admin/staff and establishment owners currently registered.</p>
              </div>

              <div className="account-controls">
                <div className="tab-group">
                  {accountTabs.map((tab) => (
                    <button
                      type="button"
                      key={tab.id}
                      className={`tab-button ${activeAccountTab === tab.id ? 'active' : ''}`}
                      onClick={() => setActiveAccountTab(tab.id)}
                    >
                      {tab.label}
                      <span className="tab-count">
                        {tab.id === 'all' ? accountRoleCounts.all : accountRoleCounts[tab.id] || 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="table-shell">
                <div className="table-head table-grid table-grid-3">
                  <span>Name</span>
                  <span>Role</span>
                  <span>Last Activity</span>
                </div>

                <ul className="table-body">
                  {loading ? (
                    <li className="table-row table-grid table-grid-3">
                      <div className="muted">Loading accounts...</div>
                    </li>
                  ) : error ? (
                    <li className="table-row table-grid table-grid-3">
                      <div className="muted">{error}</div>
                    </li>
                  ) : accounts.length === 0 ? (
                    <li className="table-row table-grid table-grid-3">
                      <div className="muted">No accounts found.</div>
                    </li>
                  ) : (
                    pagedAccounts.map((item) => (
                      <li
                        key={item.account?.account_id}
                        className="table-row table-grid table-grid-3"
                      >
                        <div className="account-cell">
                          <p className="account-name">
                            {item.profile?.full_name || item.account?.email}
                          </p>
                          <p className="account-email">{item.account?.email}</p>
                        </div>
                        <div className="muted">
                          {item.account?.role === 'business_establishment'
                            ? 'Establishment Owner'
                            : item.account?.role === 'lgu_staff'
                            ? 'LGU Staff'
                            : item.account?.role}
                        </div>
                        <div className="muted">
                          {item.account?.updatedAt
                            ? new Date(item.account.updatedAt).toLocaleString()
                            : 'N/A'}
                        </div>
                      </li>
                    ))
                  )}
                </ul>

                <div className="pagination-bar">
                  <span className="pagination-info">
                    Showing {accountRangeStart}-{accountRangeEnd} of {filteredAccounts.length}
                  </span>
                  <div className="pagination-controls">
                    <button
                      type="button"
                      className="pagination-button"
                      onClick={() => setAccountPage((prev) => Math.max(prev - 1, 1))}
                      disabled={safeAccountPage <= 1}
                    >
                      Prev
                    </button>
                    <span className="pagination-page">
                      Page {safeAccountPage} of {accountTotalPages}
                    </span>
                    <button
                      type="button"
                      className="pagination-button"
                      onClick={() =>
                        setAccountPage((prev) => Math.min(prev + 1, accountTotalPages))
                      }
                      disabled={safeAccountPage >= accountTotalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="establishments-section">
              <div className="section-heading">
                <h2>Recent Establishment Updates</h2>
                <p>Latest establishments created and updated in your municipality.</p>
              </div>

              <div className="table-shell">
                <div className="table-head table-grid table-grid-3">
                  <span>Establishment</span>
                  <span>Status</span>
                  <span>Submitted</span>
                </div>

                <ul className="table-body">
                  {loading ? (
                    <li className="table-row table-grid table-grid-3">
                      <div className="muted">Loading establishments...</div>
                    </li>
                  ) : recentEstablishments.length === 0 ? (
                    <li className="table-row table-grid table-grid-3">
                      <div className="muted">No establishments yet.</div>
                    </li>
                  ) : (
                    pagedRecentEstablishments.map((item) => (
                      <li
                        key={item.businessEstablishment_id || item.id}
                        className="table-row table-grid table-grid-3"
                      >
                        <div className="account-cell">
                          <p className="account-name">{item.name}</p>
                          <p className="account-email">
                            ID: {item.businessEstablishment_id || item.id}
                          </p>
                        </div>
                        <div>
                          <span className={`status-chip status-${resolveTone(item.status)}`}>
                            {item.status || 'approved'}
                          </span>
                        </div>
                        <div className="muted">
                          {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'N/A'}
                        </div>
                      </li>
                    ))
                  )}
                </ul>

                <div className="pagination-bar">
                  <span className="pagination-info">
                    Showing {establishmentRangeStart}-{establishmentRangeEnd} of{' '}
                    {recentEstablishments.length}
                  </span>
                  <div className="pagination-controls">
                    <button
                      type="button"
                      className="pagination-button"
                      onClick={() => setEstablishmentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={safeEstablishmentPage <= 1}
                    >
                      Prev
                    </button>
                    <span className="pagination-page">
                      Page {safeEstablishmentPage} of {establishmentTotalPages}
                    </span>
                    <button
                      type="button"
                      className="pagination-button"
                      onClick={() =>
                        setEstablishmentPage((prev) =>
                          Math.min(prev + 1, establishmentTotalPages),
                        )
                      }
                      disabled={safeEstablishmentPage >= establishmentTotalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section
          id="lgu-analytics-insights-section"
          className="merged-analytics-block merged-analytics-block--clean"
        >
          <header className="merged-section-head">
            <h2>Analytics Insights</h2>
            <p>Tourist trends, movement patterns, and sentiment for {municipalityName}.</p>
          </header>
          <LguAnalytics embedded />
        </section>
      </div>
    </LguLayout>
  );
}

export default LguDashboard;
