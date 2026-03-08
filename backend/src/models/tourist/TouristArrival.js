import mongoose from "mongoose";
import Counter from "../Counter.js";

function pad(n, size = 4) {
  return String(n).padStart(size, "0");
}

async function nextTouristArrivalId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const dateKey = `${y}-${m}-${d}`;

  const c = await Counter.findOneAndUpdate(
    { _id: `tourist_arrival_${dateKey}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `TAR-${dateKey}-${pad(c.seq)}`;
}

const touristArrivalSchema = new mongoose.Schema(
  {
    tourist_arrival_id: { type: String, required: true, unique: true, index: true },
    entry_point_type: {
      type: String,
      enum: ["airport", "seaport", "landport", "other"],
      default: "other",
      index: true,
    },
    entry_point_name: { type: String, trim: true, default: "" },
    qr_code_id: { type: String, required: true, trim: true, index: true },
    session_id: { type: String, required: true, trim: true, index: true },
    account_id: { type: String, index: true },
    tourist_profile_id: { type: String, index: true },
    scanned_at: { type: Date, default: Date.now, index: true },
    linked_at: { type: Date, default: null },
    source: {
      type: String,
      enum: ["arrival_qr"],
      default: "arrival_qr",
      index: true,
    },
  },
  { timestamps: true }
);

touristArrivalSchema.pre("validate", async function (next) {
  if (this.isNew && !this.tourist_arrival_id) {
    this.tourist_arrival_id = await nextTouristArrivalId();
  }
  next();
});

touristArrivalSchema.index({ session_id: 1, scanned_at: -1 });
touristArrivalSchema.index({ account_id: 1, scanned_at: -1 });
touristArrivalSchema.index({ tourist_profile_id: 1, scanned_at: -1 });

export default mongoose.model("TouristArrival", touristArrivalSchema);
