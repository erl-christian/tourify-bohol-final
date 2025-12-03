import http from './httpClient';

// BTO: LGU admin + staff directory
export const fetchAdminStaffProfiles = () =>
  http.get('/admin/bto/list');

export const createLguAdmin = (payload) =>
  http.post('/admin/bto/create-lgu-admin', payload);

// BTO: Establishment oversight
export const fetchAllEstablishments = (params) =>
  http.get('/admin/bto/establishments', { params });

// Municipality directory (shared)
export const fetchMunicipalities = () =>
  http.get('/municipalities');

export const createMunicipality = (payload) =>
  http.post('/municipalities', payload);

export const updateLguAdminStatus = (accountId, isActive) =>
  http.patch(`/admin/bto/lgu-admins/${accountId}/status`, { is_active: isActive });

export const updateLguAdmin = (accountId, payload) =>
  http.patch(`/admin/bto/lgu-admins/${accountId}`, payload);

export const fetchEstablishmentDetails = (estId) =>
  http.get(`/admin/bto/establishments/${estId}`);