import client from './http';

const FALLBACK_IMAGE = require('../assets/auth-hero.jpg');

const pickFirstMediaUrl = mediaList => {
  const list = Array.isArray(mediaList) ? mediaList : [];
  const entry = list.find(item => (item.file_type ?? item.type ?? 'image').startsWith('image'));
  return entry?.file_url ?? entry?.url ?? entry?.uri ?? null;
};

const toImageSource = input => {
  if (!input) return null;
  if (typeof input === 'number') return input;
  if (typeof input === 'string') return { uri: input };
  if (typeof input === 'object' && input.uri) return input;
  return null;
};

export const getEstablishment = id =>
  client.get(`/public/establishments/${id}`).then(res => res.data.establishment);

export const enrichRecommendations = async items => {
  const list = Array.isArray(items)
    ? items
    : Array.isArray(items?.items)
      ? items.items
      : [];

  const enriched = await Promise.all(
    list.map(async rec => {
      const establishmentId =
        rec?.businessEstablishment_id ??
        rec?.business_establishment_id ??
        rec?.establishment?.businessEstablishment_id ??
        rec?.establishment?.business_establishment_id;

      if (!establishmentId) return rec;

      try {
        const establishment = await getEstablishment(establishmentId);
        return { ...rec, establishment };
      } catch {
        return rec;
      }
    })
  );
  return enriched.filter(item => item?.establishment);
};

export const listPublicEstablishments = (params = {}) =>
  client
    .get('/public/establishments', { params: { pageSize: 6, sort: 'rating_desc', ...params } })
    .then(res => res.data.items ?? []);

  export const toTitle = str =>
  (str ?? '')
    .toString()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());

export const normaliseEstablishmentSource = source => {
  if (!source) return null;
  if (source.establishment) return source;
  return { ...source, establishment: { ...source } };
};

export const buildEstablishmentCard = (source, fallbackIndex = 0) => {
  const normalised = normaliseEstablishmentSource(source) ?? {};
  const est = normalised.establishment ?? {};

  const heroCandidate =
    normalised.image ??
    est.coverImage ??
    est.heroImage ??
    est.primaryImage ??
    pickFirstMediaUrl(est.media) ??
    est.photos?.[0] ??
    null;

  const image = toImageSource(heroCandidate) ?? FALLBACK_IMAGE;

  return {
    id:
      normalised.travel_recommendation_id ??
      est.businessEstablishment_id ??
      est.business_establishment_id ??
      est._id ??
      `dest-${fallbackIndex}`,
    image,
    title: est.name ?? 'Bohol Destination',
    municipality: est.municipality_id ?? est.address ?? 'Bohol',
    tags: est.tag_names ?? (est.type ? [est.type] : ['Verified']),
    rating: typeof est.rating_avg === 'number' ? est.rating_avg : 0,
    reason: normalised.reason ?? 'Officially accredited by BTO/LGUs.',
  };
};

export const extractEstablishmentId = payload => {
  if (!payload) return null;
  const est = payload.establishment ?? payload;
  return (
    est.businessEstablishment_id ??
    est.business_establishment_id ??
    payload.travel_recommendation_id ??
    est._id ??
    null
  );
};

export const amenityIconMap = {
  wifi: 'wifi-outline',
  parking: 'car-outline',
  food: 'restaurant-outline',
  accessibility: 'accessibility-outline',
  lodging: 'bed-outline',
  transport: 'bus-outline',
  guide: 'people-outline',
};

export const formatReviewDate = iso =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';
