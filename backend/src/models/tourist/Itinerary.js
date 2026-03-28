import mongoose from "mongoose";
import Counter from "../Counter.js";

function pad(n, size = 4) { return String(n).padStart(size, "0"); }

async function nextItineraryID() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const key = `${y}-${m}-${d}`;
  const c = await Counter.findOneAndUpdate(
    { _id: "itinerary_" + key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `ITI-${key}-${pad(c.seq)}`;
}

const itinerarySchema = new mongoose.Schema(
  {
    itinerary_id: { type: String, required: true, unique: true, index: true },
    tourist_profile_id: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    total_budget: { type: Number },
    stops: [
      {
        order: { type: Number, required: true },
        business_establishment_id: { type: String },
        title: { type: String },
        municipality: { type: String },
        latitude: { type: Number },
        longitude: { type: Number },
        visited: { type: Boolean, default: false },
        visited_at: { type: Date },
        checkin_media_id: { type: String },
      },
    ],
    route_geometry: [
      {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
      },
    ],
    summary: {
      distance_km: { type: Number, default: null },
      duration_minutes: { type: Number, default: null },
      traffic_penalty: { type: Number, default: null },
      weather_penalty: { type: Number, default: null },
      efficiency_score: { type: Number, default: null },
      final_score: { type: Number, default: null },
      optimization_method: { type: String, default: null },
      aco_weighted_cost: { type: Number, default: null },
    },
    origin: {
      latitude: { type: Number },
      longitude: { type: Number },
    },

    status: {
      type: String,
      enum: ['Planned', 'Ongoing', 'Completed', 'Cancelled'],
      default: 'Planned',
    },
  },
  { timestamps: true }
);

itinerarySchema.pre("validate", async function (next) {
  if (this.isNew && !this.itinerary_id) {
    this.itinerary_id = await nextItineraryID();
  }
  next();
});

export default mongoose.model("Itinerary", itinerarySchema);
