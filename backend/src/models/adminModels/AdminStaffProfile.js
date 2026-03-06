import mongoose from "mongoose";
import Counter from "../Counter.js";

const adminStaffProfileSchema = new mongoose.Schema(

    {
        //pk
        admin_staff_profile_id: { type: String, required: true, unique: true, index: true },
        //fk
        account_id:             { type: String, unique: true, index: true },
        municipality_id:        { type: String, required: true, index: true },

        full_name:              { type: String, required: true, trim: true },
        contact_no:             { type: String, trim: true }, // optional, editable by account owner

        // "BTO Admin" "BTO Staff" "LGU Admin" "LGU Staff"
        position:                   { type: String, required: true, trim: true }

    },{timestamps: true}

)

// Auto-generate admin_staff_profile_id (e.g. ADM-0001)
adminStaffProfileSchema.pre("validate", async function (next) {
    try {
        if (this.isNew && !this.admin_staff_profile_id) {
            const c = await Counter.findOneAndUpdate(
                { _id: "admin_staff_profile" },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            const seq = String(c.seq).padStart(4, "0"); // 0001, 0002, etc.
            this.admin_staff_profile_id = `ADM-${seq}`;
        }
        next();
    } catch (err) {
        next(err);
    }
});

export default mongoose.model("AdminStaffProfile", adminStaffProfileSchema);