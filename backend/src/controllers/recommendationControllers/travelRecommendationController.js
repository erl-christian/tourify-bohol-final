import TravelRecommendation from '../../models/recommendations/TravelRecommendation.js';
import BusinessEstablishment from '../../models/businessEstablishmentModels/BusinessEstablishment.js';
import EstablishmentTag from '../../models/tagModels/EstablishmentTag.js';
import Tag from '../../models/tagModels/Tag.js';
import TravelHistory from '../../models/tourist/TravelHistory.js';
import FrequentSequence from '../../models/recommendations/FrequentSequence.js';

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function getLastVisitedIds(tourist_profile_id, n = 3) {
  const rows = await TravelHistory.find({ tourist_profile_id })
    .select('business_establishment_id date_visited')
    .sort({ date_visited: -1 })
    .limit(n)
    .lean();
  return rows.map(r => r.business_establishment_id);
}

const WEIGHTS = { tagMatch: 0.45, rating: 0.35, distance: 0.15, popularity: 0.05 };

function scoreOne({ tagHits = 0, tagUniverse = 1, rating = 0, distanceKm = 0, feedbackCount = 0 }) {
  const tagScore = tagUniverse > 0 ? tagHits / tagUniverse : 0;
  const ratingScore = Math.min(Math.max(rating / 5, 0), 1);
  const distanceScore = Math.max(0, 1 - distanceKm / 20);
  const popularityScore = Math.min(feedbackCount / 50, 1);
  const raw =
    WEIGHTS.tagMatch * tagScore +
    WEIGHTS.rating * ratingScore +
    WEIGHTS.distance * distanceScore +
    WEIGHTS.popularity * popularityScore;
  return Math.round(raw * 100);
}

export const generateRecommendations = async (req, res, next) => {
  try {
    const {
      tourist_profile_id,
      location,
      preferences = [],
      municipality_id,
      radius,
      limit = 20,
    } = req.body;

    if (!tourist_profile_id) {
      res.status(400);
      throw new Error('tourist_profile_id is required');
    }

    const hasPreferences = Array.isArray(preferences) && preferences.length > 0;
    const radiusKm = typeof radius === 'number' && Number.isFinite(radius) && radius > 0 ? radius : null

    const query = { status: 'approved' };
    if (municipality_id) query.municipality_id = municipality_id;

    const establishments = await BusinessEstablishment.find(query)
      .select(
        'businessEstablishment_id name latitude longitude rating_avg rating_count address type municipality_id status'
      )
      .lean();

    if (!establishments.length) {
      return res.json({ page: 1, pageSize: 0, pages: 1, total: 0, items: [] });
    }

    const estIds = establishments.map(e => e.businessEstablishment_id);
    const estTags = await EstablishmentTag.find({ business_establishment_id: { $in: estIds } })
      .select('business_establishment_id tag_id')
      .lean();

    const tagIds = [...new Set(estTags.map(t => t.tag_id))];
    const tagDocuments = await Tag.find({ tag_id: { $in: tagIds } })
      .select('tag_id tag_name')
      .lean();

    const tagDict = Object.fromEntries(tagDocuments.map(t => [t.tag_id, t.tag_name]));
    const estToTagNames = new Map();
    for (const rel of estTags) {
      const name = tagDict[rel.tag_id];
      if (!name) continue;
      if (!estToTagNames.has(rel.business_establishment_id)) {
        estToTagNames.set(rel.business_establishment_id, new Set());
      }
      estToTagNames.get(rel.business_establishment_id).add(name.toLowerCase());
    }

    const prefSet = new Set(preferences.map(p => p.toLowerCase()));
    const lastVisited = await getLastVisitedIds(tourist_profile_id, 3);

    const spmMap = new Map();
    if (lastVisited.length) {
      const spmRows = await FrequentSequence.find({
        from_business_establishment_id: { $in: lastVisited },
        to_business_establishment_id: { $in: estIds },
      })
        .select('from_business_establishment_id to_business_establishment_id confidence lift')
        .lean();

      for (const r of spmRows) {
        spmMap.set(
          `${r.from_business_establishment_id}::${r.to_business_establishment_id}`,
          { c: r.confidence, l: r.lift }
        );
      }
    }

    const results = [];

    for (const est of establishments) {
      const tags = Array.from(estToTagNames.get(est.businessEstablishment_id) || []);
      const tagHits = tags.filter(t => prefSet.has(t)).length;

      const canMeasureDistance =
        location &&
        typeof location.lat === 'number' &&
        typeof location.lng === 'number' &&
        est.latitude != null &&
        est.longitude != null;

      const distanceKm =
        location && est.latitude != null && est.longitude != null
          ? haversineKm(location.lat, location.lng, est.latitude, est.longitude)
          : 0;
      if (hasPreferences && tagHits === 0) {
        continue;
      }

      if (radiusKm !== null && distanceKm !== null && distanceKm > radiusKm) {
        continue;
      }

      const baseScore = scoreOne({
        tagHits,
        tagUniverse: Math.max(preferences.length, 1),
        rating: est.rating_avg || 0,
        distanceKm: distanceKm ?? 0,
        feedbackCount: est.rating_count || 0,
      });

      let bestC = 0;
      let bestL = 1;
      let bestFrom = null;
      for (const from of lastVisited) {
        const hit = spmMap.get(`${from}::${est.businessEstablishment_id}`);
        if (hit && hit.c > bestC) {
          bestC = hit.c;
          bestL = hit.l;
          bestFrom = from;
        }
      }
      const spmWeight = 12;
      const normLift = Math.min(bestL / 2, 1);
      const spmBonus = Math.round(spmWeight * bestC * normLift);

      const reasonParts = [];
      if (tagHits) reasonParts.push(`Tag match: ${tagHits}/${Math.max(preferences.length, 1)}`);
      if (est.rating_avg != null) reasonParts.push(`Rating: ${Number(est.rating_avg).toFixed(1)}`);
      if (location) reasonParts.push(`Near: ${distanceKm.toFixed(1)} km`);
      if (spmBonus > 0 && bestFrom) reasonParts.push(`Sequence: after ${bestFrom} → +${spmBonus}`);
      if (distanceKm !== null) reasonParts.push(`Near: ${distanceKm.toFixed(1)} km`);
      const reason = reasonParts.join(' • ') || 'General popularity and proximity';

      const finalScore = Math.min(baseScore + spmBonus, 100);

      results.push({
        tourist_profile_id,
        businessEstablishment_id: est.businessEstablishment_id,
        score: finalScore,
        reason,
        accessibility_status: est.status === 'approved' ? 'Open' : 'Limited Access',
        params: {
          preferences,
          municipality_id,
          location,
          weights: WEIGHTS,
          spm: { bestFrom, confidence: bestC, lift: bestL },
        },
        source: spmBonus > 0 ? 'hybrid' : 'rule_mvp',
      });
    }

    results.sort((a, b) => b.score - a.score);
    const top = results.slice(0, Number(limit));
    const docs = await TravelRecommendation.insertMany(top);

    return res.json({
      page: 1,
      pageSize: docs.length,
      pages: 1,
      total: docs.length,
      items: docs,
    });
  } catch (err) {
    next(err);
  }
};

export const listRecommendations = async (req, res, next) => {
  try {
    const { tourist_profile_id, limit = 20 } = req.query;
    if (!tourist_profile_id) {
      res.status(400);
      throw new Error('tourist_profile_id is required');
    }

    const items = await TravelRecommendation.find({ tourist_profile_id })
      .sort({ generated_at: -1, score: -1 })
      .limit(Number(limit));

    return res.json({
      page: 1,
      pageSize: items.length,
      pages: 1,
      total: items.length,
      items,
    });
  } catch (err) {
    next(err);
  }
};
