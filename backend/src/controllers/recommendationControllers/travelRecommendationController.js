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

const normalizeToken = (value = '') =>
  String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const toFiniteNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const buildBudgetRange = (budget) => {
  if (!budget || typeof budget !== 'object') return null;

  const minRaw = toFiniteNumber(budget.min);
  const maxRaw = toFiniteNumber(budget.max);

  if (minRaw === null && maxRaw === null) return null;

  const min = Math.max(0, minRaw ?? 0);
  const max = Math.max(min, maxRaw ?? min);

  return { min, max };
};

const budgetMatches = (est, budgetRange) => {
  if (!budgetRange) return true;

  const estMinRaw = toFiniteNumber(est?.budget_min);
  const estMaxRaw = toFiniteNumber(est?.budget_max);

  const estMin = estMinRaw ?? 0;
  const estMax = estMaxRaw ?? Number.POSITIVE_INFINITY;

  // overlap check
  return estMax >= budgetRange.min && estMin <= budgetRange.max;
};

const countTagHits = (candidateTags, prefSet) => {
  if (!prefSet.size) return 0;

  let hits = 0;
  for (const pref of prefSet) {
    const matched = candidateTags.some(
      (tag) => tag === pref || tag.includes(pref) || pref.includes(tag)
    );
    if (matched) hits += 1;
  }
  return hits;
};


export const generateRecommendations = async (req, res, next) => {
  try {
    const {
      tourist_profile_id,
      location,
      preferences = [],
      municipality_id,
      budget,
      radius,
      limit = 100,
    } = req.body;

    if (!tourist_profile_id) {
      res.status(400);
      throw new Error('tourist_profile_id is required');
    }

    const safePreferences = Array.isArray(preferences)
      ? preferences.map(normalizeToken).filter(Boolean)
      : [];
    const prefSet = new Set(safePreferences);
    const hasPreferences = prefSet.size > 0;

    const radiusValue = toFiniteNumber(radius);
    const radiusKm = radiusValue !== null && radiusValue > 0 ? radiusValue : null;

    const budgetRange = buildBudgetRange(budget);
    const parsedLimit = Math.max(1, Math.min(200, Number(limit) || 100));

    const hasUserLocation =
      location &&
      Number.isFinite(location.lat) &&
      Number.isFinite(location.lng);

    const query = { status: 'approved' };
    if (municipality_id) query.municipality_id = municipality_id;

    const establishments = await BusinessEstablishment.find(query)
      .select(
        'businessEstablishment_id name latitude longitude rating_avg rating_count address type municipality_id status budget_min budget_max'
      )
      .lean();

    if (!establishments.length) {
      return res.json({ page: 1, pageSize: 0, pages: 1, total: 0, items: [] });
    }

    const estIds = establishments.map((e) => e.businessEstablishment_id);

    const estTags = await EstablishmentTag.find({
      business_establishment_id: { $in: estIds },
    })
      .select('business_establishment_id tag_id')
      .lean();

    const tagIds = [...new Set(estTags.map((t) => t.tag_id))];
    const tagDocuments = await Tag.find({ tag_id: { $in: tagIds } })
      .select('tag_id tag_name')
      .lean();

    const tagDict = Object.fromEntries(tagDocuments.map((t) => [t.tag_id, t.tag_name]));
    const estToTagNames = new Map();

    for (const rel of estTags) {
      const tagName = tagDict[rel.tag_id];
      if (!tagName) continue;

      if (!estToTagNames.has(rel.business_establishment_id)) {
        estToTagNames.set(rel.business_establishment_id, new Set());
      }
      estToTagNames.get(rel.business_establishment_id).add(tagName);
    }

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
        spmMap.set(`${r.from_business_establishment_id}::${r.to_business_establishment_id}`, {
          c: r.confidence,
          l: r.lift,
        });
      }
    }

    const results = [];

    for (const est of establishments) {
      if (!budgetMatches(est, budgetRange)) continue;

      const rawTags = Array.from(estToTagNames.get(est.businessEstablishment_id) || []);
      if (est.type) rawTags.push(est.type);

      const candidateTags = [...new Set(rawTags.map(normalizeToken).filter(Boolean))];
      const tagHits = countTagHits(candidateTags, prefSet);

      if (hasPreferences && tagHits === 0) continue;

      const hasEstCoords =
        Number.isFinite(est.latitude) && Number.isFinite(est.longitude);

      const distanceKm =
        hasUserLocation && hasEstCoords
          ? haversineKm(location.lat, location.lng, est.latitude, est.longitude)
          : null;

      if (radiusKm !== null) {
        if (distanceKm === null) continue;
        if (distanceKm > radiusKm) continue;
      }

      const baseScore = scoreOne({
        tagHits,
        tagUniverse: Math.max(prefSet.size, 1),
        rating: est.rating_avg || 0,
        distanceKm: distanceKm ?? 20,
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
      if (tagHits) reasonParts.push(`Tag match: ${tagHits}/${Math.max(prefSet.size, 1)}`);
      if (est.rating_avg != null) reasonParts.push(`Rating: ${Number(est.rating_avg).toFixed(1)}`);
      if (distanceKm != null) reasonParts.push(`Near: ${distanceKm.toFixed(1)} km`);
      if (budgetRange) reasonParts.push(`Budget fit: PHP ${budgetRange.min}-${budgetRange.max}`);
      if (spmBonus > 0 && bestFrom) reasonParts.push(`Sequence boost: +${spmBonus}`);

      const reason = reasonParts.join(' | ') || 'General popularity and proximity';
      const finalScore = Math.min(baseScore + spmBonus, 100);

      results.push({
        tourist_profile_id,
        businessEstablishment_id: est.businessEstablishment_id,
        score: finalScore,
        reason,
        accessibility_status: est.status === 'approved' ? 'Open' : 'Limited Access',
        params: {
          preferences: safePreferences,
          municipality_id,
          location: hasUserLocation ? location : null,
          budget: budgetRange,
          radius: radiusKm,
          weights: WEIGHTS,
          spm: { bestFrom, confidence: bestC, lift: bestL },
        },
        source: spmBonus > 0 ? 'hybrid' : 'rule_mvp',
      });
    }

    results.sort((a, b) => b.score - a.score);
    const top = results.slice(0, parsedLimit);

    if (!top.length) {
      return res.json({
        page: 1,
        pageSize: 0,
        pages: 1,
        total: 0,
        items: [],
        message: 'No places matched your selected tags, budget, and radius.',
      });
    }

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
