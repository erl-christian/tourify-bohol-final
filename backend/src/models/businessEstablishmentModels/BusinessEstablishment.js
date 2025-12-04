import mongoose from "mongoose";
import Counter from "../Counter.js";

const businessEstablishmentSchema = new mongoose.Schema(
    {
        //pk
        businessEstablishment_id: { type: String, required: true, unique: true, index: true },

        //fk
        businessEstablishment_approval_id: { type: String, index: true},
        municipality_id: { type: String, required: true, index: true },
        business_establishment_profile_id: { type: String, index: true },

        //colums
        name:            { type: String, required: true, trim: true },
        type:            { type: String, required: true, trim: true }, // hotel|restaurant|attraction...
        address:         { type: String, trim: true },
        description:     { type: String },
        contact_info:    { type: String },
        accreditation_no:{ type: String },

        status: {
            type: String,
            enum: ["pending", "needs_admin_review", "needs_owner_revision", "approved", "rejected"],
            default: "pending",
            index: true,
        },

        ownership_type: { type: String, enum: ["private","government"], default: "private", index: true },
        created_by_adminStaffProfile_id: { type: String, index: true },
        
        qr_code:   { type: String },
        latitude:  { type: Number },
        longitude: { type: Number },
        
        rating_count: { type: Number, default: 0 },
        rating_avg:   { type: Number, default: 0 },


    }
)

//auto-generated pk
businessEstablishmentSchema.pre("validate", async function (next) {
    try {
        if (this.isNew && !this.businessEstablishment_id) {
            const c = await Counter.findOneAndUpdate(
                { _id: "businessEstablishment" },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            const seq = String(c.seq).padStart(4, "0"); // 0001, 0002, etc.
            this.businessEstablishment_id = `EST-${seq}`;
        }
        next();
    } catch (err) {
        next(err);
    }
});


export default mongoose.model("BusinessEstablishment", businessEstablishmentSchema);