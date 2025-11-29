import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import '../../styles/AdminDashboard.css';
import {
  fetchMunicipalities,
  createMunicipality,
} from '../../services/btoApi';

const initialForm = {
  name: '',
  municipality_id: '',
  province: 'Bohol',
};

function Municipalities() {
  const [municipalities, setMunicipalities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isModalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const [feedbackModal, setFeedbackModal] = useState({
    open: false,
    status: 'success',
    message: '',
  });

  const normalizePayload = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    if (Array.isArray(raw?.data)) return raw.data;
    if (Array.isArray(raw?.municipalities)) return raw.municipalities;
    if (raw && typeof raw === 'object') {
      return Object.values(raw);
    }
    return [];
  };

  const loadMunicipalities = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await fetchMunicipalities();
      setMunicipalities(normalizePayload(data));
      setError('');
    } catch (err) {
      console.error('Failed to load municipalities', err);
      setError('Unable to load municipalities right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMunicipalities();
  }, [loadMunicipalities]);

  const sortedMunicipalities = useMemo(
    () =>
      [...municipalities].sort((a, b) =>
        (a.name || '').localeCompare(b.name || ''),
      ),
    [municipalities],
  );

  const openModal = () => {
    setForm(initialForm);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateMunicipality = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      await createMunicipality(form);

      setFeedbackModal({
        open: true,
        status: 'success',
        message: `Municipality ${form.name} has been added.`,
      });

      setForm(initialForm);
      setModalOpen(false);
      await loadMunicipalities();
    } catch (err) {
      setFeedbackModal({
        open: true,
        status: 'error',
        message:
          err.response?.data?.message ||
          'Unable to add municipality. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout
      title="Municipalities"
      subtitle="Maintain the list of LGU partners across Bohol."
      searchPlaceholder="Search municipalities..."
      onSearchSubmit={(value) => console.log('search', value)}
      headerActions={
        <button type="button" className="primary-cta" onClick={openModal}>
          Add Municipality
        </button>
      }
    >
      <section className="account-management">
        <div className="section-heading">
          <h2>Registered Municipalities</h2>
          <p>Monitor and expand LGU participation across the province.</p>
        </div>

        <div className="table-shell">
          <div className="table-head table-grid municipalities-grid">
            <span>Code</span>
            <span>Name</span>
            <span>Latitude</span>
            <span>Longitude</span>
            <span>Created</span>
          </div>

          <ul className="table-body">
            {loading ? (
              <li className="table-row table-grid">
                <div className="muted">Loading municipalities…</div>
              </li>
            ) : error ? (
              <li className="table-row table-grid">
                <div className="muted">{error}</div>
              </li>
            ) : sortedMunicipalities.length === 0 ? (
              <li className="table-row table-grid">
                <div className="muted">No municipalities found.</div>
              </li>
            ) : (
              sortedMunicipalities.map((municipality) => (
                <li key={municipality.municipality_id} className="table-row table-grid">
                  <div className="account-cell">
                    <p className="account-name">{municipality.municipality_id}</p>
                    <p className="account-email">{municipality.slug || ''}</p>
                  </div>
                  <div className="muted">{municipality.name}</div>
                  <div className="muted">{municipality.longitude}</div>
                  <div className="muted">{municipality.latitude}</div>
                  <div className="muted">
                    {municipality.createdAt
                      ? new Date(municipality.createdAt).toLocaleString()
                      : '—'}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      {isModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3>Add Municipality</h3>
                <p>Register a new LGU partner to appear across the platform.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={closeModal}
              >
                ×
              </button>
            </header>

            <div className="modal-content">
              <form className="modal-form" onSubmit={handleCreateMunicipality}>
                <div className="form-row">
                  <label className="form-label" htmlFor="mun-id">
                    Municipality code
                  </label>
                  <input
                    id="mun-id"
                    name="municipality_id"
                    type="text"
                    required
                    placeholder="e.g., TAGB"
                    value={form.municipality_id}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="mun-name">
                    Municipality name
                  </label>
                  <input
                    id="mun-name"
                    name="name"
                    type="text"
                    required
                    placeholder="Tagbilaran City"
                    value={form.name}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="mun-name">
                    Longlitude
                  </label>
                  <input
                    id="mun-longitude"
                    name="longitude"
                    type="text"
                    placeholder="123.8560"
                    value={form.longitude}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="mun-name">
                    Latitude
                  </label>
                  <input
                    id="mun-latitude"
                    name="latitude"
                    type="text"
                    placeholder="9.6486"
                    value={form.latitude}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-row">
                  <label className="form-label" htmlFor="mun-province">
                    Province
                  </label>
                  <input
                    id="mun-province"
                    name="province"
                    type="text"
                    value={form.province}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="ghost-cta" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-cta" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Save Municipality'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {feedbackModal.open && (
        <div className="modal-backdrop" role="alertdialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3>
                  {feedbackModal.status === 'success'
                    ? 'Success'
                    : 'Something went wrong'}
                </h3>
                <p>{feedbackModal.message}</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={() =>
                  setFeedbackModal({ open: false, status: 'success', message: '' })
                }
              >
                ×
              </button>
            </header>
            <div className="modal-actions">
              <button
                type="button"
                className="primary-cta"
                onClick={() =>
                  setFeedbackModal({ open: false, status: 'success', message: '' })
                }
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default Municipalities;
