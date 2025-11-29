import mongoose from "mongoose";

const FrequentSequenceSchema = new mongoose.Schema(
  {
    // For bigrams:
    from_business_establishment_id: { type: String, index: true },
    to_business_establishment_id: { type: String, index: true },

    // Optional scoping:
    municipality_id: { type: String, index: true },

    // Stats:
    support: { type: Number, default: 0 },      // count of (A→B)
    from_support: { type: Number, default: 0 }, // count of A as a predecessor
    confidence: { type: Number, default: 0 },   // support / from_support
    lift: { type: Number, default: 0 },         // confidence / P(B)

    // housekeeping
    window_days: { type: Number, default: 365 },  // training window you used
    updated_at: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

FrequentSequenceSchema.index({ from_business_establishment_id: 1, to_business_establishment_id: 1, municipality_id: 1 }, { unique: true });

export default mongoose.model("FrequentSequence", FrequentSequenceSchema);
