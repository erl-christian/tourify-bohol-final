import { useEffect, useMemo, useState } from 'react';
import LguLayout from '../../components/LguLayout';
import '../../styles/AdminDashboard.css';
import {
  fetchLguPendingEstablishments,
  actOnEstablishment,
} from '../../services/lguApi';

const statusToneMap = {
  pending: 'warning',
  needs_admin_review: 'review',
  approved: 'success',
  rejected: 'danger',
};

function Approvals() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadPending = async () => {
    try {
      setLoading(true);
      const { data } = await fetchLguPendingEstablishments();
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setPending(items);
      setError('');
    } catch (err) {
      console.error('Failed to load approvals', err);
      setError('Unable to load pending approvals right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const rows = useMemo(() => pending, [pending]);
  const resolveTone = (status) =>
    statusToneMap[status] || statusToneMap[status?.toLowerCase()] || 'neutral';

  const handleAction = async (establishmentId, action) => {
    setSubmitting(true);
    try {
      await actOnEstablishment(establishmentId, { action });
      await loadPending();
    } catch (err) {
      console.error('Failed to update establishment', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LguLayout
      title="Approval Queue"
      subtitle="Approve or return submissions from municipal staff and owners."
      searchPlaceholder="Search submissions..."
      onSearchSubmit={(value) => console.log('search', value)}
    >
      <section className="account-management">
        <div className="section-heading">
          <h2>Pending Approvals</h2>
          <p>Review submissions awaiting LGU action.</p>
        </div>

        <div className="table-shell">
          <div className="table-head table-grid">
            <span>Submission</span>
            <span>Submitted By</span>
            <span>Status</span>
            <span>Submitted</span>
            <span>Actions</span>
          </div>

          <ul className="table-body">
            {loading ? (
              <li className="table-row table-grid">
                <div className="muted">Loading approvals…</div>
              </li>
            ) : error ? (
              <li className="table-row table-grid">
                <div className="muted">{error}</div>
              </li>
            ) : rows.length === 0 ? (
              <li className="table-row table-grid">
                <div className="muted">No pending submissions.</div>
              </li>
            ) : (
              rows.map((item) => (
                <li key={item.businessEstablishment_id} className="table-row table-grid">
                  <div className="account-cell">
                    <p className="account-name">{item.name}</p>
                    <p className="account-email">
                      ID: {item.businessEstablishment_id}
                    </p>
                  </div>
                  <div className="muted">{item.submittedBy || '—'}</div>
                  <div>
                    <span className={`status-chip status-${resolveTone(item.status)}`}>
                      {item.status || 'pending'}
                    </span>
                  </div>
                  <div className="muted">
                    {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '—'}
                  </div>
                  <div className="muted">
                    <button
                      type="button"
                      className="primary-cta"
                      disabled={submitting}
                      onClick={() => handleAction(item.businessEstablishment_id, 'approve')}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="ghost-cta"
                      disabled={submitting}
                      onClick={() => handleAction(item.businessEstablishment_id, 'return')}
                    >
                      Return
                    </button>
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

export default Approvals;
