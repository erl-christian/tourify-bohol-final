import mongoose from "mongoose";
import Counter from "../Counter.js";

function pad(n, s=4){ return String(n).padStart(s,"0"); }
async function nextId(){
  const c = await Counter.findOneAndUpdate(
    { _id: "feedback_summary" }, { $inc: { seq: 1 } }, { new:true, upsert:true }
  );
  return `FSUM-${pad(c.seq)}`;
}

const feedbackSummarySchema = new mongoose.Schema({
  feedback_summary_id:     { type:String, required:true, unique:true, index:true },
  business_establishment_id:{ type:String, required:true, index:true },
  // optional: store a report id if you later build Generate_Report
  generate_report_id:      { type:String },

  // aggregation window
  time_range_start:        { type: Date, required: true },
  time_range_end:          { type: Date, required: true },

  // numbers
  count:                   { type: Number, default: 0 },
  average_rating:          { type: Number, default: 0 },

  // optional text summary (AI / heuristic)
  ai_summary:              { type: String },

  generated_at:            { type: Date, default: Date.now }
}, { timestamps:true });

feedbackSummarySchema.pre("validate", async function(next){
  if (this.isNew && !this.feedback_summary_id) this.feedback_summary_id = await nextId();
  next();
});

export default mongoose.model("FeedbackSummary", feedbackSummarySchema);
