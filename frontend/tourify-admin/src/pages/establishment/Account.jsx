import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import EstablishmentLayout from '../../components/EstablishmentLayout';
import '../../styles/AdminDashboard.css';
import useEstablishmentWorkspace from './useEstablishmentWorkspace';
import {
  fetchEstablishmentMedia,
  uploadEstablishmentMedia,
} from '../../services/establishmentApi';

const BOHOL_CENTER = [9.8505, 124.1435];

const leafletDefaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = leafletDefaultIcon;

const parseCoordinate = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeMediaList = payload => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.media)) return payload.media;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

function CoordinateMapEvents({ onPick }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function AutoCenterMap({ position }) {
  const map = useMap();

  useEffect(() => {
    if (!position) return;
    map.setView(position, Math.max(map.getZoom(), 16), { animate: true });
  }, [map, position]);

  return null;
}

function EstablishmentAccount() {
  const { estId } = useParams();
  const {
    loading,
    saving,
    error,
    message,
    establishment,
    form,
    updateFormField,
    saveDetails,
  } = useEstablishmentWorkspace(estId);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryError, setGalleryError] = useState('');
  const [galleryMessage, setGalleryMessage] = useState('');

  const activeEstId = establishment?.businessEstablishment_id || estId || '';

  const loadGalleryPhotos = useCallback(async () => {
    if (!activeEstId) {
      setGalleryPhotos([]);
      return;
    }

    setGalleryLoading(true);
    setGalleryError('');
    try {
      const { data } = await fetchEstablishmentMedia(activeEstId, 'spot_gallery');
      const allMedia = normalizeMediaList(data);
      const photosOnly = allMedia.filter(
        item =>
          item?.file_type === 'image' ||
          String(item?.mime_type || '').toLowerCase().startsWith('image/')
      );
      setGalleryPhotos(photosOnly);
    } catch (err) {
      setGalleryError(err.response?.data?.message || 'Unable to load photos.');
    } finally {
      setGalleryLoading(false);
    }
  }, [activeEstId]);

  useEffect(() => {
    loadGalleryPhotos();
  }, [loadGalleryPhotos]);

  const handlePhotoSelection = event => {
    const files = Array.from(event.target.files || []);
    setSelectedPhotos(files);
    setGalleryError('');
    setGalleryMessage('');
  };

  const handleUploadPhotos = async () => {
    if (!activeEstId) return;
    if (!selectedPhotos.length) {
      setGalleryError('Select at least one photo.');
      return;
    }
    if (selectedPhotos.length > 6) {
      setGalleryError('Maximum of 6 photos per upload.');
      return;
    }

    const formData = new FormData();
    selectedPhotos.forEach(file => formData.append('files', file));

    setGalleryUploading(true);
    setGalleryError('');
    setGalleryMessage('');

    try {
      await uploadEstablishmentMedia(activeEstId, formData, 'spot_gallery');
      setGalleryMessage(`${selectedPhotos.length} photo(s) uploaded.`);
      setSelectedPhotos([]);
      await loadGalleryPhotos();
    } catch (err) {
      setGalleryError(err.response?.data?.message || 'Unable to upload photos.');
    } finally {
      setGalleryUploading(false);
    }
  };


  const markerPosition = useMemo(() => {
    const latitude = parseCoordinate(form.latitude);
    const longitude = parseCoordinate(form.longitude);
    if (latitude == null || longitude == null) return null;
    if (latitude < -90 || latitude > 90) return null;
    if (longitude < -180 || longitude > 180) return null;
    return [latitude, longitude];
  }, [form.latitude, form.longitude]);

  const mapCenter = markerPosition || BOHOL_CENTER;

  const setCoordinates = useCallback(
    (latitude, longitude) => {
      updateFormField('latitude', Number(latitude).toFixed(6));
      updateFormField('longitude', Number(longitude).toFixed(6));
      setLocationError('');
    },
    [updateFormField],
  );

  const detectCurrentCoordinates = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.');
      return;
    }

    setDetectingLocation(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      position => {
        setCoordinates(position.coords.latitude, position.coords.longitude);
        setDetectingLocation(false);
      },
      geolocationError => {
        const fallbackMessage = 'Unable to detect your current location.';
        setLocationError(geolocationError.message || fallbackMessage);
        setDetectingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }, [setCoordinates]);

  return (
    <EstablishmentLayout
      title="Establishment Information"
      subtitle="Manage editable details for this establishment account."
    >
      {loading ? <p className="muted">Loading account details...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="muted">{message}</p> : null}

      {!loading && !error && establishment ? (
        <section className="account-management">
          <div className="section-heading">
            <h2>Editable Fields</h2>
            <p>Official name, category, and ownership type are locked and managed by LGU.</p>
          </div>

          <form className="modal-form" onSubmit={saveDetails}>
            <div className="form-row">
              <label className="form-label">Official Name (Locked)</label>
              <input type="text" value={establishment.name || ''} disabled />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="est-type">
                Category (Locked)
              </label>
              <input
                id="est-type"
                type="text"
                value={form.type}
                onChange={e => updateFormField('type', e.target.value)}
                disabled
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="est-ownership">
                Ownership Type (Locked)
              </label>
              <select
                id="est-ownership"
                value={form.ownershipType}
                onChange={e => updateFormField('ownershipType', e.target.value)}
                disabled
              >
                <option value="private">Private</option>
                <option value="government">Government</option>
              </select>
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="est-address">
                Address
              </label>
              <input
                id="est-address"
                type="text"
                value={form.address}
                onChange={e => updateFormField('address', e.target.value)}
              />
            </div>
            <div className="form-row full">
              <label className="form-label" htmlFor="est-description">
                Description
              </label>
              <textarea
                id="est-description"
                rows={4}
                value={form.description}
                onChange={e => updateFormField('description', e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="est-contact">
                Contact Info
              </label>
              <input
                id="est-contact"
                type="text"
                value={form.contactInfo}
                onChange={e => updateFormField('contactInfo', e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="est-accreditation">
                Accreditation No.
              </label>
              <input
                id="est-accreditation"
                type="text"
                value={form.accreditationNo}
                onChange={e => updateFormField('accreditationNo', e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="est-lat">
                Latitude
              </label>
              <input
                id="est-lat"
                type="number"
                step="0.000001"
                value={form.latitude}
                onChange={e => updateFormField('latitude', e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="est-lng">
                Longitude
              </label>
              <input
                id="est-lng"
                type="number"
                step="0.000001"
                value={form.longitude}
                onChange={e => updateFormField('longitude', e.target.value)}
              />
            </div>
            <div className="form-row full">
              <label className="form-label">Establishment Location Map</label>
              <div className="establishment-location-tools">
                <button
                  type="button"
                  className="ghost-cta"
                  onClick={detectCurrentCoordinates}
                  disabled={detectingLocation}
                >
                  {detectingLocation ? 'Detecting current location...' : 'Auto Detect Current Coordinates'}
                </button>
                <p className="location-map-hint">Click the map to pin the location if you are not on-site.</p>
              </div>
              {locationError ? <p className="location-error-text">{locationError}</p> : null}
              <div className="location-map-shell">
                <MapContainer
                  center={mapCenter}
                  zoom={markerPosition ? 16 : 12}
                  scrollWheelZoom
                  className="location-map"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <CoordinateMapEvents onPick={setCoordinates} />
                  <AutoCenterMap position={markerPosition} />
                  {markerPosition ? <Marker position={markerPosition} /> : null}
                </MapContainer>
              </div>
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="est-budget-min">
                Budget Min
              </label>
              <input
                id="est-budget-min"
                type="number"
                min="0"
                value={form.budgetMin}
                onChange={e => updateFormField('budgetMin', e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="est-budget-max">
                Budget Max
              </label>
              <input
                id="est-budget-max"
                type="number"
                min="0"
                value={form.budgetMax}
                onChange={e => updateFormField('budgetMax', e.target.value)}
              />
            </div>
            <div className="form-row full">
            <label className="form-label" htmlFor="est-photos">
              Spot Photos (Multiple)
            </label>
            <input
              id="est-photos"
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelection}
              disabled={galleryUploading}
            />

            <div className="media-upload-controls">
              <button
                type="button"
                className="primary-cta"
                onClick={handleUploadPhotos}
                disabled={galleryUploading || selectedPhotos.length === 0}
              >
                {galleryUploading ? 'Uploading photos...' : 'Upload Selected Photos'}
              </button>
              {selectedPhotos.length > 0 ? (
                <p className="muted">
                  {selectedPhotos.length} photo(s) selected. Max 6 per upload.
                </p>
              ) : null}
            </div>

            {galleryLoading ? <p className="muted">Loading photos...</p> : null}
            {galleryError ? <p className="error-text">{galleryError}</p> : null}
            {galleryMessage ? <p className="muted">{galleryMessage}</p> : null}

            <div className="media-grid">
              {galleryPhotos.length ? (
                galleryPhotos.map(photo => (
                  <a
                    key={photo.media_id}
                    className="media-thumb"
                    href={photo.file_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img src={photo.file_url} alt={photo.caption || 'Establishment photo'} />
                  </a>
                ))
              ) : !galleryLoading ? (
                <p className="muted">No photos uploaded yet.</p>
              ) : null}
            </div>
          </div>

            <div className="modal-actions">
              <button type="submit" className="primary-cta" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </EstablishmentLayout>
  );
}

export default EstablishmentAccount;
