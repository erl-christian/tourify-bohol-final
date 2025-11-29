import http from './httpClient';

export const fetchOwnerRatingTrend = estId =>
  http.get(`/owner/analytics/${estId}/rating-trend`);

export const fetchOwnerReviewCounts = estId =>
  http.get(`/owner/analytics/${estId}/review-counts`);

export const fetchOwnerCheckins = estId =>
  http.get(`/owner/analytics/${estId}/checkins`);

export const fetchOwnerFeedbackCategories = estId =>
  http.get(`/owner/analytics/${estId}/feedback-categories`);

export const fetchOwnerTagPerformance = estId =>
  http.get(`/owner/analytics/${estId}/tag-performance`);
