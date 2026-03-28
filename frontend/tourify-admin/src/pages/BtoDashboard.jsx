import { useCallback, useEffect, useMemo, useState } from 'react';
import '../styles/AdminDashboard.css';
import {
  IoDownloadOutline,
  IoNotificationsOutline,
  IoPrintOutline,
  IoQrCodeOutline,
} from 'react-icons/io5';
import AdminLayout from '../components/AdminLayout';
import {
  fetchAdminStaffProfiles,
  fetchAllEstablishments,
  createLguAdmin,
  fetchMunicipalities,
  generateArrivalQr as generateArrivalQrRequest,
  // updateLguAdmin,
} from '../services/btoApi';
import { useActionStatus } from '../context/ActionStatusContext';
import AdminAnalytics from './admin/Analytics';

const accountTabs = [
  { id: 'all', label: 'All Accounts' },
  { id: 'lgu_admin', label: 'LGU Admins' },
  { id: 'lgu_staff', label: 'LGU Staff' },
  { id: 'business_establishment', label: 'Owners' },  // <-- use backend role
];

const initialAdminForm = {
  fullName: '',
  username: '',
  email: '',
  municipalityId: '',
  phone: '',
  notes: '',
};

const initialArrivalQrForm = {
  entryPointType: 'airport',
  entryPointName: 'Bohol-Panglao International Airport',
  qrCodeId: '',
};

const ACCOUNT_PAGE_SIZE = 8;
const ESTABLISHMENT_PAGE_SIZE = 8;

const slugifyFilename = value =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'bohol-arrival';

const escapeHtml = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const statusToneMap = {
  Active: 'success',
  Verified: 'success',
  pending: 'warning',
  Pending: 'warning',
  'Pending audit': 'warning',
  'For approval': 'review',
  'needs_review': 'review',
  'Needs review': 'review',
  Suspended: 'danger',
};

function BtoDashboard() {
  const [activeTab, setActiveTab] = useState('all');
  const [accountPage, setAccountPage] = useState(1);
  const [establishmentPage, setEstablishmentPage] = useState(1);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [adminForm, setAdminForm] = useState(initialAdminForm);

  const [staff, setStaff] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState('');

  const [establishments, setEstablishments] = useState([]);
  const [loadingEstablishments, setLoadingEstablishments] = useState(true);
  const [establishmentsError, setEstablishmentsError] = useState('');

  const [submittingAdmin, setSubmittingAdmin] = useState(false);
  const { showLoading, showSuccess, showError } = useActionStatus();

  const [municipalities, setMunicipalities] = useState([]);
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(true);
  const [isArrivalQrModalOpen, setArrivalQrModalOpen] = useState(false);
  const [arrivalQrForm, setArrivalQrForm] = useState(initialArrivalQrForm);
  const [arrivalQrResult, setArrivalQrResult] = useState(null);
  const [generatingArrivalQr, setGeneratingArrivalQr] = useState(false);

  const handlePrintDashboard = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.print();
  }, []);

  const openArrivalQrModal = useCallback(() => {
    setArrivalQrForm(initialArrivalQrForm);
    setArrivalQrResult(null);
    setArrivalQrModalOpen(true);
  }, []);

  const closeArrivalQrModal = useCallback(() => {
    setArrivalQrModalOpen(false);
  }, []);

  const handleArrivalQrFormChange = useCallback((event) => {
    const { name, value } = event.target;
    setArrivalQrForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleGenerateArrivalQr = useCallback(
    async (event) => {
      event.preventDefault();
      setGeneratingArrivalQr(true);
      showLoading('Generating arrival QR...');
      try {
        const { data } = await generateArrivalQrRequest({
          entry_point_type: arrivalQrForm.entryPointType,
          entry_point_name: arrivalQrForm.entryPointName,
          qr_code_id: arrivalQrForm.qrCodeId || undefined,
        });
        setArrivalQrResult(data);
        showSuccess('Arrival QR ready for download/print.');
      } catch (error) {
        showError(error.response?.data?.message || 'Unable to generate arrival QR.');
      } finally {
        setGeneratingArrivalQr(false);
      }
    },
    [arrivalQrForm, showError, showLoading, showSuccess],
  );

  const handleDownloadArrivalQr = useCallback(() => {
    if (!arrivalQrResult?.data_url || typeof document === 'undefined') return;
    const link = document.createElement('a');
    link.href = arrivalQrResult.data_url;
    link.download = `tourify-arrival-qr-${slugifyFilename(
      arrivalQrResult?.payload?.entry_point_name || arrivalQrForm.entryPointName,
    )}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [arrivalQrResult, arrivalQrForm.entryPointName]);

  const handlePrintArrivalQr = useCallback(() => {
    if (!arrivalQrResult?.data_url || typeof window === 'undefined') return;

    const payload = arrivalQrResult?.payload || {};
    const qrTitle = `${payload.entry_point_name || arrivalQrForm.entryPointName} (${(
      payload.entry_point_type || arrivalQrForm.entryPointType || 'other'
    ).toUpperCase()})`;

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000');
    if (!printWindow) {
      showError('Please allow popups to print the arrival QR.');
      return;
    }

    printWindow.document.write(`<!doctype html>
<html>
  <head>
    <title>Tourify Arrival QR</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
      h1 { font-size: 20px; margin: 0 0 6px; }
      p { margin: 0 0 8px; color: #334155; }
      .qr-wrap { margin-top: 14px; }
      img { width: 420px; height: 420px; object-fit: contain; border: 1px solid #cbd5e1; padding: 8px; }
      .meta { margin-top: 10px; font-size: 13px; color: #475569; }
    </style>
  </head>
  <body>
    <h1>Tourify Tourist Arrival QR</h1>
    <p>${escapeHtml(qrTitle)}</p>
    <div class="qr-wrap">
      <img src="${arrivalQrResult.data_url}" alt="Tourify Arrival QR" />
    </div>
    <div class="meta">QR Code ID: ${escapeHtml(payload.qr_code_id || 'arrival-qr')}</div>
  </body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }, [arrivalQrResult, arrivalQrForm.entryPointName, arrivalQrForm.entryPointType, showError]);


  const displayInitials = (() => {
    const name = sessionStorage.getItem('mockDisplayName') || 'BTO';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'BT';
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  })();

  const normalizeMunicipalityPayload = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    if (Array.isArray(raw?.data)) return raw.data;
    if (Array.isArray(raw?.municipalities)) return raw.municipalities;
    if (raw && typeof raw === 'object') {
      return Object.values(raw);
    }
    return [];
  };

  const loadData = useCallback(async () => {
    try {
      setLoadingStaff(true);
      setLoadingEstablishments(true);
      setLoadingMunicipalities(true);

      const loadAllEstablishments = async () => {
        const limit = 100;
        let page = 1;
        let total = 0;
        const allItems = [];

        while (page <= 200) {
          const { data } = await fetchAllEstablishments({ page, limit });
          const pagedItems = Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data)
            ? data
            : [];

          allItems.push(...pagedItems);

          if (!Array.isArray(data?.items)) {
            break;
          }

          total = Number(data?.total) || allItems.length;
          if (!pagedItems.length || allItems.length >= total) {
            break;
          }

          page += 1;
        }

        return allItems;
      };

      const [staffRes, establishmentsRes, muniRes] = await Promise.all([
        fetchAdminStaffProfiles(),
        loadAllEstablishments(),
        fetchMunicipalities(),
      ]);

      setStaff(staffRes.data?.staff || []);
      setEstablishments(establishmentsRes || []);
      setMunicipalities(normalizeMunicipalityPayload(muniRes?.data));
      setStaffError('');
      setEstablishmentsError('');
    } catch (error) {
      console.error('Failed to load dashboard data', error);
      setStaffError('Unable to load accounts right now.');
      setEstablishmentsError('Unable to load establishments.');
    } finally {
      setLoadingStaff(false);
      setLoadingEstablishments(false);
      setLoadingMunicipalities(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const accounts = useMemo(
    () =>
      staff.map(({ account, profile }) => ({
        id: account.account_id,
        name: profile?.full_name ?? account.email,
        email: account.email,
        municipalityId: profile?.municipality_id ?? '',
        municipality: profile?.municipality_id ?? 'Not assigned',
        roleId: account.role,
        role:
          account.role === 'lgu_admin'
            ? 'LGU Admin'
            : account.role === 'lgu_staff'
            ? 'LGU Staff'
            : account.role === 'business_establishment'
            ? 'Owner'
            : account.role,
        status: 'Active',
        lastSeen: account.updatedAt
          ? new Date(account.updatedAt).toLocaleString()
          : '…',
      })),
    [staff],
  );

  const establishmentRows = useMemo(
    () =>
      establishments.map((est) => ({
        id: est.businessEstablishment_id || est.id,
        name: est.name,
        municipality: est.municipality_id || est.municipality || '—',
        category: est.type || est.category || '—',
        status: est.status,
        nextAction:
          est.status === 'pending'
            ? 'Awaiting validation'
            : est.status === 'needs_review'
            ? 'Check feedback'
            : '—',
      })),
    [establishments],
  );

  const roleCounts = useMemo(
    () =>
      accounts.reduce(
        (acc, account) => {
          const key = account.roleId || 'unknown';
          acc.all += 1;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        },
        { all: 0 },
      ),
    [accounts],
  );

  const filteredAccounts = useMemo(
    () =>
      activeTab === 'all'
        ? accounts
        : accounts.filter((account) => account.roleId === activeTab),
    [accounts, activeTab],
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
    Math.ceil(establishmentRows.length / ESTABLISHMENT_PAGE_SIZE),
  );
  const safeEstablishmentPage = Math.min(establishmentPage, establishmentTotalPages);
  const pagedEstablishments = useMemo(() => {
    const start = (safeEstablishmentPage - 1) * ESTABLISHMENT_PAGE_SIZE;
    return establishmentRows.slice(start, start + ESTABLISHMENT_PAGE_SIZE);
  }, [establishmentRows, safeEstablishmentPage]);
  const establishmentRangeStart = establishmentRows.length
    ? (safeEstablishmentPage - 1) * ESTABLISHMENT_PAGE_SIZE + 1
    : 0;
  const establishmentRangeEnd = establishmentRows.length
    ? Math.min(safeEstablishmentPage * ESTABLISHMENT_PAGE_SIZE, establishmentRows.length)
    : 0;

  useEffect(() => {
    setAccountPage(1);
  }, [activeTab]);

  useEffect(() => {
    if (accountPage > accountTotalPages) {
      setAccountPage(accountTotalPages);
    }
  }, [accountPage, accountTotalPages]);

  useEffect(() => {
    if (establishmentPage > establishmentTotalPages) {
      setEstablishmentPage(establishmentTotalPages);
    }
  }, [establishmentPage, establishmentTotalPages]);

  const activeTabMeta = accountTabs.find((tab) => tab.id === activeTab);
  const currentCount =
    activeTab === 'all' ? roleCounts.all : roleCounts[activeTab] || 0;

  const dashboardHighlights = useMemo(() => {
    const pendingEstablishments = establishmentRows.filter((item) =>
      ['pending', 'needs_admin_review', 'needs_owner_revision'].includes(
        String(item.status || '').toLowerCase(),
      ),
    ).length;

    return [
      {
        id: 'accounts-total',
        label: 'Total Accounts',
        value: roleCounts.all || 0,
        hint: 'All active provincial accounts',
      },
      {
        id: 'lgu-admins',
        label: 'LGU Admins',
        value: roleCounts.lgu_admin || 0,
        hint: 'Municipal tourism leads',
      },
      {
        id: 'establishments-total',
        label: 'Registered Establishments',
        value: establishmentRows.length,
        hint: 'Across all municipalities',
      },
      {
        id: 'establishments-pending',
        label: 'Pending Reviews',
        value: pendingEstablishments,
        hint: 'Needs follow-up action',
      },
    ];
  }, [establishmentRows, roleCounts]);

  const resolveStatusTone = (status) =>
    statusToneMap[status] || statusToneMap[status?.toLowerCase()] || 'neutral';

  const openCreateModal = () => {
    setAdminForm(initialAdminForm);
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
  };

  const handleAdminFormChange = (event) => {
    const { name, value } = event.target;
    setAdminForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

    const handleCreateAdmin = async (event) => {
    event.preventDefault();
    setSubmittingAdmin(true);
    showLoading('Creating LGU admin account...');

    try {
      await createLguAdmin({
        username: adminForm.username.trim(),
        email: adminForm.email.trim(),
        full_name: adminForm.fullName.trim(),
        municipality_id: adminForm.municipalityId,
      });

      showSuccess(`LGU admin ${adminForm.fullName} has been created.`);

      setAdminForm(initialAdminForm);
      setCreateModalOpen(false);
      await loadData();
    } catch (error) {
      showError(error.response?.data?.message || 'Unable to create LGU admin. Please try again.');
    } finally {
      setSubmittingAdmin(false);
    }
  };


  return (
    <AdminLayout
      title="Dashboard & Analytics"
      subtitle="Provincial overview, analytics insights, and account management in one page."
      headerActions={
        <>
          <button
            type="button"
            className="icon-pill no-print"
            aria-label="Generate Arrival QR"
            title="Generate Arrival QR"
            onClick={openArrivalQrModal}
          >
            <IoQrCodeOutline />
          </button>
          <button
            type="button"
            className="icon-pill no-print"
            aria-label="Print Dashboard and Analytics"
            title="Print Dashboard and Analytics"
            onClick={handlePrintDashboard}
          >
            <IoPrintOutline />
          </button>
          <button type="button" className="icon-pill" aria-label="Notifications">
            <IoNotificationsOutline />
          </button>
          <div className="header-avatar">{displayInitials}</div>
        </>
      }
      >
        <div className="bto-merged-content bto-merged-content--clean">
          <section className="bto-overview-strip">
            <header className="merged-section-head bto-overview-head">
              <h2>Dashboard Overview</h2>
              <p>Quick access to operations and analytics in one clean workflow.</p>
            </header>
            <div className="bto-overview-actions">
              <a href="#operations-accounts-section" className="ghost-cta bto-link-cta">
                Go to Operations
              </a>
              <a href="#analytics-insights-section" className="primary-cta bto-link-cta">
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

          <section id="operations-accounts-section" className="merged-management-block">
            <header className="merged-section-head">
              <h2>Operations and Accounts</h2>
              <p>Manage LGU accounts and monitor registered establishments.</p>
            </header>

            <div className="account-establishment-grid account-establishment-grid--clean">
              <section className="account-management">
                <div className="section-heading">
                  <h2>All Accounts</h2>
                  <p>
                    Showing {currentCount}{' '}
                    {activeTabMeta ? activeTabMeta.label.toLowerCase() : 'accounts'}. Use filters to
                    focus on a specific role.
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

                  <div className="account-actions">
                    <button type="button" className="primary-cta" onClick={openCreateModal}>
                      Pre-register LGU Admin
                    </button>
                    <button type="button" className="ghost-cta">
                      Export CSV
                    </button>
                  </div>
                </div>

                <div className="table-shell scrollable-table">
                  <div className="table-head table-grid">
                    <span>Name</span>
                    <span>Municipality</span>
                    <span>Role</span>
                    <span>Status</span>
                    <span>Last Activity</span>
                  </div>

                  <ul className="table-body">
                    {loadingStaff ? (
                      <li className="table-row table-grid">
                        <div className="muted">Loading accounts…</div>
                      </li>
                    ) : staffError ? (
                      <li className="table-row table-grid">
                        <div className="muted">{staffError}</div>
                      </li>
                    ) : filteredAccounts.length === 0 ? (
                      <li className="table-row table-grid">
                        <div className="muted">No accounts found for this filter.</div>
                      </li>
                    ) : (
                      pagedAccounts.map((account) => (
                        <li key={account.id} className="table-row table-grid">
                          <div className="account-cell">
                            <p className="account-name">{account.name}</p>
                            <p className="account-email">{account.email}</p>
                          </div>
                          <div className="muted">{account.municipality}</div>
                          <div>
                            <span className="role-chip">{account.role}</span>
                          </div>
                          <div>
                            <span className={`status-chip status-${resolveStatusTone(account.status)}`}>
                              {account.status}
                            </span>
                          </div>
                          <div className="muted">{account.lastSeen}</div>
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
                  <h2>Registered Establishments</h2>
                  <p>Track verification and compliance requirements for all Bohol tourism operators.</p>
                </div>

                <div className="table-shell scrollable-table">
                  <div className="table-head table-grid">
                    <span>Establishment</span>
                    <span>Municipality</span>
                    <span>Category</span>
                    <span>Status</span>
                    <span>Next Action</span>
                  </div>

                  <ul className="table-body">
                    {loadingEstablishments ? (
                      <li className="table-row table-grid">
                        <div className="muted">Loading establishments…</div>
                      </li>
                    ) : establishmentsError ? (
                      <li className="table-row table-grid">
                        <div className="muted">{establishmentsError}</div>
                      </li>
                    ) : establishmentRows.length === 0 ? (
                      <li className="table-row table-grid">
                        <div className="muted">No establishments found.</div>
                      </li>
                    ) : (
                      pagedEstablishments.map((item) => (
                        <li key={item.id} className="table-row table-grid">
                          <div className="account-cell">
                            <p className="account-name">{item.name}</p>
                            <p className="account-email">ID: {item.id}</p>
                          </div>
                          <div className="muted">{item.municipality}</div>
                          <div>
                            <span className="role-chip role-muted">{item.category}</span>
                          </div>
                          <div>
                            <span className={`status-chip status-${resolveStatusTone(item.status)}`}>
                              {item.status}
                            </span>
                          </div>
                          <div className="muted">{item.nextAction}</div>
                        </li>
                      ))
                    )}
                  </ul>

                  <div className="pagination-bar">
                    <span className="pagination-info">
                      Showing {establishmentRangeStart}-{establishmentRangeEnd} of{' '}
                      {establishmentRows.length}
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
            id="analytics-insights-section"
            className="merged-analytics-block merged-analytics-block--clean"
          >
            <header className="merged-section-head">
              <h2>Analytics Insights</h2>
              <p>Tourism trends, visitor movement, and service sentiment in one view.</p>
            </header>
            <AdminAnalytics embedded />
          </section>
        </div>
        {isArrivalQrModalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arrivalQrTitle"
        >
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3 id="arrivalQrTitle">Tourist Arrival QR</h3>
                <p>
                  Generate QR for Bohol arrival entry points (airport/seaport). Tourists scan this on
                  arrival to record entry.
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={closeArrivalQrModal}
              >
                ×
              </button>
            </header>

            <div className="modal-content">
              <form className="modal-form" onSubmit={handleGenerateArrivalQr}>
                <div className="form-row form-grid">
                  <div>
                    <label className="form-label" htmlFor="arrival-entry-type">
                      Entry point type
                    </label>
                    <select
                      id="arrival-entry-type"
                      name="entryPointType"
                      value={arrivalQrForm.entryPointType}
                      onChange={handleArrivalQrFormChange}
                      required
                    >
                      <option value="airport">Airport</option>
                      <option value="seaport">Seaport</option>
                      <option value="landport">Landport</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="arrival-entry-name">
                      Entry point name
                    </label>
                    <input
                      id="arrival-entry-name"
                      name="entryPointName"
                      type="text"
                      required
                      value={arrivalQrForm.entryPointName}
                      onChange={handleArrivalQrFormChange}
                      placeholder="Tagbilaran Seaport"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="arrival-qr-code-id">
                    QR Code ID (optional)
                  </label>
                  <input
                    id="arrival-qr-code-id"
                    name="qrCodeId"
                    type="text"
                    value={arrivalQrForm.qrCodeId}
                    onChange={handleArrivalQrFormChange}
                    placeholder="arrival-airport-bohol-panglao"
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="ghost-cta" onClick={closeArrivalQrModal}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-cta" disabled={generatingArrivalQr}>
                    {generatingArrivalQr ? 'Generating…' : 'Generate QR'}
                  </button>
                </div>
              </form>

              {arrivalQrResult?.data_url ? (
                <div className="arrival-qr-preview">
                  <div className="arrival-qr-image-wrap">
                    <img
                      src={arrivalQrResult.data_url}
                      alt="Tourify Tourist Arrival QR"
                      className="arrival-qr-image"
                    />
                  </div>
                  <div className="arrival-qr-meta">
                    <p>
                      <strong>Entry:</strong> {arrivalQrResult?.payload?.entry_point_name}
                    </p>
                    <p>
                      <strong>Type:</strong>{' '}
                      {String(arrivalQrResult?.payload?.entry_point_type || 'other').toUpperCase()}
                    </p>
                    <p>
                      <strong>QR Code ID:</strong> {arrivalQrResult?.payload?.qr_code_id}
                    </p>
                  </div>

                  <div className="arrival-qr-actions">
                    <button type="button" className="ghost-cta" onClick={handleDownloadArrivalQr}>
                      <IoDownloadOutline />
                      Save as PNG
                    </button>
                    <button type="button" className="primary-cta" onClick={handlePrintArrivalQr}>
                      <IoPrintOutline />
                      Print QR
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {isCreateModalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="createAdminTitle"
        >
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3 id="createAdminTitle">Pre-register LGU Administrator</h3>
                <p>
                  Generate an invitation for the municipal tourism head. They will complete the setup upon receiving the email.
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={closeCreateModal}
              >
                ×
              </button>
            </header>

            <div className="modal-content">
              <form className="modal-form" onSubmit={handleCreateAdmin}>
                <div className="form-row">
                  <label className="form-label" htmlFor="admin-fullName">
                    Full name
                  </label>
                  <input
                    id="admin-fullName"
                    name="fullName"
                    type="text"
                    required
                    placeholder="Maria Cortez"
                    value={adminForm.fullName}
                    onChange={handleAdminFormChange}
                  />
                </div>

                <div className="form-row form-grid">
                  <div>
                    <label className="form-label" htmlFor="admin-username">
                      Username
                    </label>
                    <input
                      id="admin-username"
                      name="username"
                      type="text"
                      required
                      placeholder="lgu.tagbilaran.admin"
                      value={adminForm.username}
                      onChange={handleAdminFormChange}
                    />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="admin-email">
                      Government email
                    </label>
                    <input
                      id="admin-email"
                      name="email"
                      type="email"
                      required
                      placeholder="firstname.lastname@municipality.gov.ph"
                      value={adminForm.email}
                      onChange={handleAdminFormChange}
                    />
                  </div>
                </div>

                <div className="form-row">
                <label className="form-label" htmlFor="admin-municipality">
                  Municipality assignment
                </label>
                <select
                  id="admin-municipality"
                  name="municipalityId"
                  required
                  value={adminForm.municipalityId}
                  onChange={handleAdminFormChange}
                  disabled={loadingMunicipalities || submittingAdmin}
                >
                  <option value="" disabled>
                    {loadingMunicipalities ? 'Loading municipalities…' : 'Select municipality'}
                  </option>
                  {!loadingMunicipalities &&
                    (Array.isArray(municipalities) ? municipalities : []).map(
                      (municipality) => (
                        <option
                          key={municipality.municipality_id || municipality.id}
                          value={municipality.municipality_id || municipality.id}
                        >
                          {municipality.name}
                        </option>
                      ),
                    )}
                </select>
              </div>

                <div className="form-row form-grid">
                  <div>
                    <label className="form-label" htmlFor="admin-phone">
                      Contact number (optional)
                    </label>
                    <input
                      id="admin-phone"
                      name="phone"
                      type="tel"
                      placeholder="+63 912 345 6789"
                      value={adminForm.phone}
                      onChange={handleAdminFormChange}
                    />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="admin-role">
                      Role
                    </label>
                    <input
                      id="admin-role"
                      name="role"
                      type="text"
                      value="LGU Administrator"
                      readOnly
                      className="readonly-input"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="admin-notes">
                    Notes for invitation (optional)
                  </label>
                  <textarea
                    id="admin-notes"
                    name="notes"
                    rows={3}
                    placeholder="Include onboarding reminders or provincial policies."
                    value={adminForm.notes}
                    onChange={handleAdminFormChange}
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="ghost-cta" onClick={closeCreateModal}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-cta" disabled={submittingAdmin}>
                    {submittingAdmin ? 'Sending…' : 'Send Invitation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default BtoDashboard;



