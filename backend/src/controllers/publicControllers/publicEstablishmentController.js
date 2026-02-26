import BusinessEstablishment from "../../models/businessEstablishmentModels/BusinessEstablishment.js";
import Feedback from "../../models/feedback/Feedback.js";
import EstablishmentTag from "../../models/tagModels/EstablishmentTag.js";
import Tag from "../../models/tagModels/Tag.js";
import Media from "../../models/Media/Media.js";
import FrequentSequence from "../../models/recommendations/FrequentSequence.js";

const selectFields = "media_id business_establishment_id file_url file_type caption createdAt";

const enrichWithMedia = async payload => {
  if (!payload) return payload;
  const list = Array.isArray(payload) ? payload : [payload];
  if (!list.length) return payload;

  const estIds = list.map(item => item?.businessEstablishment_id).filter(Boolean);
  if (!estIds.length) return payload;

  const mediaRows = await Media.find({
    business_establishment_id: { $in: estIds },
    file_type: { $in: ["image", "video"] },
    $or: [
      { media_kind: "spot_gallery" },
      { media_kind: { $exists: false } },
      { media_kind: null },
    ],
  })
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

const formatPhp = value =>
  `PHP ${Number(value).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

const attachBudgetMeta = est => {
  if (!est) return est;

  const min = Number(est.budget_min);
  const max = Number(est.budget_max);
  const hasMin = Number.isFinite(min);
  const hasMax = Number.isFinite(max);

  let priceRange = est.price_range || null;
  let averageSpend = est.average_spend || null;

  if (hasMin && hasMax) {
    priceRange = `${formatPhp(min)} - ${formatPhp(max)}`;
    averageSpend = formatPhp(Math.round((min + max) / 2));
  } else if (hasMin) {
    priceRange = `${formatPhp(min)} and up`;
    averageSpend = formatPhp(min);
  } else if (hasMax) {
    priceRange = `Up to ${formatPhp(max)}`;
    averageSpend = formatPhp(max);
  }

  return { ...est, price_range: priceRange, average_spend: averageSpend };
};

const enrichWithTagNames = async payload => {
  if (!payload) return payload;

  const list = Array.isArray(payload) ? payload : [payload];
  if (!list.length) return payload;

  const estIds = list.map(item => item?.businessEstablishment_id).filter(Boolean);
  if (!estIds.length) return payload;

  const relations = await EstablishmentTag.find({
    business_establishment_id: { $in: estIds },
  })
    .select("business_establishment_id tag_id")
    .lean();

  if (!relations.length) {
    const mapped = list.map(item => ({ ...item, tag_names: [] }));
    return Array.isArray(payload) ? mapped : mapped[0];
  }

  const tagIds = [...new Set(relations.map(row => row.tag_id).filter(Boolean))];
  const tags = await Tag.find({ tag_id: { $in: tagIds } })
    .select("tag_id tag_name")
    .lean();

  const tagNameById = Object.fromEntries(tags.map(t => [t.tag_id, t.tag_name]));
  const tagsByEst = {};

  for (const row of relations) {
    const estId = row.business_establishment_id;
    const tagName = tagNameById[row.tag_id];
    if (!estId || !tagName) continue;

    if (!tagsByEst[estId]) tagsByEst[estId] = [];
    if (!tagsByEst[estId].includes(tagName)) tagsByEst[estId].push(tagName);
  }

  const mapped = list.map(item => ({
    ...item,
    tag_names: tagsByEst[item.businessEstablishment_id] ?? [],
  }));

  return Array.isArray(payload) ? mapped : mapped[0];
};

const normalizeEstablishmentId = value => {
  if (!value) return null;
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.find(v => typeof v === "string" && v.trim()) ?? null;
  if (typeof value === "object") {
    return value.businessEstablishment_id ?? value.business_establishment_id ?? null;
  }
  return null;
};

const attachSpmSupport = async (items, municipalityId = null) => {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return list;

  const establishmentIds = list.map(item => item?.businessEstablishment_id).filter(Boolean);
  if (!establishmentIds.length) {
    return list.map(item => ({ ...item, spm_support_total: 0 }));
  }

  const idSet = new Set(establishmentIds);
  const sequenceScope = municipalityId ? { municipality_id: municipalityId } : { municipality_id: null };

  const sequenceRows = await FrequentSequence.find({
    ...sequenceScope,
    $or: [
      { from_business_establishment_id: { $in: establishmentIds } },
      { to_business_establishment_id: { $in: establishmentIds } },
    ],
  })
    .select("from_business_establishment_id to_business_establishment_id support")
    .lean();

  const supportByEst = {};
  for (const row of sequenceRows) {
    const support = Number(row?.support) || 0;
    if (support <= 0) continue;

    const fromId = normalizeEstablishmentId(row?.from_business_establishment_id);
    const toId = normalizeEstablishmentId(row?.to_business_establishment_id);

    if (fromId && idSet.has(fromId)) supportByEst[fromId] = (supportByEst[fromId] || 0) + support;
    if (toId && idSet.has(toId)) supportByEst[toId] = (supportByEst[toId] || 0) + support;
  }

  return list.map(item => ({
    ...item,
    spm_support_total: Number(supportByEst[item.businessEstablishment_id] || 0),
  }));
};

export const getEstablishments = async (req, res, next) => {
  try {
    const {
      municipality_id,
      type,
      min_rating,
      q,
      sort = "rating_desc", // rating_desc | rating_asc | name_asc | name_desc | latest | spm_desc | spm_asc
      page = 1,
      pageSize = 12,
      tag_id,
      tag_name,
    } = req.query;

    const filter = { status: "approved" };
    if (municipality_id) filter.municipality_id = municipality_id;
    if (type) filter.type = type;
    if (min_rating) filter.rating_avg = { $gte: Number(min_rating) };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } },
      ];
    }

    const tagIds = [].concat(tag_id || []).filter(Boolean);
    const tagNames = [].concat(tag_name || []).filter(Boolean);

    let resolvedTagIds = [...tagIds];
    if (tagNames.length) {
      const tags = await Tag.find({
        tag_name: { $in: tagNames.map(n => new RegExp(`^${n}$`, "i")) },
      }).select("tag_id");
      resolvedTagIds.push(...tags.map(t => t.tag_id));
    }
    resolvedTagIds = [...new Set(resolvedTagIds)];

    if (resolvedTagIds.length) {
      let estIdsWithAll = null;
      for (const tId of resolvedTagIds) {
        const rows = await EstablishmentTag.find({ tag_id: tId })
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

      filter.businessEstablishment_id = { $in: allowed };
    }

    const p = Math.max(1, Number(page));
    const ps = Math.max(1, Number(pageSize));
    const skip = (p - 1) * ps;
    const isSpmSort = sort === "spm_desc" || sort === "spm_asc";

    if (isSpmSort) {
      const baseItems = await BusinessEstablishment.find(filter).select("-__v").lean();
      const withSpm = await attachSpmSupport(baseItems, municipality_id || null);
      const direction = sort === "spm_asc" ? 1 : -1;

      withSpm.sort((a, b) => {
        const aSupport = Number(a?.spm_support_total) || 0;
        const bSupport = Number(b?.spm_support_total) || 0;
        if (aSupport !== bSupport) return direction * (aSupport - bSupport);

        const aRating = Number(a?.rating_avg) || 0;
        const bRating = Number(b?.rating_avg) || 0;
        if (aRating !== bRating) return bRating - aRating;

        const aCount = Number(a?.rating_count) || 0;
        const bCount = Number(b?.rating_count) || 0;
        if (aCount !== bCount) return bCount - aCount;

        return String(a?.name || "").localeCompare(String(b?.name || ""));
      });

      const total = withSpm.length;
      const paged = withSpm.slice(skip, skip + ps);

      const itemsWithTags = await enrichWithTagNames(paged);
      const itemsWithMedia = await enrichWithMedia(itemsWithTags);
      const itemsWithBudget = (itemsWithMedia || []).map(attachBudgetMeta);

      return res.json({
        page: p,
        pageSize: ps,
        pages: Math.ceil(total / ps),
        total,
        items: itemsWithBudget,
      });
    }

    const sortMap = {
      rating_desc: { rating_avg: -1, rating_count: -1, name: 1 },
      rating_asc: { rating_avg: 1, rating_count: 1, name: 1 },
      name_asc: { name: 1 },
      name_desc: { name: -1 },
      latest: { createdAt: -1 },
    };
    const sortSpec = sortMap[sort] || sortMap.rating_desc;

    const [items, total] = await Promise.all([
      BusinessEstablishment.find(filter)
        .sort(sortSpec)
        .skip(skip)
        .limit(ps)
        .select("-__v")
        .lean(),
      BusinessEstablishment.countDocuments(filter),
    ]);

    const itemsWithTags = await enrichWithTagNames(items);
    const itemsWithMedia = await enrichWithMedia(itemsWithTags);
    const itemsWithBudget = (itemsWithMedia || []).map(attachBudgetMeta);

    return res.json({
      page: p,
      pageSize: ps,
      pages: Math.ceil(total / ps),
      total,
      items: itemsWithBudget,
    });
  } catch (e) {
    next(e);
  }
};

export const getEstablishmentDetails = async (req, res, next) => {
  try {
    const { estId } = req.params;
    const est = await BusinessEstablishment.findOne({ businessEstablishment_id: estId }).lean();

    if (!est || est.status !== "approved") {
      return res.status(404).json({ message: "Establishment not found" });
    }

    const [withSpm] = await attachSpmSupport([est], est.municipality_id || null);
    const withTags = await enrichWithTagNames(withSpm || est);
    const establishment = attachBudgetMeta(await enrichWithMedia(withTags));

    const agg = await Feedback.aggregate([
      { $match: { business_establishment_id: estId } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);

    const summary = agg.length
      ? { average_rating: +agg[0].avg.toFixed(2), count: agg[0].count }
      : { average_rating: 0, count: 0 };

    res.json({ establishment, feedback_summary: summary });
  } catch (e) {
    next(e);
  }
};
