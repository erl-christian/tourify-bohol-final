import mongoose from "mongoose";
import Counter from "../Counter.js";

//pk id creation
function pad(n, size = 4) {
  return String(n).padStart(size, "0");
}

async function nextAccountID() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const dateKey = `${y}-${m}-${d}`; // e.g. 20251010

    const c = await Counter.findOneAndUpdate(
    { _id: dateKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
    );

    return `TRP-${dateKey}-${pad(c.seq)}`; // e.g. 2025-10-10-0001
};


const touristProfileSchema = new mongoose.Schema(
    {
        tourist_profile_id:{ type: String, required: true, unique: true, index: true },
        account_id:        { type: String, required: true, unique: true, index: true },
        full_name:         { type: String, required: true, trim: true },
        contact_no:        { type: String, trim: true },
        nationality:       { type: String, trim: true },

        avatar_media_id: { type: String, index: true }, // FK to Media.media_id
        avatar_url:      { type: String }               // cached image URL
        
    },{timestamps: true}
);

touristProfileSchema.pre("validate", async function (next) {
    if (this.isNew && !this.tourist_profile_id) {
        this.tourist_profile_id = await nextAccountID();
    }
    next();
})


export default mongoose.model("TouristProfile", touristProfileSchema)