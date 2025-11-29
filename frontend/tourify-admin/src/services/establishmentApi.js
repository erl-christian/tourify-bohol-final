import http from "./httpClient"

export const fetchOwnerEstablishments = (params) =>
  http.get('/admin/establishments', { params });

export const createOwnerEstablishment = (payload) =>
  http.post('/admin/establishments', payload);

export const regenerateQr = (estId) =>
  http.post(`/admin/establishments/${estId}/qr`);

//media
export const uploadEstablishmentMedia = (estId, formData) =>
  http.post(`/admin/establishments/${estId}/media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const fetchEstablishmentMedia = (estId) =>
  http.get(`/admin/establishments/${estId}/media`);

export const deleteEstablishmentMedia = (estId, mediaId) =>
  http.delete(`/admin/establishments/${estId}/media/${mediaId}`);

export const updateOwnerEstablishment = (estId, payload) =>
  http.patch(`/admin/establishments/${estId}`, payload);


