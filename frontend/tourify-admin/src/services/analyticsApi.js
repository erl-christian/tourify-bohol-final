import http from './httpClient';

export const fetchVisitorAnalytics = params =>
  http.get('/admin/analytics/visitors', { params });

export const fetchDestinationAnalytics = params =>
  http.get('/admin/analytics/destinations', { params });

export const fetchMovementAnalytics = params =>
  http.get('/admin/analytics/movements', { params });

export const fetchProvinceTrends = params =>
  http.get('/admin/analytics/arrivals/province', { params });

export const fetchMunicipalityArrivals = params =>
  http.get('/admin/analytics/arrivals/municipalities', { params });

export const fetchTopDestinations = params =>
  http.get('/admin/analytics/destinations', { params });

export const fetchVisitorHeatmap = params =>
  http.get('/admin/analytics/heatmap', { params });

export const fetchFeedbackDistribution = () =>
  http.get('/admin/analytics/feedback-distribution');

export const fetchAccreditationSummary = () =>
  http.get('/admin/analytics/accreditation');
