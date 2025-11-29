import mongoose from "mongoose";
import Counter from "../Counter.js";

function pad(n, s=4){ return String(n).padStart(s,"0"); }
async function nextId(){
  const c = await Counter.findOneAndUpdate(
    { _id: "media_feedback" }, { $inc: { seq: 1 } }, { new:true, upsert:true }
  );
  return `MFB-${pad(c.seq)}`;
}

const mediaFeedbackSchema = new mongoose.Schema({
  media_feedback_id: { type:String, required:true, unique:true, index:true },
  feedback_id:       { type:String, required:true, index:true },
  media_id:          { type:String, required:true, index:true }   // points to your Media model
}, { timestamps:true });

mediaFeedbackSchema.pre("validate", async function(next){
  if (this.isNew && !this.media_feedback_id) this.media_feedback_id = await nextId();
  next();
});

export default mongoose.model("MediaFeedback", mediaFeedbackSchema);
