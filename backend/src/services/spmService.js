import TravelHistory from '../models/tourist/TravelHistory.js';
import BusinessEstablishment from '../models/businessEstablishmentModels/BusinessEstablishment.js';
import FrequentSequence from '../models/recommendations/FrequentSequence.js';

let isRunning = false;
let lastRunAt = null;
let rerunRequested = false;

const normalizeId = v => (typeof v === 'string' && v.trim() ? v.trim() : null);
const pairKey = (fromId, toId) => `${fromId}::${toId}`;
const scopedPairKey = (municipalityId, fromId, toId) => `${municipalityId}::${fromId}::${toId}`;
const scopedNodeKey = (municipalityId, estId) => `${municipalityId}::${estId}`;

const getWindowDays = () => {
  const parsed = Number(process.env.SPM_WINDOW_DAYS ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildVisitFilter = () => {
  const windowDays = getWindowDays();
  const filter = { status: 'visited' };

  if (windowDays > 0) {
    filter.date_visited = {
      $gte: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000),
    };
  }

  return filter;
};

const increment = (map, mapKey, by = 1) => {
  map.set(mapKey, (map.get(mapKey) || 0) + by);
};

const startBackgroundMining = reason => {
  setImmediate(() => {
    runSpmMining().catch(err => {
      console.warn(`[SPM] ${reason} failed: ${err.message}`);
    });
  });
};

const splitScopedPairKey = raw => {
  const [municipalityId, fromId, toId] = raw.split('::');
  return { municipalityId, fromId, toId };
};

export async function runSpmMining() {
  if (isRunning) throw new Error('SPM mining is already running');
  isRunning = true;

  try {
    const windowDays = getWindowDays();

    const visits = await TravelHistory.find(buildVisitFilter())
      .select('tourist_profile_id itinerary_id business_establishment_id date_visited scheduled_date createdAt')
      .sort({
        tourist_profile_id: 1,
        itinerary_id: 1,
        date_visited: 1,
        scheduled_date: 1,
        createdAt: 1,
        _id: 1,
      })
      .lean();

    const estIds = [...new Set(visits.map(v => normalizeId(v.business_establishment_id)).filter(Boolean))];
    const establishments = estIds.length
      ? await BusinessEstablishment.find({
          $or: [
            { businessEstablishment_id: { $in: estIds } },
            { business_establishment_id: { $in: estIds } },
          ],
        })
          .select('businessEstablishment_id business_establishment_id municipality_id')
          .lean()
      : [];

    const estToMunicipality = new Map();
    establishments.forEach(est => {
      const estId = est.businessEstablishment_id ?? est.business_establishment_id ?? null;
      if (!estId) return;
      estToMunicipality.set(estId, est.municipality_id ?? null);
    });

    const globalSupport = new Map();
    const globalFromSupport = new Map();
    const globalToSupport = new Map();

    const scopedSupport = new Map();
    const scopedFromSupport = new Map();
    const scopedToSupport = new Map();

    const lastByTouristItinerary = new Map();

    for (const visit of visits) {
      const touristId = normalizeId(visit.tourist_profile_id);
      const itineraryId = normalizeId(visit.itinerary_id);
      const currId = normalizeId(visit.business_establishment_id);
      if (!touristId || !itineraryId || !currId) continue;

      const sessionKey = `${touristId}::${itineraryId}`;
      const prevId = normalizeId(lastByTouristItinerary.get(sessionKey));

      if (prevId && prevId !== currId) {
        increment(globalSupport, pairKey(prevId, currId));
        increment(globalFromSupport, prevId);
        increment(globalToSupport, currId);

        const prevMunicipality = estToMunicipality.get(prevId) ?? null;
        const currMunicipality = estToMunicipality.get(currId) ?? null;
        const municipalities = [...new Set([prevMunicipality, currMunicipality].filter(Boolean))];

        municipalities.forEach(municipalityId => {
          increment(scopedSupport, scopedPairKey(municipalityId, prevId, currId));
          increment(scopedFromSupport, scopedNodeKey(municipalityId, prevId));
          increment(scopedToSupport, scopedNodeKey(municipalityId, currId));
        });
      }

      lastByTouristItinerary.set(sessionKey, currId);
    }

    const globalTotalTo = [...globalToSupport.values()].reduce((a, b) => a + b, 0) || 1;

    const municipalityTotalTo = new Map();
    for (const [nodeKey, count] of scopedToSupport.entries()) {
      const [municipalityId] = nodeKey.split('::');
      municipalityTotalTo.set(municipalityId, (municipalityTotalTo.get(municipalityId) || 0) + count);
    }

    const docs = [];

    for (const [transition, support] of globalSupport.entries()) {
      const [fromId, toId] = transition.split('::');
      const fromSup = globalFromSupport.get(fromId) || 1;
      const toSup = globalToSupport.get(toId) || 1;
      const confidence = support / fromSup;
      const lift = confidence / ((toSup / globalTotalTo) || 1e-6);

      docs.push({
        from_business_establishment_id: fromId,
        to_business_establishment_id: toId,
        municipality_id: null,
        support,
        from_support: fromSup,
        confidence,
        lift,
        window_days: windowDays,
        updated_at: new Date(),
      });
    }

    for (const [transition, support] of scopedSupport.entries()) {
      const { municipalityId, fromId, toId } = splitScopedPairKey(transition);
      const fromSup = scopedFromSupport.get(scopedNodeKey(municipalityId, fromId)) || 1;
      const toSup = scopedToSupport.get(scopedNodeKey(municipalityId, toId)) || 1;
      const totalTo = municipalityTotalTo.get(municipalityId) || 1;
      const confidence = support / fromSup;
      const lift = confidence / ((toSup / totalTo) || 1e-6);

      docs.push({
        from_business_establishment_id: fromId,
        to_business_establishment_id: toId,
        municipality_id: municipalityId,
        support,
        from_support: fromSup,
        confidence,
        lift,
        window_days: windowDays,
        updated_at: new Date(),
      });
    }

    await FrequentSequence.deleteMany({});
    if (docs.length) await FrequentSequence.insertMany(docs, { ordered: false });

    lastRunAt = new Date();
    return {
      upserts: docs.length,
      lastRunAt,
      windowDays,
      message: windowDays > 0 ? `Windowed (${windowDays} days)` : 'All-time',
    };
  } finally {
    isRunning = false;

    if (rerunRequested) {
      rerunRequested = false;
      startBackgroundMining('queued rerun');
    }
  }
}

export function queueSpmMining(reason = 'auto-trigger') {
  if (isRunning) {
    rerunRequested = true;
    return { queued: true, running: true, reason };
  }

  startBackgroundMining(reason);
  return { queued: true, running: false, reason };
}

export const getSpmStatus = () => ({
  running: isRunning,
  lastRunAt,
  windowDays: getWindowDays(),
});
