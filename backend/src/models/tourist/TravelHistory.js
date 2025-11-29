import mongoose from "mongoose";
import Counter from "../Counter.js";

function pad(n, size = 4) { return String(n).padStart(size, "0"); }

async function nextTravelHistoryID() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const key = `${y}-${m}-${d}`;
  const c = await Counter.findOneAndUpdate(
    { _id: "travel_history_" + key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `THI-${key}-${pad(c.seq)}`;
}

const travelHistorySchema = new mongoose.Schema({
  travel_history_id:         { type: String, required: true, unique: true, index: true },

  // FKs
  tourist_profile_id:        { type: String, required: true, index: true },
  itinerary_id:              { type: String, required: true, index: true },
  business_establishment_id: { type: String, required: true, index: true },

  // schedule / plan
  scheduled_date:            { type: Date, required: true },
  scheduled_arrival:         { type: String },  // "08:30"
  estimated_arrival:         { type: Date },
  estimated_departure:       { type: Date },
  priority:                  { type: Number, default: 1 }, // lower = earlier
  notes:                     { type: String, trim: true },

  // lifecycle
  status:                    { type: String, enum: ["planned","visited","skipped","cancelled"], default: "planned" },
  date_visited:              { type: Date },

  // capture details
  capture_method:            { type: String, enum: ["manual", "qr_scan", "gps"], default: "manual" },
  actual_arrival:            { type: Date },
  actual_departure:          { type: Date },
  capture_latitude:          { type: Number },
  capture_longitude:         { type: Number },

  // optional display label
  scheduled_destination:     { type: String }
}, { timestamps: true });

travelHistorySchema.pre("validate", async function(next){
  if (this.isNew && !this.travel_history_id) {
    this.travel_history_id = await nextTravelHistoryID();
  }
  next();
});

// helpful indices
travelHistorySchema.index({ itinerary_id: 1, scheduled_date: 1, priority: 1 });

export default mongoose.model("TravelHistory", travelHistorySchema);
