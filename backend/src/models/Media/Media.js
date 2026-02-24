import mongoose from "mongoose";
import Counter from "../Counter.js";


function pad(n, size = 4){
    return String(n).padStart(size, "0");
}

async function nextMediaID() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${d}`;
    const c = await Counter.findOneAndUpdate(
        { _id: "media_" + key },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return `MED-${key}-${pad(c.seq)}`;
}

const mediaSchema = new mongoose.Schema(
  {
    media_id: { type: String, required: true, unique: true, index: true },
    account_id: { type: String, required: true, index: true },
    business_establishment_id: { type: String, required: true, index: true },
    file_url: { type: String, required: true },
    file_type: {
      type: String,
      enum: ['image', 'video', 'document'],
      required: true,
    },
    media_kind: {
      type: String,
      enum: ['spot_gallery', 'submission_requirement'],
      default: 'spot_gallery',
      index: true,
    },
    original_name: { type: String },
    mime_type: { type: String },
    caption: { type: String },
    uploaded_by: { type: String },
    public_id: { type: String },
  },
  { timestamps: true },
);

mediaSchema.pre("validate", async function (next) {
    if (this.isNew && !this.media_id) {
    this.media_id = await nextMediaID();
    }
    next();
});

export default mongoose.model("Media", mediaSchema);