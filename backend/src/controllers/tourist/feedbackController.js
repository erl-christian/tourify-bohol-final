import Feedback from "../../models/feedback/Feedback.js";
import TouristProfile from "../../models/tourist/TouristProfile.js";
import TravelHistory from "../../models/tourist/TravelHistory.js";
import BusinessEstablishment from "../../models/businessEstablishmentModels/BusinessEstablishment.js";
import { recomputeEstablishmentRating } from "../../utils/rating.js";
import FeedbackResponse from "../../models/feedback/FeedbackResponse.js";
import Itinerary from "../../models/tourist/Itinerary.js";


// POST /api/tourist/feedback
// body: { itinerary_id, business_establishment_id, rating, review_text? }
export const createFeedback = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) { res.status(401); throw new Error("Unauthorized"); }
    const tourist = await TouristProfile.findOne({ account_id });
    if (!tourist) { res.status(404); throw new Error("Tourist profile not found"); }

    const { itinerary_id, business_establishment_id, rating, review_text } = req.body;
    if (!business_establishment_id || !rating) {
      res.status(400); throw new Error("business_establishment_id and rating are required");
    }

    const normalizedItineraryId =
      typeof itinerary_id === "string" && itinerary_id.trim().length
        ? itinerary_id.trim()
        : `WALKIN-${Date.now()}`;
    const isWalkInReview = normalizedItineraryId.toUpperCase().startsWith("WALKIN-");

    // ensure establishment exists
    const est = await BusinessEstablishment.findOne({ businessEstablishment_id: business_establishment_id });
    if (!est) { res.status(404); throw new Error("Business establishment not found"); }

    if (!isWalkInReview) {
      // For itinerary-linked reviews, require a visited stop in TravelHistory.
      const visited = await TravelHistory.findOne({
        itinerary_id: normalizedItineraryId,
        tourist_profile_id: tourist.tourist_profile_id,
        business_establishment_id,
        status: "visited"
      });
      if (!visited) { res.status(400); throw new Error("You can only rate after visiting this establishment"); }
    }

    const fb = await Feedback.create({
      tourist_profile_id: tourist.tourist_profile_id,
      itinerary_id: normalizedItineraryId,
      business_establishment_id,
      rating,
      review_text
    });

    await recomputeEstablishmentRating(business_establishment_id);

    res.status(201).json({ message: "Feedback submitted", feedback: fb });
  } catch (e) { next(e); }
};

// PATCH /api/tourist/feedback/:feedbackId
export const updateMyFeedback = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    const tourist = await TouristProfile.findOne({ account_id });
    if (!tourist) { res.status(404); throw new Error("Tourist profile not found"); }

    const { feedbackId } = req.params;
    const { rating, review_text } = req.body;

    const fb = await Feedback.findOne({ feedback_id: feedbackId, tourist_profile_id: tourist.tourist_profile_id });
    const estId = fb.business_establishment_id;

    if (!fb) { res.status(404); throw new Error("Feedback not found"); }
    if (rating !== undefined) fb.rating = rating;
    if (review_text !== undefined) fb.review_text = review_text;
    await fb.save();

    await recomputeEstablishmentRating(estId);

    res.json({ message: "Feedback updated", feedback: fb });
  } catch (e) { next(e); }
};

// DELETE /api/tourist/feedback/:feedbackId
export const deleteMyFeedback = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    const tourist = await TouristProfile.findOne({ account_id });
    if (!tourist) { res.status(404); throw new Error("Tourist profile not found"); }

    const { feedbackId } = req.params;
    const del = await Feedback.findOneAndDelete({ feedback_id: feedbackId, tourist_profile_id: tourist.tourist_profile_id });

    await recomputeEstablishmentRating(business_establishment_id);
    
    if (!del) { res.status(404); throw new Error("Feedback not found"); }
    res.json({ message: "Feedback deleted" });
  } catch (e) { next(e); }
};

// GET /api/tourist/feedback/my
export const listMyFeedback = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    const tourist = await TouristProfile.findOne({ account_id });
    if (!tourist) { res.status(404); throw new Error("Tourist profile not found"); }

    const rows = await Feedback.find({ tourist_profile_id: tourist.tourist_profile_id })
      .sort({ createdAt: -1 })
      .lean();

    if (!rows.length) {
      return res.json({ feedback: [] });
    }

    const itineraryIds = [...new Set(rows.map(item => item.itinerary_id).filter(Boolean))];
    const establishmentIds = [...new Set(rows.map(item => item.business_establishment_id).filter(Boolean))];
    const feedbackIds = rows.map(item => item.feedback_id);

    const [itineraries, establishments, replies] = await Promise.all([
      itineraryIds.length
        ? Itinerary.find({ itinerary_id: { $in: itineraryIds } })
            .select("itinerary_id title start_date end_date")
            .lean()
        : [],
      establishmentIds.length
        ? BusinessEstablishment.find({ businessEstablishment_id: { $in: establishmentIds } })
            .select("businessEstablishment_id name address municipality_id type latitude longitude")
            .lean()
        : [],
      feedbackIds.length
        ? FeedbackResponse.find({ feedback_id: { $in: feedbackIds } })
            .sort({ createdAt: 1 })
            .lean()
        : [],
    ]);

    const itineraryMap = new Map(itineraries.map(item => [item.itinerary_id, item]));
    const establishmentMap = new Map(
      establishments.map(item => [item.businessEstablishment_id, item])
    );
    const repliesMap = replies.reduce((acc, reply) => {
      const list = acc.get(reply.feedback_id) ?? [];
      list.push(reply);
      acc.set(reply.feedback_id, list);
      return acc;
    }, new Map());

    const enriched = rows.map(item => ({
      ...item,
      itinerary: itineraryMap.get(item.itinerary_id) ?? null,
      establishment: establishmentMap.get(item.business_establishment_id) ?? null,
      replies: repliesMap.get(item.feedback_id) ?? [],
    }));

    res.json({ feedback: enriched });
  } catch (e) { next(e); }
};

