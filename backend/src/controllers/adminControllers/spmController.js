import FrequentSequence from "../../models/recommendations/FrequentSequence.js";
export const topSequences = async (req, res, next) => {
  try {
    const { municipality_id, min_support = 5, limit = 50 } = req.query;
    const q = { support: { $gte: Number(min_support) } };
    if (municipality_id) q.municipality_id = municipality_id;
    const rows = await FrequentSequence.find(q)
      .sort({ confidence: -1, lift: -1, support: -1 })
      .limit(Number(limit))
      .lean();
    res.json({ items: rows });
  } catch (e) { next(e); }
};