import Feedback from '../../models/feedback/Feedback.js';
import FeedbackSummary from '../../models/Media/FeedbackSummary.js';
import OpenAI from 'openai';
import Itinerary from '../../models/tourist/Itinerary.js';
import TravelHistory from '../../models/tourist/TravelHistory.js';
import BusinessEstablishment from '../../models/businessEstablishmentModels/BusinessEstablishment.js';
import Municipality from '../../models/Municipality.js';
import FrequentSequence from '../../models/recommendations/FrequentSequence.js';
import AdminStaffProfile from '../../models/adminModels/AdminStaffProfile.js';

export async function resolveMunicipalityForLgu(accountId, role, fallbackId) {
  if (fallbackId || role === 'bto_admin') return fallbackId ?? null;
  if (!['lgu_admin', 'lgu_staff'].includes(role)) return null;

  const profile = await AdminStaffProfile.findOne({ account_id: accountId })
    .select('municipality_id')
    .lean();
  return profile?.municipality_id ?? null;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const callOpenAiSummary = async prompt => {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');

  const response = await openai.responses.create({
    model: 'gpt-4o-mini', // or gpt-4o, gpt-4.1, etc.
    input: prompt,
    max_output_tokens: 400,
  });

  const text =
    response.output?.[0]?.content?.[0]?.text ??
    response.choices?.[0]?.message?.content ??
    null;

  if (!text) {
    console.warn('OpenAI returned no text. Raw response:', JSON.stringify(response, null, 2));
  }

  return text?.trim();
};

export const getEstablishmentFeedbackStats = async (req, res, next) => {
  try {
    const { estId } = req.params;
    const [agg, buckets, recent] = await Promise.all([
      Feedback.aggregate([
        { $match: { business_establishment_id: estId } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]),
      Feedback.aggregate([
        { $match: { business_establishment_id: estId } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
      ]),
      Feedback.aggregate([
        { $match: { business_establishment_id: estId } },
        { $sort: { createdAt: -1 } },
        { $limit: 20 },
        { $project: { rating: 1, createdAt: 1 } },
      ]),
    ]);

    const summary = agg.length
      ? { average_rating: +agg[0].avg.toFixed(2), count: agg[0].count }
      : { average_rating: 0, count: 0 };

    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const b of buckets) dist[b._id] = b.count;

    res.json({ summary, distribution: dist, recent });
  } catch (e) {
    next(e);
  }
};

export const generateFeedbackSummary = async (req, res, next) => {
  try {
    const { estId } = req.params;
    const from = new Date(req.query.from);
    const to = new Date(req.query.to);
    if (isNaN(from) || isNaN(to) || from > to) {
      res.status(400);
      throw new Error('Invalid from/to range');
    }

    const reviews = await Feedback.find({
      business_establishment_id: estId,
      createdAt: { $gte: from, $lte: to },
    })
      .select('rating review_text createdAt')
      .lean();

    const count = reviews.length;
    const average =
      count > 0 ? +(reviews.reduce((acc, r) => acc + r.rating, 0) / count).toFixed(2) : 0;

    const positives = reviews.filter(r => r.rating >= 4 && r.review_text).slice(0, 2);
    const negatives = reviews.filter(r => r.rating <= 2 && r.review_text).slice(0, 2);
    const sampleComments = reviews
      .slice(-8)
      .map((rev, idx) => `${idx + 1}) ${rev.review_text ?? '(no text provided)'}`);

    let ai_summary =
      count === 0
        ? 'No feedback in this period.'
        : `From ${from.toLocaleDateString()} to ${to.toLocaleDateString()}, average rating was ${average}/5 across ${count} reviews. ${
            positives[0]?.review_text ? `Visitors praised things like "${positives[0].review_text}".` : ''
          } ${
            negatives[0]?.review_text ? `Others complained about "${negatives[0].review_text}".` : ''
          }`.trim();

    if (count > 0) {
      const prompt = `
ROLE
You are a neutral tourism-analytics assistant. Summarize reviews for municipal staff and establishment owners.

CONTEXT
Establishment: ${estId}
Date range: ${from.toDateString()} – ${to.toDateString()}
Average rating: ${average}/5 across ${count} reviews.

DATA (verbatim lines)
Positive comments:
${positives.length ? positives.map((r, i) => `${i + 1}) ${r.review_text}`).join('\n') : 'None'}

Negative comments:
${negatives.length ? negatives.map((r, i) => `${i + 1}) ${r.review_text}`).join('\n') : 'None'}

Additional samples:
${sampleComments.length ? sampleComments.join('\n') : 'None'}

TASKS
1) Cluster comments into aspects: Service, Staff, Cleanliness, Amenities/Facilities, Food/Drink, Location/Access, Price/Value, Safety, Experience/Activities, Other.
   - Count positive vs. negative mentions per aspect.
   - Remove duplicates/repeats; ignore off-topic text.
2) Write a single neutral paragraph (≤80 words) for municipal staff:
   - State overall sentiment briefly.
   - Name the top 2–3 praised aspects and top 2–3 issues.
   - Hedge if reviews are few or conflicting.
3) If there are issues, suggest up to 3 concise, actionable fixes, tagged with **Owner** (establishment) or **LGU** (municipality).

RULES
- No PII. No fabrication. Use only given text.
- Quotes must be ≤16 words and optional.
- If no reviews, say that plainly and skip actions.
- Tone: neutral, professional, Philippines English.

OUTPUT FORMAT (exactly this order)
Summary:
<one paragraph ≤80 words>
`;

      try {
        const aiText = await callOpenAiSummary(prompt);
        if (aiText) {
          ai_summary = aiText;
        } else {
          console.warn('OpenAI returned empty text; using fallback sentence.');
        }
      } catch (err) {
        console.warn('OpenAI summary failed, using fallback text', err.message);
      }
    }

    const doc = await FeedbackSummary.create({
      business_establishment_id: estId,
      time_range_start: from,
      time_range_end: to,
      count,
      average_rating: average,
      ai_summary,
    });

    res.status(201).json({ message: 'Feedback summary generated', summary: doc });
  } catch (e) {
    next(e);
  }
};

export const getLatestFeedbackSummary = async (req, res, next) => {
  try {
    const { estId } = req.params;
    const doc = await FeedbackSummary.findOne({ business_establishment_id: estId })
      .sort({ generated_at: -1, createdAt: -1 })
      .lean();

    if (!doc) {
      res.status(404);
      throw new Error('No summary found');
    }

    res.json(doc);
  } catch (e) {
    next(e);
  }
};

export const aggregateFeedbackDistribution = async (municipalityId = null) => {
  const pipeline = [
    ...(municipalityId
      ? [
          {
            $lookup: {
              from: 'businessestablishments',
              localField: 'business_establishment_id',
              foreignField: 'businessEstablishment_id',
              as: 'est',
            },
          },
          { $unwind: '$est' },
          { $match: { 'est.municipality_id': municipalityId } },
        ]
      : []),
    { $group: { _id: '$rating', count: { $sum: 1 } } },
  ];

  const buckets = await Feedback.aggregate(pipeline);
  const stars = [1, 2, 3, 4, 5];
  return stars.map(star => ({
    label: `${star}★`,
    count: buckets.find(b => b._id === star)?.count ?? 0,
  }));
};


export const aggregateVisitorTrends = async (scope = 'province', municipalityId = null) => {
  const match = {
    status: { $in: ['Planned', 'Ongoing', 'Completed'] },
  };
  if (scope === 'municipality' && municipalityId) {
    match['stops.municipality'] = municipalityId;
  }

  const itineraries = await Itinerary.aggregate([
    { $match: match },
    {
      $project: {
        month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        tourist_profile_id: 1,
      },
    },
    {
      $group: {
        _id: '$month',
        trips: { $sum: 1 },
        tourists: { $addToSet: '$tourist_profile_id' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return itineraries.map(item => ({
    month: item._id,
    trips: item.trips,
    touristCount: item.tourists.length,
  }));
};

export const aggregateTopDestinations = async ({ limit = 10, scope = 'province', municipalityId = null }) => {
  const match = {};
  if (scope === 'municipality' && municipalityId) {
    match.municipality_id = municipalityId;
  }

  const establishments = await BusinessEstablishment.aggregate([
    { $match: { ...(scope === 'municipality' && municipalityId ? { municipality_id: municipalityId } : {}) } },
    {
      $lookup: {
        from: 'feedbacks',
        localField: 'businessEstablishment_id',
        foreignField: 'business_establishment_id',
        as: 'feedback',
      },
    },
    {
      $project: {
        businessEstablishment_id: 1,
        name: 1,
        municipality_id: 1,
        rating_avg: { $avg: '$feedback.rating' },
        rating_count: { $size: '$feedback' },
      },
    },
    { $sort: { rating_count: -1 } },
    { $limit: limit },
  ]);

  return establishments;
};

export const aggregateMunicipalityArrivals = async (limit = 12, municipalityId = null) => {
  const baseMatch = { status: 'visited' };

  const pipeline = [
    { $match: baseMatch },
    {
      $lookup: {
        from: 'businessestablishments',
        localField: 'business_establishment_id',
        foreignField: 'businessEstablishment_id',
        as: 'est',
      },
    },
    { $unwind: '$est' },
    municipalityId
      ? { $match: { 'est.municipality_id': municipalityId } }
      : { $match: { 'est.municipality_id': { $ne: null, $ne: '' } } },
    {
      $group: {
        _id: {
          municipality: '$est.municipality_id',
          date: { $dateToString: { format: '%Y-%m-%d', date: '$date_visited' } },
          source: '$capture_method',
        },
        visits: { $sum: 1 },
        establishments: { $addToSet: '$est.name' },
      },
    },
    {
      $group: {
        _id: '$_id.municipality',
        records: {
          $push: {
            date: '$_id.date',
            source: '$_id.source',
            visits: '$visits',
            establishments: '$establishments',
          },
        },
        total: { $sum: '$visits' },
      },
    },
    { $sort: { total: -1 } },
    ...(municipalityId ? [] : [{ $limit: Number(limit) }]),
    {
      $lookup: {
        from: 'municipalities',
        localField: '_id',
        foreignField: 'municipality_id',
        as: 'municipality',
      },
    },
    { $unwind: { path: '$municipality', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        municipality: '$municipality.name',
        municipality_id: '$_id',
        total: '$total',
        records: 1,
      },
    },
  ];

  return TravelHistory.aggregate(pipeline);
};

export const aggregateHeatmapPoints = async (municipalityId = null) => {
  const rows = await TravelHistory.aggregate([
    { $match: { status: 'visited' } },
    {
      $lookup: {
        from: 'businessestablishments',
        localField: 'business_establishment_id',
        foreignField: 'businessEstablishment_id',
        as: 'est',
      },
    },
    { $unwind: '$est' },
    municipalityId
      ? { $match: { 'est.municipality_id': municipalityId } }
      : {
          $match: {
            'est.latitude': { $ne: null },
            'est.longitude': { $ne: null },
            'est.municipality_id': { $ne: null, $ne: '' },
          },
        },
    {
      $project: {
        lat: '$est.latitude',
        lng: '$est.longitude',
        municipality: '$est.municipality_id',
      },
    },
    { $match: { lat: { $ne: null }, lng: { $ne: null } } },
    {
      $group: {
        _id: { lat: '$lat', lng: '$lng' },
        weight: { $sum: 1 },
        municipality: { $first: '$municipality' },
      },
    },
    {
      $project: {
        lat: '$_id.lat',
        lng: '$_id.lng',
        weight: 1,
        municipality: 1,
      },
    },
  ]);

  if (rows.length || !municipalityId) return rows;

  // fallback for municipalities without TravelHistory entries
  const sequences = await FrequentSequence.find(
    municipalityId ? { municipality_id: municipalityId } : {},
  )
    .sort({ support: -1 })
    .limit(100)
    .lean();

  if (!sequences.length) return [];

  const estIds = [
    ...new Set(
      sequences.flatMap(seq => [
        normalizeEstablishmentId(seq.from_business_establishment_id),
        normalizeEstablishmentId(seq.to_business_establishment_id),
      ]),
    ),
  ].filter(Boolean);

  const establishments = await BusinessEstablishment.find({
    businessEstablishment_id: { $in: estIds },
  })
    .select('businessEstablishment_id latitude longitude municipality_id')
    .lean();

  const coordMap = Object.fromEntries(
    establishments
      .filter(est => est.latitude != null && est.longitude != null)
      .map(est => [
        est.businessEstablishment_id,
        { lat: est.latitude, lng: est.longitude, municipality: est.municipality_id },
      ]),
  );

  const fallbackPoints = sequences
    .map(seq => {
      const coords = coordMap[normalizeEstablishmentId(seq.from_business_establishment_id)];
      if (!coords) return null;
      if (municipalityId && coords.municipality !== municipalityId) return null;
      return {
        lat: coords.lat,
        lng: coords.lng,
        weight: seq.support ?? 1,
        municipality: coords.municipality,
      };
    })
    .filter(Boolean);

  return fallbackPoints;
};

const aggregateMunicipalityEstablishmentArrivals = async (municipalityId, limit = 25) => {
  if (!municipalityId) return [];

  const rows = await TravelHistory.aggregate([
    { $match: { status: 'visited' } },
    {
      $lookup: {
        from: 'businessestablishments',
        localField: 'business_establishment_id',
        foreignField: 'businessEstablishment_id',
        as: 'est',
      },
    },
    { $unwind: '$est' },
    { $match: { 'est.municipality_id': municipalityId } },
    {
      $group: {
        _id: {
          estId: '$est.businessEstablishment_id',
          capture: { $ifNull: [{ $toLower: '$capture_method' }, 'qr_scan'] },
        },
        visits: { $sum: 1 },
        name: { $first: '$est.name' },
      },
    },
    {
      $group: {
        _id: '$_id.estId',
        name: { $first: '$name' },
        buckets: {
          $push: {
            source: '$_id.capture',
            visits: '$visits',
          },
        },
        total: { $sum: '$visits' },
      },
    },
    { $sort: { total: -1 } },
    { $limit: Number(limit) },
  ]);

  return rows.map(row => {
    const summary = { manual: 0, qr: 0 };
    row.buckets.forEach(bucket => {
      if (bucket.source === 'manual') summary.manual += bucket.visits;
      else summary.qr += bucket.visits;
    });

    return {
      establishmentId: row._id,
      name: row.name ?? row._id,
      manual: summary.manual,
      qr: summary.qr,
      total: row.total,
    };
  });
};


export const getProvinceArrivals = async (req, res, next) => {
  try {
    const { months = 12 } = req.query;
    const trends = await aggregateVisitorTrends('province', null);
    res.json({ arrivals: trends.slice(-Number(months)) });
  } catch (e) {
    next(e);
  }
};

export const getMunicipalityArrivals = async (req, res, next) => {
  try {
    const { limit = 12, municipalityId: queryMunicipality } = req.query;
    const municipalityId = await resolveMunicipalityForLgu(
      req.user?.account_id,
      req.user?.role,
      queryMunicipality
    );
    const municipalities = await aggregateMunicipalityArrivals(Number(limit), municipalityId);
    res.json({ municipalities });
  } catch (e) {
    next(e);
  }
};

export const getMunicipalityCheckins = async (req, res, next) => {
  try {
    const municipalityId = await resolveMunicipalityForLgu(
      req.user?.account_id,
      req.user?.role,
      req.query.municipalityId
    );
    if (!municipalityId) {
      res.status(400);
      throw new Error('Municipality not resolved for LGU request.');
    }
    const { limit = 25 } = req.query;
    const establishments = await aggregateMunicipalityEstablishmentArrivals(
      municipalityId,
      Number(limit)
    );
    res.json({ establishments });
  } catch (e) {
    next(e);
  }
};


export const getVisitorHeatmap = async (req, res, next) => {
  try {
    const municipalityId = await resolveMunicipalityForLgu(
      req.user?.account_id,
      req.user?.role,
      req.query.municipalityId
    );
    const points = await aggregateHeatmapPoints(municipalityId);
    res.json({ points });
  } catch (e) {
    next(e);
  }
};

export const getFeedbackDistribution = async (req, res, next) => {
  try {
    const buckets = await Feedback.aggregate([
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]);
    const distribution = [1, 2, 3, 4, 5].map(star => ({
      label: `${star}★`,
      count: buckets.find(b => b._id === star)?.count ?? 0,
    }));
    res.json({ ratings: distribution });
  } catch (e) {
    next(e);
  }
};

export const getAccreditationSummary = async (req, res, next) => {
  try {
    const rows = await BusinessEstablishment.aggregate([
      {
        $group: {
          _id: { $toLower: '$status' },
          count: { $sum: 1 },
        },
      },
    ]);
    const payload = rows.map(row => ({
      status: row._id ?? 'unknown',
      count: row.count,
    }));
    res.json({ statuses: payload });
  } catch (e) {
    next(e);
  }
};

export const getVisitorAnalytics = async (req, res, next) => {
  try {
    const { scope = 'province', municipalityId: queryMunicipality } = req.query;
    const municipalityId = await resolveMunicipalityForLgu(
      req.user?.account_id,
      req.user?.role,
      queryMunicipality
    );
    const effectiveScope =
      municipalityId && req.user?.role !== 'bto_admin' ? 'municipality' : scope;

    const trends = await aggregateVisitorTrends(effectiveScope, municipalityId);
    res.json({ scope: effectiveScope, trends });
  } catch (e) {
    next(e);
  }
};

export const getDestinationAnalytics = async (req, res, next) => {

  try {
    const { scope = 'province', municipalityId: queryMunicipality, limit = 10 } = req.query;
    const municipalityId = await resolveMunicipalityForLgu(
      req.user?.account_id,
      req.user?.role,
      queryMunicipality
    );
    const topDestinations = await aggregateTopDestinations({ scope, municipalityId, limit: Number(limit) });
    res.json({ scope, topDestinations });
  } catch (e) {
    next(e);
  }
};

export const getMovementAnalytics = async (req, res, next) => {
  try {
    const { scope = 'province', municipalityId: queryMunicipality, limit = 10 } = req.query;
      const municipalityId = await resolveMunicipalityForLgu(
        req.user?.account_id,
        req.user?.role,
        queryMunicipality
      );
    const flows = await aggregateSequentialPatterns({ limit: Number(limit) });
     console.log('[analytics] sequential flows:', flows.length, flows); // <-- add this
    res.json({ flows });
  } catch (e) {
    console.error('[analytics] movement error:', e);
    next(e);
  }
};



const hydrateSequenceRows = async rows => {
  if (!rows.length) return [];

  const ids = [...new Set(rows.flatMap(row => [row.fromId, row.toId]).filter(Boolean))];

  const establishments = await BusinessEstablishment.find({
    $or: [
      { businessEstablishment_id: { $in: ids } },
      { business_establishment_id: { $in: ids } },
    ],
  })
    .select('businessEstablishment_id business_establishment_id name municipality_id')
    .lean();

  const estMap = new Map();
  establishments.forEach(est => {
    const key =
      est.businessEstablishment_id ??
      est.business_establishment_id ??
      null;
    if (!key) return;
    estMap.set(key, est);
  });

  const municipalityIds = [
    ...new Set(
      establishments
        .map(est => est.municipality_id)
        .filter(Boolean)
    ),
  ];
  const muniMap = municipalityIds.length
    ? Object.fromEntries(
        (
          await Municipality.find({ municipality_id: { $in: municipalityIds } })
            .select('municipality_id name')
            .lean()
        ).map(m => [m.municipality_id, m.name])
      )
    : {};

  return rows.map(row => {
    const fromEst = estMap.get(row.fromId) ?? null;
    const toEst = estMap.get(row.toId) ?? null;
    return {
      visits: row.visits,
      confidence: row.confidence ?? null,
      lift: row.lift ?? null,
      from: fromEst
        ? {
            id:
              fromEst.businessEstablishment_id ??
              fromEst.business_establishment_id ??
              row.fromId,
            name: fromEst.name,
            municipality:
              muniMap[fromEst.municipality_id] ?? fromEst.municipality_id ?? null,
          }
        : { id: row.fromId, name: null, municipality: null },
      to: toEst
        ? {
            id:
              toEst.businessEstablishment_id ??
              toEst.business_establishment_id ??
              row.toId,
            name: toEst.name,
            municipality:
              muniMap[toEst.municipality_id] ?? toEst.municipality_id ?? null,
          }
        : { id: row.toId, name: null, municipality: null },
    };
  });
};

const normalizeEstablishmentId = value => {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.find(v => typeof v === 'string' && v.trim()) ?? null;
  }
  if (typeof value === 'object') {
    return value.businessEstablishment_id ?? value.business_establishment_id ?? null;
  }
  return typeof value === 'string' ? value.trim() : null;
};


const aggregateFromSpm = async ({ limit, municipalityId }) => {
  const filter = {};
  if (municipalityId) filter.municipality_id = municipalityId;

  const rows = await FrequentSequence.find(filter)
    .sort({ support: -1, confidence: -1, lift: -1 })
    .limit(Number(limit))
    .lean();

  if (!rows.length) return [];

  const sanitized = rows
    .map(row => ({
      visits: row.support,
      confidence: row.confidence,
      lift: row.lift,
      fromId: normalizeEstablishmentId(row.from_business_establishment_id),
      toId: normalizeEstablishmentId(row.to_business_establishment_id),
    }))
    .filter(row => row.fromId && row.toId); // drop corrupted rows

  if (!sanitized.length) return [];

  return hydrateSequenceRows(sanitized);
};

const aggregateFromHistory = async ({ limit }) => {
  const sequences = await TravelHistory.aggregate([
    { $match: { status: 'visited' } },
    { $sort: { itinerary_id: 1, date_visited: 1, scheduled_date: 1, _id: 1 } },
    {
      $group: {
        _id: '$itinerary_id',
        ordered: { $push: '$business_establishment_id' },
      },
    },
    {
      $project: {
        ordered: {
          $cond: [
            { $eq: [{ $size: '$ordered' }, 1] },
            { $concatArrays: ['$ordered', '$ordered'] },
            '$ordered',
          ],
        },
      },
    },
    {
      $project: {
        transitions: {
          $zip: {
            inputs: [
              '$ordered',
              { $slice: ['$ordered', 1, { $size: '$ordered' }] },
            ],
          },
        },
      },
    },
    { $unwind: '$transitions' },
    {
      $group: {
        _id: { from: '$transitions.0', to: '$transitions.1' },
        visits: { $sum: 1 },
      },
    },
    { $match: { '_id.to': { $ne: null } } },
    {
      $lookup: {
        from: 'businessestablishments',
        localField: '_id.from',
        foreignField: 'businessEstablishment_id',
        as: 'fromEst',
      },
    },
    {
      $lookup: {
        from: 'businessestablishments',
        localField: '_id.to',
        foreignField: 'businessEstablishment_id',
        as: 'toEst',
      },
    },
    {
      $project: {
        visits: 1,
        from: {
          id: '$_id.from',
          name: { $arrayElemAt: ['$fromEst.name', 0] },
          municipality: { $arrayElemAt: ['$fromEst.municipality_id', 0] },
        },
        to: {
          id: '$_id.to',
          name: { $arrayElemAt: ['$toEst.name', 0] },
          municipality: { $arrayElemAt: ['$toEst.municipality_id', 0] },
        },
      },
    },
    { $sort: { visits: -1 } },
    { $limit: Number(limit) },
  ]);

  return sequences.map(row => ({
    visits: row.visits,
    from: row.from,
    to: row.to,
    confidence: null,
    lift: null,
  }));
};

const aggregateSequentialPatterns = async ({ limit = 5, municipalityId }) => {
  const spmFlows = await aggregateFromSpm({ limit, municipalityId });
  if (spmFlows.length) return spmFlows;

  return aggregateFromHistory({ limit });
};