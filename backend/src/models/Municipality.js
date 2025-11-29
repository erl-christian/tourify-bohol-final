import mongoose from "mongoose";
import Counter from "./Counter.js";

const municipalitySchema = new mongoose.Schema(
    {
        municipality_id: { type: String, required: true, unique: true, index: true},
        name: { type: String, required: true, trim: true},
        latitude: { type: Number },
        longitude: { type: Number }
    },
    { timestamps: true }
);

//Generation of the municipality ID
municipalitySchema.pre("validate", async function (next) {
    try {
        if (this.isNew && !this.municipality_id) {
        const prefix = this.name.substring(0, 4).toUpperCase(); // "TAGB"
        const c = await Counter.findOneAndUpdate(
            { _id: "municipality" },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        const seq = String(c.seq).padStart(3, "0"); // 001, 002, ...
        this.municipality_id = `${prefix}-${seq}`;
    }
    next();
    } catch (error) {
        next(error)
    }
})


export default mongoose.model("Municipality", municipalitySchema);