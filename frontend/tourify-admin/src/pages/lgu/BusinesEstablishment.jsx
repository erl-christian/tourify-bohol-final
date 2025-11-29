import { useEffect, useMemo, useState } from 'react';
import LguLayout from '../../components/LguLayout';
import '../../styles/AdminDashboard.css';
import { fetchLguEstablishments } from '../../services/lguApi';

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

  const loadEstablishments = async () => {
    try {
      setLoading(true);
      const { data } = await fetchLguEstablishments();
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setEstablishments(items);
      setError('');
    } catch (err) {
      console.error('Failed to load establishments', err);
      setError('Unable to load establishments right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEstablishments();
  }, []);

  const rows = useMemo(() => establishments, [establishments]);
  const resolveTone = (status) =>
    statusToneMap[status] || statusToneMap[status?.toLowerCase()] || 'neutral';

  return (
    <LguLayout
      title="Municipal Establishments"
      subtitle="Monitor establishments in your municipality."
      searchPlaceholder="Search establishments..."
      onSearchSubmit={(value) => {
        // optional: support simple search
        console.log('search', value);
      }}
    >
      <section className="account-management">
        <div className="section-heading">
          <h2>Registered Establishments</h2>
          <p>Read-only list of establishments in your municipality.</p>
        </div>

        <div className="table-shell">
          <div className="table-head table-grid">
            <span>Establishment</span>
            <span>Category</span>
            <span>Status</span>
            <span>Submitted</span>
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
            ) : rows.length === 0 ? (
              <li className="table-row table-grid">
                <div className="muted">No establishments found.</div>
              </li>
            ) : (
              rows.map((item) => (
                <li key={item.businessEstablishment_id || item.id} className="table-row table-grid">
                  <div className="account-cell">
                    <p className="account-name">{item.name}</p>
                    <p className="account-email">
                      ID: {item.businessEstablishment_id || item.id}
                    </p>
                  </div>
                  <div className="muted">{item.type || item.category || '—'}</div>
                  <div>
                    <span className={`status-chip status-${resolveTone(item.status)}`}>
                      {item.status || '—'}
                    </span>
                  </div>
                  <div className="muted">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </LguLayout>
  );
}

export default Establishments;
