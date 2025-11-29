import mongoose from "mongoose";

const RecommendationEventSchema = new mongoose.Schema(
  {
    tourist_profile_id: { type: String, required: true, index: true },
    business_establishment_id: { type: String, required: true, index: true },
    travel_recommendation_id: { type: String }, // optional backlink
    event_type: { type: String, enum: ["shown","clicked","added","visited"], required: true, index: true },
    occurred_at: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

export default mongoose.model("RecommendationEvent", RecommendationEventSchema);
