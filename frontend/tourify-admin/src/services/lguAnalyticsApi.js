import http from './httpClient';

export const fetchLguArrivals = params =>
  http.get('/lgu/analytics/arrivals', { params });

export const fetchLguMovements = params =>
  http.get('/lgu/analytics/movements', { params });

export const fetchLguTopEstablishments = params =>
  http.get('/lgu/analytics/top-establishments', { params });

export const fetchLguFeedbackSummary = () =>
  http.get('/lgu/analytics/feedback-summary');

export const fetchLguApprovalStats = () =>
  http.get('/lgu/analytics/approvals');

export const fetchLguCheckins = params =>
  http.get('/lgu/analytics/checkins', { params });

export const fetchLguItineraryStops = params =>
  http.get('/lgu/analytics/itinerary-stops', { params });
