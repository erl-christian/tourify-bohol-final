// frontend/tourify-tourist/lib/feedback.js
import client from './http';

// POST /api/tourist/feedback
export async function createFeedback({ itinerary_id, business_establishment_id, rating, review_text }) {
  const res = await client.post('/tourist/feedback', {
    itinerary_id,
    business_establishment_id,
    rating,
    review_text,
  });
  return res.data?.feedback;
}

// POST /api/tourist/feedback/:feedbackId/media (multipart/form-data)
export async function uploadFeedbackMedia(feedbackId, files = []) {
  if (!files.length) return [];
  const form = new FormData();
  files.forEach((asset, idx) => {
    form.append('files', {
      uri: asset.uri,
      name: asset.fileName ?? `feedback-${feedbackId}-${idx}.jpg`,
      type: asset.mimeType ?? asset.type ?? 'image/jpeg',
    });
  });
  const res = await client.post(`/tourist/feedback/${feedbackId}/media`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

// GET /api/tourist/feedback/my
export async function getMyFeedback() {
  const res = await client.get('/tourist/feedback/my');
  return res.data?.feedback ?? [];
}

// GET /api/public/establishments/:estId/feedback
export async function listPublicFeedback(establishmentId, { page = 1, sort = 'newest', min_rating, hasText } = {}) {
  const query = new URLSearchParams({
    page: String(page),
    sort,
  });
  if (min_rating) query.append('min_rating', String(min_rating));
  if (hasText) query.append('has_text', 'true');

  const res = await client.get(`/public/establishments/${establishmentId}/feedback?${query.toString()}`);
  return res.data;
}

// Optional helper for a single feedback record (with replies)
export async function getFeedback(feedbackId) {
  const res = await client.get(`/public/feedback/${feedbackId}`);
  return res.data;
}

export const listFeedbackThread = establishmentId =>
  client.get(`/feedback/establishments/${establishmentId}`).then(res => res.data);

export const replyToFeedback = (feedbackId, payload) =>
  client.post(`/feedback/${feedbackId}/reply`, payload).then(res => res.data);


export const fetchEstablishmentFeedback = (establishmentId, params = {}) =>
  client
    .get(`/public/establishments/${establishmentId}/feedback`, { params })
    .then(res => res.data?.feedback ?? res.data?.items ?? []);

export const submitTouristFeedback = payload =>
  client.post('/tourist/feedback', payload).then(res => res.data?.feedback ?? res.data);
