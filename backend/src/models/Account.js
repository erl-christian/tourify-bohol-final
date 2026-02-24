import mongoose from "mongoose";
import bcrypt from "bcrypt";
import Counter from "./Counter.js";

//account roles
const ROLES = [
    "tourist",
    "business_establishment",
    "lgu_staff",
    "lgu_admin",
    "bto_admin"
];

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

    return `${dateKey}-${pad(c.seq)}`; // e.g. 2025-10-10-0001
};


const accountSchema= new mongoose.Schema(
    {
        email:      { type: String, required:true, unique:true, lowercase:true, trim: true },
        password:   { type: String, required:true, minlength: 8 },
        role:       { type: String, enum: ROLES, default: "tourist", index: true },
        is_active:  { type: Boolean, default: true, index: true },
        must_change_password: { type: Boolean, default: false, index: true },
        email_verified: { type: Boolean, default: false, index: true },
        email_verified_at: { type: Date },
        //PK
        account_id: { type: String, unique: true, index: true } 
    },
    { timestamps: true }
);

//Auto-generated ID
accountSchema.pre("validate", async function (next) {
    if (this.isNew && !this.account_id) {
        this.account_id = await nextAccountID();
    }
    next();
})


//password Hashing
accountSchema.pre("save", async function (next) {
    if (this.isModified("password")) this.password = await bcrypt.hash(this.password, 10);
    next();
})

//compare helper
accountSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

export default mongoose.model("Account", accountSchema);