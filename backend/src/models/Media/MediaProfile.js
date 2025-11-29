import mongoose from "mongoose";
import Counter from "../Counter.js";

function pad(n, size = 4) { return String(n).padStart(size, "0"); }

async function nextProfileMediaID() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const key = `${y}-${m}-${d}`;
  const c = await Counter.findOneAndUpdate(
    { _id: "profile_media_" + key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `PMD-${key}-${pad(c.seq)}`;
}

const profileMediaSchema = new mongoose.Schema(
  {
    profile_media_id: { type: String, required: true, unique: true, index: true },

    // FK (one of these must exist)
    admin_staff_profile_id: { type: String },
    business_establishment_profile_id: { type: String },
    tourist_profile_id: { type: String },

    // Media link
    media_id: { type: String, required: true, index: true },
    is_primary: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 🔹 Auto-generate ID
profileMediaSchema.pre("validate", async function (next) {
  if (this.isNew && !this.profile_media_id) {
    this.profile_media_id = await nextProfileMediaID();
  }
  next();
});

// 🔹 Ensure belongs to exactly one profile type
profileMediaSchema.pre("validate", function (next) {
  const owners = [
    !!this.tourist_profile_id,
    !!this.admin_staff_profile_id,
    !!this.business_establishment_profile_id,
  ].filter(Boolean).length;

  if (owners !== 1) {
    return next(new Error("ProfileMedia must reference exactly one profile type"));
  }
  next();
});

// 🔹 Only one primary photo per tourist
profileMediaSchema.index(
  { tourist_profile_id: 1, is_primary: 1 },
  {
    unique: true,
    partialFilterExpression: {
      is_primary: true,
      tourist_profile_id: { $exists: true },
    },
  }
);

export default mongoose.model("ProfileMedia", profileMediaSchema);
