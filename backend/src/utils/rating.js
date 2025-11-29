// utils/ratings.js
import Feedback from "../models/feedback/Feedback.js";
import BusinessEstablishment from "../models/businessEstablishmentModels/BusinessEstablishment.js";

export async function recomputeEstablishmentRating(estId) {
  const agg = await Feedback.aggregate([
    { $match: { business_establishment_id: estId } },
    { $group: { _id: null, avg: { $avg: "$rating" }, cnt: { $sum: 1 } } }
  ]);

  const avg = agg.length ? Number(agg[0].avg.toFixed(2)) : 0;
  const cnt = agg.length ? agg[0].cnt : 0;

  await BusinessEstablishment.findOneAndUpdate(
    { businessEstablishment_id: estId },
    { $set: { rating_avg: avg, rating_count: cnt } },
    { new: true }
  );
}
