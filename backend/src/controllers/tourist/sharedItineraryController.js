import SharedItinerary from '../../models/tourist/SharedItinerary.js';
import TouristProfile from '../../models/tourist/TouristProfile.js';
import Itinerary from '../../models/tourist/Itinerary.js';
import TravelHistory from '../../models/tourist/TravelHistory.js';

export const shareItinerary = async (req, res, next) => {
  try {
    const { itineraryId } = req.params;
    const { caption = '' } = req.body;
    const accountId = req.user?.account_id;

    const tourist = await TouristProfile.findOne({ account_id: accountId }).lean();
    if (!tourist) {
      res.status(404);
      throw new Error('Tourist profile not found');
    }

    const itinerary = await Itinerary.findOne({
      itinerary_id: itineraryId,
      tourist_profile_id: tourist.tourist_profile_id,
    }).lean();

    if (!itinerary) {
      res.status(404);
      throw new Error('Itinerary not found');
    }

    const historyStops = await TravelHistory.find({
      itinerary_id: itinerary.itinerary_id,
      tourist_profile_id: tourist.tourist_profile_id,
    }).lean();

    const historyByEst = new Map(
      historyStops.map(stop => [stop.business_establishment_id, stop])
    );

    const stops = (itinerary.stops ?? []).map((stop, idx) => {
      const history = stop.business_establishment_id
        ? historyByEst.get(stop.business_establishment_id)
        : null;
      const latitude = history?.latitude ?? stop.latitude;
      const longitude = history?.longitude ?? stop.longitude;

      return {
        business_establishment_id: stop.business_establishment_id,
        name: stop.title,
        municipality: stop.municipality,
        latitude,
        longitude,
        order: stop.order ?? idx + 1,
      };
    });

    const routeGeometry = stops
      .filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
      .map(point => ({ latitude: point.latitude, longitude: point.longitude }));

    const doc = await SharedItinerary.create({
      itinerary_id: itinerary.itinerary_id,
      tourist_profile_id: tourist.tourist_profile_id,
      title: itinerary.title,
      caption: caption.trim().slice(0, 300),
      cover_photo: itinerary.cover_photo ?? null,
      summary: itinerary.summary?.description ?? null,
      route_geometry: routeGeometry,
      stops,
    });

    res.status(201).json({ shared: doc });
  } catch (err) {
    next(err);
  }
};

export const listSharedItineraries = async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const items = await SharedItinerary.find({ is_public: true })
      .sort({ shared_at: -1 })
      .limit(limit)
      .lean();
    res.json({ items });
  } catch (err) {
    next(err);
  }
};
