import mongoose from "mongoose";
import Counter from "../Counter.js";

const establishmentApprovalSchema = new mongoose.Schema(
    {
        //pk
        establishment_approval_id: { type: String, required: true, unique: true, index: true },

        approval_status: {
            type: String,
            enum: ["pending", "approved", "rejected", "needs_admin_review", "needs_owner_revision"],
            required: true,
        },
        action:          { type: String, trim: true }, // "submit" | "approve" | "reject"
        remarks:         { type: String },
        action_date:     { type: Date, default: Date.now },
        is_latest:       { type: Boolean, default: true },

        // Useful trace fields (align with ERD relations)
        businessEstablishment_id: { type: String, required: true, index: true },
        admin_staff_profile_id:    { type: String, required: true, index: true }

    },{ timestamps: true }
)

establishmentApprovalSchema.pre("validate", async function (next) {
    try {
        if (this.isNew && !this.establishment_approval_id) {
            const c = await Counter.findOneAndUpdate(
                { _id: "establishmentApproval" },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            const seq = String(c.seq).padStart(4, "0"); // 0001, 0002, etc.
            this.establishment_approval_id = `EAPP-${seq}`;
        }
        next();
    } catch (err) {
        next(err);
    }
});



export default mongoose.model("EstablishmentApproval", establishmentApprovalSchema);