import TravelHistory from '../models/tourist/TravelHistory.js';
import BusinessEstablishment from '../models/businessEstablishmentModels/BusinessEstablishment.js';
import FrequentSequence from '../models/recommendations/FrequentSequence.js';

const WINDOW_DAYS = Number(process.env.SPM_WINDOW_DAYS || 365);
let isRunning = false;
let lastRunAt = null;

const normalizeId = v => (typeof v === 'string' && v.trim() ? v.trim() : null);
const key = (a, b, m = null) => `${a}::${b}::${m || ''}`;

export async function runSpmMining() {
  if (isRunning) throw new Error('SPM mining is already running');
  isRunning = true;
  try {
    const sinceDate = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const visits = await TravelHistory.find({ date_visited: { $gte: sinceDate } })
      .select('tourist_profile_id business_establishment_id date_visited')
      .sort({ tourist_profile_id: 1, date_visited: 1 })
      .lean();

    const estIds = [...new Set(visits.map(v => v.business_establishment_id))];
    const ests = await BusinessEstablishment.find({ business_establishment_id: { $in: estIds } })
      .select('business_establishment_id municipality_id')
      .lean();
    const estToMun = Object.fromEntries(ests.map(e => [e.business_establishment_id, e.municipality_id || null]));

    const support = new Map();
    const fromSupport = new Map();
    const toSupport = new Map();
    const lastByTourist = new Map();

    for (const visit of visits) {
      const prev = normalizeId(lastByTourist.get(visit.tourist_profile_id));
      const curr = normalizeId(visit.business_establishment_id);

      if (prev && curr && prev !== curr) {
        const mun = estToMun[curr] || estToMun[prev] || null;
        const k = key(prev, curr, mun);
        support.set(k, (support.get(k) || 0) + 1);
        fromSupport.set(prev, (fromSupport.get(prev) || 0) + 1);
        toSupport.set(curr, (toSupport.get(curr) || 0) + 1);
      }

      if (curr) lastByTourist.set(visit.tourist_profile_id, curr);
    }

    const totalToSupport = [...toSupport.values()].reduce((a, b) => a + b, 0) || 1;
    const bulk = [];
    for (const [k, sup] of support) {
      const [from_id, to_id, mun] = k.split('::');
      const fromSup = fromSupport.get(from_id) || 1;
      const toSup = toSupport.get(to_id) || 1;

      const confidence = sup / fromSup;
      const pB = toSup / totalToSupport;
      const lift = confidence / (pB || 1e-6);

      bulk.push({
        updateOne: {
          filter: {
            from_business_establishment_id: from_id,
            to_business_establishment_id: to_id,
            municipality_id: mun || null,
          },
          update: {
            $set: {
              support: sup,
              from_support: fromSup,
              confidence,
              lift,
              window_days: WINDOW_DAYS,
              updated_at: new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    if (bulk.length) {
      await FrequentSequence.bulkWrite(bulk, { ordered: false });
    }

    lastRunAt = new Date();
    return { upserts: bulk.length, lastRunAt };
  } finally {
    isRunning = false;
  }
}

export const getSpmStatus = () => ({
  running: isRunning,
  lastRunAt,
  windowDays: WINDOW_DAYS,
});
