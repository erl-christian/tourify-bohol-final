import client from './http';

const extractItems = value => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && Array.isArray(value.items)) return value.items;
  return [];
};

const normaliseResponse = res => extractItems(res?.data);

export const getMyTouristProfile = () =>
  client.get('/tourist/profile').then(res => res.data);

export const getTouristItineraries = () =>
  client.get('/tourist/itineraries').then(res => res.data.itineraries ?? []);

export const getMyFeedback = () =>
  client.get('/tourist/feedback/my').then(res => res.data.feedback ?? []);

export const getRecommendations = (touristProfileId, limit = 12) =>
  client
    .get('/tourist/recommendations', {
      params: { tourist_profile_id: touristProfileId, limit },
    })
    .then(normaliseResponse);

export const generateRecommendations = async payload => {
  const res = await client.post('/tourist/recommendations/generate', payload);
  const data = res?.data ?? {};
  return {
    items: extractItems(data),
    message: typeof data.message === 'string' ? data.message : null,
  };
};

export const generateSmartBundles = payload =>
  client
    .post('/tourist/recommendations/generate', { ...payload, group: true })
    .then(normaliseResponse);

export const getPublicDestinations = params =>
  client.get('/public/establishments', { params }).then(normaliseResponse);

export const createTouristProfile = payload =>
  client.post('/tourist/create-profile', payload).then(res => res.data);

export const updateTouristProfile = payload =>
  client.patch('/tourist/update-profile', payload).then(res => res.data);

export const uploadTouristMedia = async ({ uri, mimeType, name }) => {
  const formData = new FormData();
  formData.append('file', {
    uri,
    type: mimeType ?? 'image/jpeg',
    name: name ?? `avatar-${Date.now()}.jpg`,
  });

  return client
    .post('/tourist/profile/media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then(res => res.data);
};

export const enrichRecommendations = async items =>
  Promise.all(
    (items ?? []).map(async item => {
      if (item.establishment) return item;

      const estId =
        item.business_establishment_id ??
        item.businessEstablishment_id ??
        item.establishment?.businessEstablishment_id ??
        item.establishment?.business_establishment_id;

      if (!estId) return item;

      try {
        const data = await client
          .get(`/public/establishments/${estId}`)
          .then(res => res.data.establishment);
        return { ...item, establishment: data };
      } catch {
        return item;
      }
    })
  );

export async function getTravelHistory() {
  const res = await client.get('/tourist/itineraries/history');
  return res.data;
}

export async function checkinStop(itineraryId, establishmentId) {
  const res = await client.post(`/tourist/itineraries/${itineraryId}/checkin`, {
    business_establishment_id: establishmentId,
  });
  return res.data; // contains updated itinerary + allVisited flag
}

export async function completeItinerary(itineraryId) {
  const res = await client.post(`/tourist/itineraries/${itineraryId}/complete`);
  return res.data;
}

export const markStopVisited = (itineraryId, establishmentId) =>
  api.post(`/tourist/itineraries/${itineraryId}/check-in`, { establishment_id: establishmentId });

export const submitFeedback = payload =>
  api.post('/tourist/feedback', payload);

export const uploadFeedbackMedia = formData =>
  api.post('/tourist/media', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const shareCompletedItinerary = (itineraryId, caption) =>
  client.post(`/tourist/shared-itineraries/${itineraryId}/share`, { caption }).then(res => res.data.shared);

export const fetchSharedItineraries = limit =>
  client.get('/tourist/shared-itineraries', { params: { limit } }).then(res => res.data.items ?? []);

export async function recordQrArrival(establishmentId, coords = {}) {
  return client.post('/tourist/qr-arrivals', {
    business_establishment_id: establishmentId,
    latitude: coords.latitude,
    longitude: coords.longitude,
  }).then(res => res.data);
}
