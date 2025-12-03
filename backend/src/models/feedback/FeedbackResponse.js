import mongoose from "mongoose";
import Counter from "../Counter.js";

function pad(n, size = 4) { return String(n).padStart(size, "0"); }
async function nextFRID() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const key = `${y}-${m}-${d}`;
  const c = await Counter.findOneAndUpdate(
    { _id: "feedback_response_" + key }, { $inc: { seq: 1 } }, { new: true, upsert: true }
  );
  return `FRS-${key}-${pad(c.seq)}`;
}

const feedbackResponseSchema = new mongoose.Schema({
  feedback_response_id:       { type: String, required: true, unique: true, index: true },
  feedback_id:                { type: String, required: true, index: true },

  // responder (either LGU admin staff profile OR business owner profile)
  admin_staff_profile_id:             { type: String },
  business_establishment_profile_id:  { type: String },
  bto_account_id:                     { type: String }, 

  response_text: { type: String, required: true, trim: true }
}, { timestamps: true });

feedbackResponseSchema.pre("validate", async function(next){
  if (this.isNew && !this.feedback_response_id) this.feedback_response_id = await nextFRID();
  next();
});

// enforce exactly one responder type
feedbackResponseSchema.pre("validate", function(next){
  const owners = [
    !!this.admin_staff_profile_id,
    !!this.business_establishment_profile_id,
    !!this.bto_account_id,
  ].filter(Boolean).length;
  if (owners !== 1) return next(new Error("FeedbackResponse must have exactly one responder type"));
  next();
});

export default mongoose.model("FeedbackResponse", feedbackResponseSchema);
