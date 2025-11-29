import mongoose from "mongoose";
import Counter from "../Counter.js";

function pad(n, size = 4) { return String(n).padStart(size, "0"); }

async function nextFavoriteID() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const key = `${y}-${m}-${d}`;
  const c = await Counter.findOneAndUpdate(
    { _id: "favorite_" + key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `FAV-${key}-${pad(c.seq)}`;
}

const favoriteSchema = new mongoose.Schema(
  {
    favorite_id: { type: String, required: true, unique: true, index: true },

    // ERD-aligned keys
    tourist_profile_id:        { type: String, required: true, index: true },
    business_establishment_id: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

// prevent duplicates per tourist + establishment
favoriteSchema.index(
  { tourist_profile_id: 1, business_establishment_id: 1 },
  { unique: true }
);

favoriteSchema.pre("validate", async function (next) {
  if (this.isNew && !this.favorite_id) {
    this.favorite_id = await nextFavoriteID();
  }
  next();
});

export default mongoose.model("Favorite", favoriteSchema);
