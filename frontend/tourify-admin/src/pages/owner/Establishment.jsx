import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerLayout from '../../components/OwnerLayout';
import '../../styles/AdminDashboard.css';
import {
  createOwnerEstablishment,
  fetchOwnerEstablishments,
  regenerateQr,
  uploadEstablishmentMedia,
  fetchEstablishmentMedia,
  updateOwnerEstablishment
} from '../../services/establishmentApi';
import { fetchMunicipalities } from '../../services/btoApi';

const statusToneMap = {
  verified: 'success',
  approved: 'success',
  pending: 'warning',
  needs_review: 'review',
  rejected: 'danger',
};

const categories = [
  'Accommodation',
  'Restaurant',
  'Tour Operator',
  'Dive Shop',
  'Homestay',
  'Activity',
  'Transport',
];

const ownershipOptions = [
  { value: 'private', label: 'Private' },
  { value: 'government', label: 'Government' },
];

const initialForm = {
  municipalityId: '',
  name: '',
  category: '',
  ownershipType: 'private',
  address: '',
  description: '',
  contactInfo: '',
  accreditationNo: '',
  latitude: '',
  longitude: '',
  budgetMin: '',
  budgetMax: '',
};

const normalizeList = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
};

const resolveTone = (status) => {
  if (!status) return 'neutral';
  const trimmed = status.trim();
  return (
    statusToneMap[trimmed] ||
    statusToneMap[trimmed.toLowerCase()] ||
    statusToneMap[trimmed.replace(/\s+/g, '_').toLowerCase()] ||
    'neutral'
  );
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

const resolveQrLink = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/api$/, '') || '';
  return `${apiBase}${url.startsWith('/') ? url : `/${url}`}`;
};

function OwnerEstablishments() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [municipalityLookup, setMunicipalityLookup] = useState({});
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);

  // const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedSpotMedia, setSelectedSpotMedia] = useState([]);
  const [selectedRequirementDocs, setSelectedRequirementDocs] = useState([]);
  const [editSpotMediaFiles, setEditSpotMediaFiles] = useState([]);
  const [editRequirementDocsFiles, setEditRequirementDocsFiles] = useState([]);

  const [mediaCache, setMediaCache] = useState({}); // { estId: media[] }
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [activeMediaEst, setActiveMediaEst] = useState(null);
  const [mediaModalLoading, setMediaModalLoading] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editEstablishment, setEditEstablishment] = useState(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFeedback, setEditFeedback] = useState('');

  const [geoStatus, setGeoStatus] = useState({ loading: false, message: '' });

  // const [editMediaFiles, setEditMediaFiles] = useState([]);

const handleSpotMediaSelection = (event) => {
  setSelectedSpotMedia(Array.from(event.target.files || []));
};

const handleRequirementDocsSelection = (event) => {
  setSelectedRequirementDocs(Array.from(event.target.files || []));
};

const handleEditSpotMediaSelection = (event) => {
  setEditSpotMediaFiles(Array.from(event.target.files || []));
};

const handleEditRequirementDocsSelection = (event) => {
  setEditRequirementDocsFiles(Array.from(event.target.files || []));
};

  // const handleEditFileSelection = event => {
  //   const files = Array.from(event.target.files || []);
  //   setEditMediaFiles(files);
  // };

  const fillCoordinates = (lat, lng) => {
    setForm(prev => ({
      ...prev,
      latitude: lat?.toFixed(6) ?? '',
      longitude: lng?.toFixed(6) ?? '',
    }));
  };

  const fillEditCoordinates = (lat, lng) => {
    setEditForm(prev => ({
      ...prev,
      latitude: lat?.toFixed(6) ?? '',
      longitude: lng?.toFixed(6) ?? '',
    }));
  };

  const requestGeolocation = applyCoords => {
    if (!navigator.geolocation) {
      setGeoStatus({ loading: false, message: 'Geolocation not supported in this browser.' });
      return;
    }

    setGeoStatus({ loading: true, message: 'Detecting location…' });

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        applyCoords(coords.latitude, coords.longitude);
        setGeoStatus({ loading: false, message: 'Location detected. Review before submitting.' });
      },
      error => {
        console.error('[OwnerEstablishments] geolocation failed', error);
        setGeoStatus({
          loading: false,
          message: error.message || 'Unable to read GPS. Please enter coordinates manually.',
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  const handleUseMyLocation = () => requestGeolocation(fillCoordinates);
  const handleEditUseMyLocation = () => requestGeolocation(fillEditCoordinates);



  const fetchMediaFor = useCallback(async (estId) => {
    if (!estId) return;
    try {
      const { data } = await fetchEstablishmentMedia(estId);
      setMediaCache((prev) => ({ ...prev, [estId]: data.media || [] }));
    } catch (err) {
      console.error('Failed to load media', err);
    }
  }, []);

  const loadListings = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await fetchOwnerEstablishments({ limit: 50 });
      setListings(normalizeList(data));
      setError('');
    } catch (err) {
      console.error('Failed to fetch owner establishments', err);
      setError('Unable to load your establishments right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  useEffect(() => {
    const loadMunicipalities = async () => {
      try {
        const { data } = await fetchMunicipalities();
        const items = Array.isArray(data?.municipalities)
          ? data.municipalities
          : Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : [];
        setMunicipalities(items);
        const lookup = items.reduce((acc, item) => {
          const id = item.municipality_id || item.id;
          if (id) acc[id] = item.name;
          return acc;
        }, {});
        setMunicipalityLookup(lookup);
      } catch (err) {
        console.warn('Municipality lookup failed', err);
      }
    };

    loadMunicipalities();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(initialForm);
    setFeedback('');
    setSelectedSpotMedia([]);
    setSelectedRequirementDocs([]);
  };

  const closeModal = () => {
    resetForm();
    setModalOpen(false);
  };

  // const handleFileSelection = (event) => {
  //   const files = Array.from(event.target.files || []);
  //   setSelectedFiles(files);
  // };

  const openEditModal = (listing) => {
    if (!listing) return;
    setEditFeedback('');
    setEditSpotMediaFiles([]);
    setEditRequirementDocsFiles([]);
    setShowEditModal(true);
    setEditEstablishment(listing);
    setEditForm({
      municipalityId:
      listing.municipality_id ||
      listing.municipality ||
      form.municipalityId,
      name: listing.name || '',
      category: listing.type || '',
      ownershipType: listing.ownership_type || 'private',
      address: listing.address || '',
      description: listing.description || '',
      contactInfo: listing.contact_info || '',
      accreditationNo: listing.accreditation_no || '',
      latitude: listing.latitude ?? '',
      longitude: listing.longitude ?? '',
      budgetMin: listing.budget_min ?? '',
      budgetMax: listing.budget_max ?? '',
    });
    setEditFeedback('');
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditEstablishment(null);
    setEditFeedback('');
    setEditSpotMediaFiles([]);
    setEditRequirementDocsFiles([]);
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!editEstablishment?.businessEstablishment_id) return;

    setEditSubmitting(true);
    setEditFeedback('');

    try {
      await updateOwnerEstablishment(editEstablishment.businessEstablishment_id, {
        name: editForm.name,
        type: editForm.category,
        address: editForm.address,
        description: editForm.description,
        contact_info: editForm.contactInfo,
        accreditation_no: editForm.accreditationNo,
        latitude: editForm.latitude === '' ? undefined : Number(editForm.latitude),
        longitude: editForm.longitude === '' ? undefined : Number(editForm.longitude),
        budget_min: editForm.budgetMin === '' ? undefined : Number(editForm.budgetMin),
        budget_max: editForm.budgetMax === '' ? undefined : Number(editForm.budgetMax),

      });
      
      if (editSpotMediaFiles.length > 0) {
        const spotFormData = new FormData();
        editSpotMediaFiles.forEach(file => spotFormData.append('files', file));
        await uploadEstablishmentMedia(
          editEstablishment.businessEstablishment_id,
          spotFormData,
          'spot_gallery'
        );
        setEditSpotMediaFiles([]);
      }

      if (editRequirementDocsFiles.length > 0) {
        const docsFormData = new FormData();
        editRequirementDocsFiles.forEach(file => docsFormData.append('files', file));
        await uploadEstablishmentMedia(
          editEstablishment.businessEstablishment_id,
          docsFormData,
          'submission_requirement'
        );
        setEditRequirementDocsFiles([]);
      }

      await fetchMediaFor(editEstablishment.businessEstablishment_id);


      setEditFeedback('Establishment details updated.');
      await loadListings();
      closeEditModal();
    } catch (err) {
      setEditFeedback(
        err.response?.data?.message ||
          err.message ||
          'Unable to update establishment right now.',
      );
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFeedback('');

    try {
      const { data } = await createOwnerEstablishment({
        municipality_id: form.municipalityId,
        name: form.name,
        type: form.category,
        ownership_type: form.ownershipType,
        address: form.address || undefined,
        description: form.description || undefined,
        contact_info: form.contactInfo || undefined,
        accreditation_no: form.accreditationNo || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        budget_min: form.budgetMin === '' ? undefined : Number(form.budgetMin),
        budget_max: form.budgetMax === '' ? undefined : Number(form.budgetMax),

      });

      const newEst = data?.establishment || data?.data || data;
      const newEstId =
        newEst?.businessEstablishment_id || newEst?.id || newEst?.business_establishment_id;

      if (newEstId && selectedSpotMedia.length > 0) {
        const spotFormData = new FormData();
        selectedSpotMedia.forEach((file) => spotFormData.append('files', file));
        await uploadEstablishmentMedia(newEstId, spotFormData, 'spot_gallery');
      }

      if (newEstId && selectedRequirementDocs.length > 0) {
        const docsFormData = new FormData();
        selectedRequirementDocs.forEach((file) => docsFormData.append('files', file));
        await uploadEstablishmentMedia(newEstId, docsFormData, 'submission_requirement');
      }

      if (newEstId) await fetchMediaFor(newEstId);

      resetForm();
      setFeedback('Listing submitted. Your LGU staff will review it shortly.');
      setModalOpen(false);
      await loadListings();
    } catch (err) {
      console.error('Failed to submit establishment', err);
      setFeedback(
        err.response?.data?.message ||
          err.message ||
          'Unable to submit listing right now.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerateQr = async (estId) => {
    try {
      await regenerateQr(estId);
      setFeedback('QR code refreshed.');
      await loadListings();
    } catch (err) {
      setFeedback(
        err.response?.data?.message ||
          'Unable to regenerate the QR code right now.',
      );
    }
  };

  const openMediaModal = async (establishment) => {
    const estId = establishment.businessEstablishment_id || establishment.id;
    setActiveMediaEst({ ...establishment, estId });
    setShowMediaModal(true);

    if (!mediaCache[estId]) {
      setMediaModalLoading(true);
      await fetchMediaFor(estId);
      setMediaModalLoading(false);
    }
  };

  const closeMediaModal = () => {
    setShowMediaModal(false);
    setActiveMediaEst(null);
  };


  const sortedListings = useMemo(() => {
    return [...listings].sort((a, b) => {
      const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bDate - aDate;
    });
  }, [listings]);

  return (
    <OwnerLayout
      title="My Establishments"
      subtitle="LGU registers official establishment records; owners complete operational details."
      searchPlaceholder="Search your establishments..."
      headerActions={<></>}
    >
      {isModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card wide">
            <header className="modal-header">
              <div>
                <h3>Submit a New Listing</h3>
                <p>
                  Provide complete details so your municipality can validate and
                  endorse your establishment quickly.
                </p>
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

            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <label className="form-label" htmlFor="est-municipality">
                  Municipality
                </label>
                <select
                  id="est-municipality"
                  name="municipalityId"
                  required
                  value={form.municipalityId}
                  onChange={handleChange}
                >
                  <option value="" disabled>
                    Select municipality
                  </option>
                  {municipalities.map((municipality) => (
                    <option
                      key={municipality.municipality_id || municipality.id}
                      value={municipality.municipality_id || municipality.id}
                    >
                      {municipality.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label className="form-label" htmlFor="est-category">
                  Category
                </label>
                <select
                  id="est-category"
                  name="category"
                  required
                  value={form.category}
                  onChange={handleChange}
                >
                  <option value="" disabled>
                    Select category
                  </option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row full">
                <label className="form-label" htmlFor="est-name">
                  Establishment name
                </label>
                <input
                  id="est-name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g., Balicasag Island Eco Resort"
                  value={form.name}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row">
                <label className="form-label" htmlFor="est-ownership">
                  Ownership type
                </label>
                <select
                  id="est-ownership"
                  name="ownershipType"
                  required
                  value={form.ownershipType}
                  onChange={handleChange}
                >
                  {ownershipOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label className="form-label" htmlFor="est-address">
                  Address (optional)
                </label>
                <input
                  id="est-address"
                  name="address"
                  type="text"
                  placeholder="Barangay, municipality, province"
                  value={form.address}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row full">
                <label className="form-label" htmlFor="est-description">
                  Description
                </label>
                <textarea
                  id="est-description"
                  name="description"
                  rows={4}
                  placeholder="Highlight offerings, operating hours, capacity, etc."
                  value={form.description}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row">
                <label className="form-label" htmlFor="est-contact">
                  Contact info (phone/email)
                </label>
                <input
                  id="est-contact"
                  name="contactInfo"
                  type="text"
                  placeholder="+63 912 345 6789 / hello@tourism.ph"
                  value={form.contactInfo}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row">
                <label className="form-label" htmlFor="est-accreditation">
                  Accreditation / permit no.
                </label>
                <input
                  id="est-accreditation"
                  name="accreditationNo"
                  type="text"
                  placeholder="DOT-XXXX / LGU permit"
                  value={form.accreditationNo}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row">
                <label className="form-label" htmlFor="est-budget-min">Budget min (PHP)</label>
                <input
                  id="est-budget-min"
                  name="budgetMin"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 200"
                  value={form.budgetMin}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row">
                <label className="form-label" htmlFor="est-budget-max">Budget max (PHP)</label>
                <input
                  id="est-budget-max"
                  name="budgetMax"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 1500"
                  value={form.budgetMax}
                  onChange={handleChange}
                />
              </div>


              <div className="form-row">
                <label className="form-label" htmlFor="est-latitude">
                  Latitude
                </label>
                <div className="form-row location-actions">
                  <button
                    type="button"
                    className="ghost-cta"
                    onClick={handleUseMyLocation}
                    disabled={geoStatus.loading}
                  >
                    {geoStatus.loading ? 'Detecting…' : 'Use my current location'}
                  </button>
                  {geoStatus.message && (
                    <span className="muted" role="status">
                      {geoStatus.message}
                    </span>
                  )}
                </div>
                <input
                  id="est-latitude"
                  name="latitude"
                  type="number"
                  step="0.000001"
                  placeholder="Latitude"
                  value={form.latitude}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row">
                <label className="form-label" htmlFor="est-longitude">
                  Longitude (optional)
                </label>
                <input
                  id="est-longitude"
                  name="longitude"
                  type="number"
                  step="0.000001"
                  placeholder="Longitude"
                  value={form.longitude}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row full">
                <label className="form-label" htmlFor="est-spot-media">
                  Spot Photos / Videos
                </label>
                <input
                  id="est-spot-media"
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleSpotMediaSelection}
                />
                {selectedSpotMedia.length > 0 && (
                  <div className="muted">
                    {selectedSpotMedia.length} spot file{selectedSpotMedia.length > 1 ? 's' : ''} ready.
                  </div>
                )}
              </div>

              <div className="form-row full">
                <label className="form-label" htmlFor="est-requirement-docs">
                  Submission Documents
                </label>
                <input
                  id="est-requirement-docs"
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleRequirementDocsSelection}
                />
                {selectedRequirementDocs.length > 0 && (
                  <div className="muted">
                    {selectedRequirementDocs.length} document file{selectedRequirementDocs.length > 1 ? 's' : ''} ready.
                  </div>
                )}
              </div>


              {feedback && (
                <div className="muted full" role="status">
                  {feedback}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="ghost-cta"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-cta" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section className="account-management">
        <div className="section-heading">
          <h2>Your Establishments</h2>
          <p>QR remains available. Open each establishment page to manage details, analytics, and feedback.</p>
        </div>

        <div className="table-shell">
          <div className="table-head table-grid">
            <span>Establishment</span>
            <span>Municipality</span>
            <span>Category</span>
            <span>Status</span>
            <span>Submitted / Updated</span>
            <span>QR Code</span>
            <span>Establishment Account</span>
            <span>Actions</span>
          </div>

          <ul className="table-body">
            {loading ? (
              <li className="table-row table-grid">
                <div className="muted">Loading establishments...</div>
              </li>
            ) : error ? (
              <li className="table-row table-grid">
                <div className="muted">{error}</div>
              </li>
            ) : sortedListings.length === 0 ? (
              <li className="table-row table-grid">
                <div className="muted">You haven't submitted any establishments yet.</div>
              </li>
            ) : (
              sortedListings.map((listing) => {
                const estId = listing.businessEstablishment_id || listing.id;
                const municipalityName =
                  municipalityLookup[listing.municipality_id] ||
                  listing.municipality ||
                  '-';

                return (
                  <li key={estId} className="table-row table-grid">
                    <div className="account-cell">
                      <p className="account-name">
                        {listing.name || 'Unnamed establishment'}
                      </p>
                      <p className="account-email">
                        ID: {estId || '-'}
                      </p>
                    </div>
                    <div className="muted">{municipalityName}</div>
                    <div className="muted">
                      {listing.type || listing.category || '-'}
                    </div>
                    <div>
                      <span className={`status-chip status-${resolveTone(listing.status)}`}>
                        {listing.status || 'approved'}
                      </span>
                    </div>
                   <div className="muted">
                      <div>Submitted: {formatDate(listing.createdAt)}</div>
                      <div>Updated: {formatDate(listing.approvedAt || listing.updatedAt)}</div>
                    </div>
                    <div className="table-actions">
                      {listing.qr_code ? (
                        <a
                          href={resolveQrLink(listing.qr_code)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ghost-cta"
                        >
                          Download QR
                        </a>
                      ) : (
                        <span className="muted">Not generated</span>
                      )}
                      <button
                        type="button"
                        className="ghost-cta"
                        onClick={() => handleRegenerateQr(estId)}
                      >
                        Refresh QR
                      </button>
                    </div>
                    <div className="muted">
                      <div>{listing.establishment_account?.username || '-'}</div>
                      <div>{listing.establishment_account?.email || '-'}</div>
                      <div>ID: {listing.establishment_account?.account_id || '-'}</div>
                    </div>
                    <div className="table-actions">
                      <button type="button" className="ghost-cta" onClick={() => openMediaModal(listing)}>
                        View details
                      </button>
                      <button
                        type="button"
                        className="primary-cta"
                        onClick={() => navigate(`/owner/establishments/${estId}`)}
                      >
                        Open Page
                      </button>
                      <a className="ghost-cta" href={listing.account_login_url || '/login'} target="_blank" rel="noreferrer">
                        Login Link
                      </a>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </section>

      {showMediaModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card wide">
            <header className="modal-header">
              <div>
                <h3>Establishment Details</h3>
                <p>ID: {activeMediaEst?.estId || '—'}</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={closeMediaModal}
              >
                ×
              </button>
            </header>

            {mediaModalLoading ? (
              <div className="muted">Loading details…</div>
            ) : (
              <div className="modal-content">
                <div className="detail-grid">
                  <div className="detail-pair">
                    <p className="detail-label">Name</p>
                    <p className="detail-value strong">{activeMediaEst?.name || '—'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Status</p>
                    <p className="detail-value chip">{activeMediaEst?.status || '—'}</p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Municipality</p>
                    <p className="detail-value">
                      {activeMediaEst?.municipality || activeMediaEst?.municipality_id || '—'}
                    </p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Category</p>
                    <p className="detail-value">
                      {activeMediaEst?.type || activeMediaEst?.category || '—'}
                    </p>
                  </div>
                  <div className="detail-pair">
                    <p className="detail-label">Last Updated</p>
                    <p className="detail-value">
                      {activeMediaEst?.updatedAt
                        ? new Date(activeMediaEst.updatedAt).toLocaleString()
                        : '—'}
                    </p>
                  </div>
                </div>

                <div className="detail-block">
                  <p className="detail-label">Address</p>
                  <p className="detail-value">{activeMediaEst?.address || '—'}</p>
                </div>
                <div className="detail-block">
                  <p className="detail-label">Description</p>
                  <p className="detail-value">{activeMediaEst?.description || '—'}</p>
                </div>

                <div className="detail-block">
                  <p className="detail-label">Account Info</p>
                  <p className="detail-value">Username: {activeMediaEst?.establishment_account?.username || '-'}</p>
                  <p className="detail-value">Email: {activeMediaEst?.establishment_account?.email || '-'}</p>
                  <p className="detail-value">Account ID: {activeMediaEst?.establishment_account?.account_id || '-'}</p>
                  <p className="detail-value">Owner Username: {activeMediaEst?.owner_account?.username || '-'}</p>
                  <p className="detail-value">
                    Login URL:{' '}
                    <a
                      href={activeMediaEst?.account_login_url || '/login'}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {activeMediaEst?.account_login_url || '/login'}
                    </a>
                  </p>
                </div>

                <div className="detail-block">
                  <p className="detail-label">Media</p>
                  <div className="media-grid">
                    {(mediaCache[activeMediaEst?.estId] || []).length === 0 ? (
                      <p className="muted">No media uploaded yet.</p>
                    ) : (
                      (mediaCache[activeMediaEst?.estId] || []).map((media) => (
                        <a
                          key={media.media_id}
                          className="media-thumb"
                          href={media.file_url}
                          target="_blank"
                          rel="noreferrer"
                          title={media.caption || media.file_url}
                        >
                          {media.file_type === 'video' ? (
                            <video controls src={media.file_url} />
                          ) : (
                            <img src={media.file_url} alt={media.caption || media.media_id} />
                          )}
                        </a>
                      ))
                    )}
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="button" className="primary-cta" onClick={closeMediaModal}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {showEditModal && (
      <div className="modal-backdrop" role="dialog" aria-modal="true">
        <div className="modal-card wide">
          <header className="modal-header">
            <div>
                <h3>Edit establishment</h3>
                <p>Update operational details for this establishment.</p>
              </div>
            <button
              type="button"
              className="modal-close"
              aria-label="Close"
              onClick={closeEditModal}
            >
              ×
            </button>
          </header>
          
          <form className="modal-form" onSubmit={handleEditSubmit}>
            <div className="form-row">
              <label className="form-label" htmlFor="edit-name">Establishment name</label>
              <input
                id="edit-name"
                name="name"
                type="text"
                required
                value={editForm.name}
                onChange={handleEditChange}
              />
            </div>
           <div className="form-row">
              <label className="form-label" htmlFor="edit-municipality">Municipality</label>
              <select
                id="edit-municipality"
                name="municipalityId"
                value={editForm.municipalityId}
                onChange={handleEditChange}
                required
              >
                <option value="">Select municipality</option>
                {municipalities.map(item => (
                  <option key={item.municipality_id} value={item.municipality_id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="edit-name">Establishment name</label>
              <input id="edit-name" name="name" value={editForm.name} onChange={handleEditChange} required />
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor="edit-category">Category</label>
              <select
                id="edit-category"
                name="category"
                value={editForm.category}
                onChange={handleEditChange}
                required
              >
                <option value="">Select category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="edit-latitude">Latitude</label>
              <input
                id="edit-latitude"
                name="latitude"
                type="number"
                step="0.000001"
                value={editForm.latitude}
                onChange={handleEditChange}
              />
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor="edit-longitude">Longitude</label>
              <input
                id="edit-longitude"
                name="longitude"
                type="number"
                step="0.000001"
                value={editForm.longitude}
                onChange={handleEditChange}
              />
            </div>

            <div className="form-row location-actions">
              <button type="button" className="ghost-cta" onClick={handleEditUseMyLocation} disabled={geoStatus.loading}>
                {geoStatus.loading ? 'Detecting…' : 'Use my current location'}
              </button>
              {geoStatus.message && <span className="muted">{geoStatus.message}</span>}
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor="edit-ownership">Ownership</label>
              <select
                id="edit-ownership"
                name="ownershipType"
                value={editForm.ownershipType}
                onChange={handleEditChange}
              >
                {ownershipOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="edit-budget-min">Budget min (PHP)</label>
              <input
                id="edit-budget-min"
                name="budgetMin"
                type="number"
                min="0"
                step="1"
                value={editForm.budgetMin}
                onChange={handleEditChange}
              />
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor="edit-budget-max">Budget max (PHP)</label>
              <input
                id="edit-budget-max"
                name="budgetMax"
                type="number"
                min="0"
                step="1"
                value={editForm.budgetMax}
                onChange={handleEditChange}
              />
            </div>

            
            {/* repeat for category, ownershipType, address, description, contactInfo, etc. */}

            {editFeedback && (
              <div className="muted full" role="status">
                {editFeedback}
              </div>
            )}
            <div className="form-row full">
              <label className="form-label" htmlFor="edit-spot-media">Add spot photos/videos</label>
              <input
                id="edit-spot-media"
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleEditSpotMediaSelection}
                disabled={editSubmitting}
              />
              {editSpotMediaFiles.length > 0 && (
                <div className="muted">
                  {editSpotMediaFiles.length} spot file{editSpotMediaFiles.length > 1 ? 's' : ''} will upload on save.
                </div>
              )}
            </div>

            <div className="form-row full">
              <label className="form-label" htmlFor="edit-requirement-docs">Add submission documents</label>
              <input
                id="edit-requirement-docs"
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleEditRequirementDocsSelection}
                disabled={editSubmitting}
              />
              {editRequirementDocsFiles.length > 0 && (
                <div className="muted">
                  {editRequirementDocsFiles.length} document file{editRequirementDocsFiles.length > 1 ? 's' : ''} will upload on save.
                </div>
              )}
            </div>


            <div className="modal-actions">
              <button
                type="button"
                className="ghost-cta"
                onClick={closeEditModal}
                disabled={editSubmitting}
              >
                Cancel
              </button>
              <button type="submit" className="primary-cta" disabled={editSubmitting}>
                {editSubmitting ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </OwnerLayout>
  );
}

export default OwnerEstablishments;
