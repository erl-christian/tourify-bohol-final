import mongoose from "mongoose";
import Counter from "../Counter.js";

function pad(n, size = 4) { return String(n).padStart(size, "0"); }
async function nextFeedbackID() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const key = `${y}-${m}-${d}`;
  const c = await Counter.findOneAndUpdate(
    { _id: "feedback_" + key }, { $inc: { seq: 1 } }, { new: true, upsert: true }
  );
  return `FDB-${key}-${pad(c.seq)}`;
}

const feedbackSchema = new mongoose.Schema({
  feedback_id:              { type: String, required: true, unique: true, index: true },
  tourist_profile_id:       { type: String, required: true, index: true },
  itinerary_id:             { type: String, required: true, index: true },
  business_establishment_id:{ type: String, required: true, index: true },

  rating:      { type: Number, min: 1, max: 5, required: true },
  review_text: { type: String, trim: true },
}, { timestamps: true });

feedbackSchema.pre("validate", async function(next){
  if (this.isNew && !this.feedback_id) this.feedback_id = await nextFeedbackID();
  next();
});

// prevent duplicate feedback per tourist-establishment-itinerary
feedbackSchema.index(
  { tourist_profile_id: 1, business_establishment_id: 1, itinerary_id: 1 },
  { unique: true }
);

export default mongoose.model("Feedback", feedbackSchema);
