import mongoose from "mongoose";
import Counter from "../Counter.js";

function pad(n, size=4){ return String(n).padStart(size,"0"); }
async function nextTagID(){
  const c = await Counter.findOneAndUpdate(
    { _id: "tag" }, { $inc: { seq: 1 } }, { new:true, upsert:true }
  );
  return `TAG-${pad(c.seq)}`;
}

const tagSchema = new mongoose.Schema({
  tag_id:   { type:String, required:true, unique:true, index:true },
  tag_name: { type:String, required:true, unique:true, trim:true }
}, { timestamps:true });

tagSchema.pre("validate", async function(next){
  if (this.isNew && !this.tag_id) this.tag_id = await nextTagID();
  next();
});

export default mongoose.model("Tag", tagSchema);
