import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import '../../styles/AdminDashboard.css';
import { fetchAllEstablishments } from '../../services/btoApi';

const statusToneMap = {
  verified: 'success',
  Verified: 'success',
  pending: 'warning',
  Pending: 'warning',
  needs_review: 'review',
  'Needs review': 'review',
  rejected: 'danger',
};

function Establishments() {
  const [establishments, setEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const loadEstablishments = useCallback(
    async (searchTerm) => {
      try {
        setLoading(true);
      const term = searchTerm ?? query;
      const params = term ? { q: term } : undefined;
      const { data } = await fetchAllEstablishments(params);
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setEstablishments(items);
      setError('');
    } catch (err) {
      console.error('Failed to load establishments', err);
      setError('Unable to load establishments right now.');
    } finally {
      setLoading(false);
    }
  },
  [query]);

  useEffect(() => {
    loadEstablishments();
  }, [loadEstablishments]);

  const filteredEstablishments = useMemo(() => establishments, [establishments]);

  const resolveTone = (status) =>
    statusToneMap[status] || statusToneMap[status?.toLowerCase()] || 'neutral';

  return (
    <AdminLayout
      title="Establishments"
      subtitle="View every registered establishment across the province."
      searchPlaceholder="Search establishments..."
      onSearchSubmit={(value) => {
        setQuery(value);
        loadEstablishments(value);
      }}
    >
      <section className="account-management">
        <div className="section-heading">
          <h2>Registered Establishments</h2>
          <p>BTO admins can review status and details submitted by LGU admins and business owners.</p>
        </div>

        <div className="table-shell">
          <div className="table-head table-grid">
            <span>Establishment</span>
            <span>Municipality</span>
            <span>Category</span>
            <span>Status</span>
            <span>Last Update</span>
          </div>

          <ul className="table-body">
            {loading ? (
              <li className="table-row table-grid">
                <div className="muted">Loading establishments…</div>
              </li>
            ) : error ? (
              <li className="table-row table-grid">
                <div className="muted">{error}</div>
              </li>
            ) : filteredEstablishments.length === 0 ? (
              <li className="table-row table-grid">
                <div className="muted">No establishments found.</div>
              </li>
            ) : (
              filteredEstablishments.map((item) => (
                <li key={item.businessEstablishment_id || item.id} className="table-row table-grid">
                  <div className="account-cell">
                    <p className="account-name">{item.name}</p>
                    <p className="account-email">
                      ID: {item.businessEstablishment_id || item.id}
                    </p>
                  </div>
                  <div className="muted">{item.municipality_id || item.municipality || '—'}</div>
                  <div>
                    <span className="role-chip role-muted">{item.type || item.category || '—'}</span>
                  </div>
                  <div>
                    <span className={`status-chip status-${resolveTone(item.status)}`}>
                      {item.status || '—'}
                    </span>
                  </div>
                  <div className="muted">
                    {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '—'}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </AdminLayout>
  );
}

export default Establishments;
