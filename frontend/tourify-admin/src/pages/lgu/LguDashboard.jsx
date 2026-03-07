import { useEffect, useMemo, useState } from 'react';
import LguLayout from '../../components/LguLayout';
import '../../styles/AdminDashboard.css';
import LguAnalytics from './Analytics.jsx';
import {
  fetchLguAccounts,
  fetchLguEstablishments,
  fetchLguPendingEstablishments,
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

function LguDashboard() {
  const [municipalityName, setMunicipalityName] = useState('Your Municipality');
  const [accounts, setAccounts] = useState([]);
  const [establishments, setEstablishments] = useState([]);
  const [pendingEstablishments, setPendingEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [accountsRes, establishmentsRes, pendingRes] = await Promise.all([
          fetchLguAccounts(),
          fetchLguEstablishments(),
          fetchLguPendingEstablishments(),
        ]);

        const staff = accountsRes.data?.staff || [];
        setAccounts(staff);
        setEstablishments(normalizeList(establishmentsRes.data));
        setPendingEstablishments(normalizeList(pendingRes.data));

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

  const pendingCount = useMemo(
    () => pendingEstablishments.length,
    [pendingEstablishments],
  );

  const metrics = [
    { label: 'Municipality', value: municipalityName },
    { label: 'LGU Staff', value: staffCount },
    { label: 'Establishment Owners', value: ownerCount },
    { label: 'Approved Establishments', value: approvedCount },
    { label: 'Pending Establishments', value: pendingCount },
  ];

  const resolveTone = (status) =>
    statusToneMap[status] || statusToneMap[status?.toLowerCase()] || 'neutral';

  return (
    <LguLayout
      title={`${municipalityName} Dashboard & Analytics`}
      subtitle={`Logged in as LGU administrator for ${municipalityName}. Review insights, accounts, and pending approvals in one page.`}
      searchPlaceholder="Search municipal metrics..."
    >
      <div className="lgu-merged-content">
        <section className="merged-analytics-block merged-analytics-block--clean">
          <header className="merged-section-head">
            <h2>Municipal Insights</h2>
            <p>Tourist trends, movement patterns, and sentiment for {municipalityName}.</p>
          </header>
          <LguAnalytics embedded />
        </section>

        <section className="merged-management-block lgu-management-block">
          <header className="merged-section-head">
            <h2>Accounts and Approvals</h2>
            <p>Track account coverage and pending establishment actions.</p>
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
                <p>LGU staff and establishment owners currently registered.</p>
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
                    accounts.map((item) => (
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
              </div>
            </section>

            <section className="establishments-section">
              <div className="section-heading">
                <h2>Pending Approvals</h2>
                <p>Submissions needing LGU action.</p>
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
                      <div className="muted">Loading pending items...</div>
                    </li>
                  ) : pendingEstablishments.length === 0 ? (
                    <li className="table-row table-grid table-grid-3">
                      <div className="muted">No pending submissions.</div>
                    </li>
                  ) : (
                    pendingEstablishments.map((item) => (
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
                            {item.status || 'pending'}
                          </span>
                        </div>
                        <div className="muted">
                          {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'N/A'}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </section>
          </div>
        </section>
      </div>
    </LguLayout>
  );
}

export default LguDashboard;
