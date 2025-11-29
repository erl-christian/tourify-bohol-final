import mongoose from "mongoose";
import Counter from "../Counter.js";

function pad(n, size=4){ return String(n).padStart(size,"0"); }
async function nextETagID(){
  const c = await Counter.findOneAndUpdate(
    { _id: "establishment_tag" }, { $inc: { seq: 1 } }, { new:true, upsert:true }
  );
  return `ETAG-${pad(c.seq)}`;
}

const establishmentTagSchema = new mongoose.Schema({
  establishment_tag_id:    { type:String, required:true, unique:true, index:true },
  business_establishment_id:{ type:String, required:true, index:true },
  tag_id:                  { type:String, required:true, index:true }
}, { timestamps:true });

establishmentTagSchema.pre("validate", async function(next){
  if (this.isNew && !this.establishment_tag_id)
    this.establishment_tag_id = await nextETagID();
  next();
});

// prevent duplicate tag assignment to same establishment
establishmentTagSchema.index(
  { business_establishment_id:1, tag_id:1 },
  { unique:true }
);

export default mongoose.model("EstablishmentTag", establishmentTagSchema);
