import http from './httpClient';

// Owner routes
export const fetchOwnerFeedback = (estId, params) =>
  http.get(`/admin/establishments/${estId}/feedback`, { params });

export const ownerReplyToFeedback = (feedbackId, payload) =>
  http.post(`/admin/establishments/feedback/${feedbackId}/reply`, payload);

// LGU routes
export const fetchLguFeedback = (estId, params) =>
  http.get(`/admin/lgu/establishments/${estId}/feedback`, { params });

export const lguReplyToFeedback = (feedbackId, payload) =>
  http.post(`/admin/lgu/feedback/${feedbackId}/reply`, payload);

// Shared helper (both roles may view a single thread)
export const fetchFeedbackDetails = feedbackId =>
  http.get(`/admin/feedback/${feedbackId}`);

// Feedback summaries (LGU/BTO)
export const fetchLatestFeedbackSummary = estId =>
  http.get(`/admin/lgu/establishments/${estId}/feedback-summary/latest`);

export const generateFeedbackSummary = (estId, params) =>
  http.post(`/admin/lgu/establishments/${estId}/feedback-summary`, null, { params });

// Feedback summaries (Owner / Establishment account)
export const fetchLatestOwnerFeedbackSummary = estId =>
  http.get(`/admin/establishments/${estId}/feedback-summary/latest`);

export const generateOwnerFeedbackSummary = (estId, params) =>
  http.post(`/admin/establishments/${estId}/feedback-summary`, null, { params });

export const fetchFeedbackStats = estId =>
  http.get(`/admin/analytics/establishments/${estId}/feedback-stats`);

export const fetchBtoFeedback = (estId, params) =>
  http.get(`/admin/bto/establishments/${estId}/feedback`, { params });

export const btoReplyToFeedback = (feedbackId, payload) =>
  http.post(`/admin/bto/feedback/${feedbackId}/reply`, payload);

export const btoModerateFeedback = (feedbackId, payload) =>
  http.patch(`/admin/bto/feedback/${feedbackId}/moderate`, payload);

export const lguModerateFeedback = (feedbackId, payload) =>
  http.patch(`/admin/lgu/feedback/${feedbackId}/moderate`, payload);



