import RecommendationEvent from "../../models/recommendations/RecommendationEvent.js";

export const logEvent = async (req, res, next) => {
  try {
    const { tourist_profile_id, business_establishment_id, travel_recommendation_id, event_type } = req.body;
    if (!tourist_profile_id || !business_establishment_id || !event_type) {
      res.status(400); throw new Error("tourist_profile_id, business_establishment_id, event_type are required");
    }
    const doc = await RecommendationEvent.create({ tourist_profile_id, business_establishment_id, travel_recommendation_id, event_type });
    res.json({ ok: true, item: doc });
  } catch (e) { next(e); }
};
