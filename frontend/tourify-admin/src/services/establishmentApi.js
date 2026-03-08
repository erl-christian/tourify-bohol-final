import http from "./httpClient"

export const fetchOwnerEstablishments = (params) =>
  http.get('/admin/establishments', { params });

export const createOwnerEstablishment = (payload) =>
  http.post('/admin/establishments', payload);

export const regenerateQr = (estId) =>
  http.post(`/admin/establishments/${estId}/qr`);

//media
export const uploadEstablishmentMedia = (estId, formData, mediaKind = 'spot_gallery') => {
  formData.set('media_kind', mediaKind);
  return http.post(`/admin/establishments/${estId}/media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const fetchEstablishmentMedia = (estId, mediaKind) =>
  http.get(`/admin/establishments/${estId}/media`, {
    params: mediaKind ? { media_kind: mediaKind } : undefined,
  });

export const deleteEstablishmentMedia = (estId, mediaId) =>
  http.delete(`/admin/establishments/${estId}/media/${mediaId}`);

export const updateOwnerEstablishment = (estId, payload) =>
  http.patch(`/admin/establishments/${estId}`, payload);

export const fetchOwnerEstablishmentActivity = (estId) =>
  http.get(`/admin/establishments/${estId}/activity`);


