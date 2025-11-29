import BusinessEstablishment from "../../models/businessEstablishmentModels/BusinessEstablishment.js";
import Feedback from "../../models/feedback/Feedback.js";
import EstablishmentTag from "../../models/tagModels/EstablishmentTag.js";
import Tag from "../../models/tagModels/Tag.js";
import Media from '../../models/Media/Media.js';

const selectFields = 'media_id business_establishment_id file_url file_type caption createdAt';

const enrichWithMedia = async payload => {
  if (!payload) return payload;
  const list = Array.isArray(payload) ? payload : [payload];
  if (!list.length) return payload;

  const estIds = list.map(item => item?.businessEstablishment_id).filter(Boolean);
  if (!estIds.length) return payload;

  const mediaRows = await Media.find({ business_establishment_id: { $in: estIds } })
    .sort({ createdAt: -1 })
    .select(selectFields)
    .lean();

  const grouped = mediaRows.reduce((acc, entry) => {
    const key = entry.business_establishment_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push({
      media_id: entry.media_id,
      file_url: entry.file_url,
      file_type: entry.file_type,
      caption: entry.caption ?? null,
      createdAt: entry.createdAt,
    });
    return acc;
  }, {});

  const attach = est => ({
    ...est,
    media: grouped[est.businessEstablishment_id] ?? [],
  });

  const enriched = list.map(attach);
  return Array.isArray(payload) ? enriched : enriched[0];
};

export const getEstablishments = async (req, res, next) => {
  try {
    const {
      municipality_id,
      type,
      min_rating,
      q,
      sort = "rating_desc", // rating_desc | rating_asc | name_asc | name_desc | latest
      page = 1,
      pageSize = 12,
      tag_id,
      tag_name
    } = req.query;

    // 1) base filter FIRST (so we can add to it later)
    const filter = { status: "approved" };
    if (municipality_id) filter.municipality_id = municipality_id;
    if (type) filter.type = type;
    if (min_rating) filter.rating_avg = { $gte: Number(min_rating) };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } }
      ];
    }

    // 2) tag filters (supports ?tag_id=... or ?tag_name=..., multiple allowed → AND)
    const tagIds   = [].concat(tag_id || []).filter(Boolean);
    const tagNames = [].concat(tag_name || []).filter(Boolean);

    let resolvedTagIds = [...tagIds];
    if (tagNames.length) {
      const tags = await Tag.find({
        tag_name: { $in: tagNames.map(n => new RegExp(`^${n}$`, "i")) }
      }).select("tag_id");
      resolvedTagIds.push(...tags.map(t => t.tag_id));
    }
    resolvedTagIds = [...new Set(resolvedTagIds)];

    if (resolvedTagIds.length) {
      // AND logic across tags
      let estIdsWithAll = null;
      for (const tId of resolvedTagIds) {
        const rows = await EstablishmentTag
          .find({ tag_id: tId })
          .select("business_establishment_id -_id")
          .lean();

        const ids = new Set(rows.map(r => r.business_establishment_id));
        estIdsWithAll = estIdsWithAll
          ? new Set([...estIdsWithAll].filter(x => ids.has(x)))
          : ids;
      }
      const allowed = [...(estIdsWithAll || [])];

      if (allowed.length === 0) {
        return res.json({ page: 1, pageSize: 0, pages: 0, total: 0, items: [] });
      }

      // IMPORTANT: must match BusinessEstablishment schema field
      filter.businessEstablishment_id = { $in: allowed };
    }

    // 3) sorting & paging
    const sortMap = {
      rating_desc: { rating_avg: -1, rating_count: -1, name: 1 },
      rating_asc:  { rating_avg:  1, rating_count:  1, name: 1 },
      name_asc:    { name: 1 },
      name_desc:   { name: -1 },
      latest:      { createdAt: -1 }
    };
    const sortSpec = sortMap[sort] || sortMap.rating_desc;

    const p = Math.max(1, Number(page));
    const ps = Math.max(1, Number(pageSize));
    const skip = (p - 1) * ps;

    const [items, total] = await Promise.all([
      BusinessEstablishment.find(filter)
        .sort(sortSpec)
        .skip(skip)
        .limit(ps)
        .select('-__v')
        .lean(),
      BusinessEstablishment.countDocuments(filter),
    ]);

    const itemsWithMedia = await enrichWithMedia(items);

    res.json({ page: p, pageSize: ps, pages: Math.ceil(total / ps), total, items: itemsWithMedia });
  } catch (e) { next(e); }
};

export const getEstablishmentDetails = async (req, res, next) => {
  try {
    const { estId } = req.params;
    const est = await BusinessEstablishment.findOne({ businessEstablishment_id: estId }).lean();
    if (!est || est.status !== 'approved') return res.status(404).json({ message: 'Establishment not found' });

    const establishment = await enrichWithMedia(est);

    const agg = await Feedback.aggregate([
      { $match: { business_establishment_id: estId } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }
    ]);
    const summary = agg.length
      ? { average_rating: +agg[0].avg.toFixed(2), count: agg[0].count }
      : { average_rating: 0, count: 0 };

    res.json({ establishment, feedback_summary: summary });
  } catch (e) { next(e); }
};
