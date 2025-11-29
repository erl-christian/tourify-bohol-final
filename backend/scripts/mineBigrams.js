import "dotenv/config.js";
import mongoose from "mongoose";
import TravelHistory from "../src/models/tourist/TravelHistory.js";
import BusinessEstablishment from "../src/models/businessEstablishmentModels/BusinessEstablishment.js";
import FrequentSequence from "../src/models/recommendations/FrequentSequence.js";

const normalizeId = value =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const WINDOW_DAYS = Number(process.env.SPM_WINDOW_DAYS || 365);

const sinceDate = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

async function connect() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB });
}

function key(a,b,m=null){ return `${a}::${b}::${m||""}`; }

async function run() {
  await connect();

  // 1) Load visits per tourist ordered by time (use date_visited or actual_arrival)
  const visits = await TravelHistory.find({ date_visited: { $gte: sinceDate } })
    .select("tourist_profile_id business_establishment_id date_visited")
    .sort({ tourist_profile_id: 1, date_visited: 1 })
    .lean();

  // 2) Map establishment -> municipality for optional scope
  const estIds = [...new Set(visits.map(v => v.business_establishment_id))];
  const ests = await BusinessEstablishment.find({ business_establishment_id: { $in: estIds } })
    .select("business_establishment_id municipality_id")
    .lean();
  const estToMun = Object.fromEntries(ests.map(e => [e.business_establishment_id, e.municipality_id || null]));

  // 3) Count transitions
  const support = new Map();         // (A→B) -> count
  const fromSupport = new Map();     // A -> count of times A appeared as predecessor
  const toSupport = new Map();       // B -> count of times B appeared as successor

  let lastByTourist = new Map();     // tourist -> last est_id

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

  // 4) Compute confidence & lift and upsert
  const bulk = [];
  for (const [k, sup] of support) {
    const [from_id, to_id, mun] = k.split("::");
    const fromSup = fromSupport.get(from_id) || 1;
    const toSup = toSupport.get(to_id) || 1;

    const confidence = sup / fromSup;                // P(B|A)
    const pB = toSup / [...toSupport.values()].reduce((a,b)=>a+b, 0); // global P(B)
    const lift = confidence / (pB || 1e-6);

    bulk.push({
      updateOne: {
        filter: {
          from_business_establishment_id: from_id,
          to_business_establishment_id: to_id,
          municipality_id: mun || null
        },
        update: {
          $set: {
            support: sup,
            from_support: fromSup,
            confidence,
            lift,
            window_days: WINDOW_DAYS,
            updated_at: new Date(),
          }
        },
        upsert: true
      }
    });
  }

  if (bulk.length) {
    await FrequentSequence.bulkWrite(bulk, { ordered: false });
  }

  console.log(`SPM bigram mining done. Upserts: ${bulk.length}`);
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
