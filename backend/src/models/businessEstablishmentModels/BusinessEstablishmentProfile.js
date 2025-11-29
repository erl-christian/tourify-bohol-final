import mongoose from "mongoose";
import Counter from "../Counter.js";

const businessEstablishmentProfileSchema = new mongoose.Schema(
  {
    // ERD PK (auto)
    business_establishment_profile_id: { type: String, required: true, unique: true, index: true },

    // ERD FKs
    account_id:                { type: String, required: true, unique: true, index: true }, // readable Account PK
    municipality_id: { type: String, required: true, index: true },

    // ERD columns
    full_name:  { type: String, required: true, trim: true },
    role:       { type: String, default: "Owner", trim: true },
    contact_no: { type: String, trim: true }
  },
  { timestamps: true }
);

// Auto PK: BEP-0001
businessEstablishmentProfileSchema.pre("validate", async function(next) {
  try {
    if (this.isNew && !this.business_establishment_profile_id) {
      const c = await Counter.findOneAndUpdate(
        { _id: "business_establishment_profile" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.business_establishment_profile_id = `BEP-${String(c.seq).padStart(4, "0")}`;
    }
    next();
  } catch (e) { next(e); }
});

export default mongoose.model("BusinessEstablishmentProfile", businessEstablishmentProfileSchema);