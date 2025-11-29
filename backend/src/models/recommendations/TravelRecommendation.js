import mongoose from "mongoose";
import Counter from "../Counter.js";

const TravelRecommendationSchema = new mongoose.Schema(
  {
    travel_recommendation_id: { type: String, unique: true }, // REC-YYYY-MM-DD-####
    tourist_profile_id: { type: String, required: true, index: true },
    businessEstablishment_id: { type: String, required: true, index: true },
    // reason is human-readable: "Tag match: beach • Near: 1.2km • Rating: 4.6"
    reason: { type: String },
    // final score used for sorting (0–100 scale)
    score: { type: Number, required: true, min: 0, max: 100 },
    generated_at: { type: Date, default: Date.now },
    accessibility_status: { type: String, enum: ["Open", "Closed", "Limited Access"], default: "Open" },

    // optional telemetry hooks (for SPM step)
    source: { type: String, enum: ["rule_mvp", "bigram_spm", "hybrid"], default: "rule_mvp", index: true },
    params: { type: mongoose.Schema.Types.Mixed }, // snapshot of weights/filters for reproducibility
  },
  { timestamps: true, versionKey: false }
);

// Custom ID
TravelRecommendationSchema.pre("validate", async function (next) {
  if (this.travel_recommendation_id) return next();
  const today = new Date();
  const ymd = today.toISOString().slice(0, 10); // YYYY-MM-DD
  const seq = await Counter.next("travel_recommendation_seq");
  this.travel_recommendation_id = `REC-${ymd}-${String(seq).padStart(4, "0")}`;
  next();
});

// helpful compound index if you regenerate often per tourist
TravelRecommendationSchema.index(
  { tourist_profile_id: 1, generated_at: -1, score: -1 }
);

const TravelRecommendation = mongoose.model(
  "TravelRecommendation",
  TravelRecommendationSchema
);

export default TravelRecommendation;
