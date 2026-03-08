import http from "./httpClient"

export const fetchLguAccounts = () => http.get('/admin/bto/list');
export const createLguStaff = (payload) =>
  http.post('/admin/lgu/create-lgu-staff', payload);
export const createOwnerProfile = (payload) =>
  http.post('/admin/lgu/create-owner', payload);

export const fetchMunicipalOwners = () =>
  http.get('/admin/lgu/owners');

export const createLguEstablishment = (payload) =>
  http.post('/admin/lgu/establishments', payload);

// LGU-scoped establishments
export const fetchLguEstablishments = (params) =>
  http.get('/admin/lgu/establishments', { params });

export const fetchLguPendingEstablishments = (params) =>
  http.get('/admin/lgu/establishments/pending', { params });

export const actOnEstablishment = (estId, payload) =>
  http.post(`/admin/lgu/establishments/${estId}/approval`, payload);

export const fetchLguEstablishmentDetails = (estId) =>
  http.get(`/admin/lgu/establishments/${estId}`);

export const endorseEstablishmentToAdmin = (estId, payload) =>
  http.post(`/admin/lgu/establishments/${estId}/endorse`, payload);

export const updateManagedAccountStatus = (accountId, isActive) =>
  http.patch(`/admin/lgu/accounts/${accountId}/status`, { is_active: isActive });

export const updateManagedAccount = (accountId, payload) =>
  http.patch(`/admin/lgu/accounts/${accountId}`, payload);

export const fetchLguEstablishmentMedia = (estId, mediaKind) =>
  http.get(`/admin/establishments/${estId}/media`, {
    params: mediaKind ? { media_kind: mediaKind } : undefined,
  });

