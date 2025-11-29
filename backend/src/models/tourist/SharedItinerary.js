import mongoose from 'mongoose';

const sharedItinerarySchema = new mongoose.Schema(
  {
    itinerary_id: { type: String, required: true, index: true },
    tourist_profile_id: { type: String, required: true, index: true },
    title: { type: String, required: true },
    caption: { type: String, maxlength: 300 },
    cover_photo: { type: String },
    summary: { type: String },
    route_geometry: [
      {
        latitude: Number,
        longitude: Number,
      },
    ],
    stops: [
      {
        business_establishment_id: String,
        name: String,
        municipality: String,
        latitude: Number,
        longitude: Number,
      },
    ],
    shared_at: { type: Date, default: Date.now },
    is_public: { type: Boolean, default: true },
  },
  { timestamps: true }
);

sharedItinerarySchema.index({ is_public: 1, shared_at: -1 });

export default mongoose.model('SharedItinerary', sharedItinerarySchema);
