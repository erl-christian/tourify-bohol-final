import Itinerary from "../../models/tourist/Itinerary.js";
import TouristProfile from "../../models/tourist/TouristProfile.js";
import BusinessEstablishment from "../../models/businessEstablishmentModels/BusinessEstablishment.js";

// POST /api/tourist/itineraries
export const createItinerary = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) throw new Error('Unauthorized');

    const tourist = await TouristProfile.findOne({ account_id });
    if (!tourist) throw new Error('Tourist profile not found');

    const {
      title,
      start_date,
      end_date,
      total_budget,
      stops = [],
      route_geometry = [],
      summary,
      origin,
    } = req.body;

    if (!title || !start_date || !end_date) {
      throw new Error('title, start_date, and end_date are required');
    }

    const normalizedStops = stops
      .map(stop => {
        if (!Number.isFinite(stop.order)) return null;
        return {
          order: Number(stop.order),
          business_establishment_id: stop.business_establishment_id ?? null,
          title: stop.title ?? null,
          municipality: stop.municipality ?? null,
          latitude: Number.isFinite(stop.latitude) ? Number(stop.latitude) : null,
          longitude: Number.isFinite(stop.longitude) ? Number(stop.longitude) : null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.order - b.order);

    const normalizedRoute = Array.isArray(route_geometry)
      ? route_geometry
          .map(point => {
            if (!Number.isFinite(point?.latitude) || !Number.isFinite(point?.longitude)) return null;
            return {
              latitude: Number(point.latitude),
              longitude: Number(point.longitude),
            };
          })
          .filter(Boolean)
      : [];

    const itinerary = await Itinerary.create({
      tourist_profile_id: tourist.tourist_profile_id,
      title,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      total_budget,
      stops: normalizedStops,
      route_geometry: normalizedRoute,
      summary: summary ?? {},
      origin:
        origin &&
        Number.isFinite(origin.latitude) &&
        Number.isFinite(origin.longitude)
          ? { latitude: Number(origin.latitude), longitude: Number(origin.longitude) }
          : undefined,
    });

    res.status(201).json({ message: 'Itinerary created', itinerary });
  } catch (err) {
    next(err);
  }
};


// GET /api/tourist/itineraries
export const getMyItineraries = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    const tourist = await TouristProfile.findOne({ account_id });
    if (!tourist) throw new Error("Tourist profile not found");

    const itineraries = await Itinerary.find({
      tourist_profile_id: tourist.tourist_profile_id,
    }).sort({ createdAt: -1 });

    res.json({ itineraries });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/tourist/itineraries/:id/status
export const updateItineraryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!["Planned", "Ongoing", "Completed", "Cancelled"].includes(status))
      throw new Error("Invalid status");

    const itinerary = await Itinerary.findOneAndUpdate(
      { itinerary_id: id },
      { status },
      { new: true }
    );

    if (!itinerary) throw new Error("Itinerary not found");
    res.json({ message: "Status updated", itinerary });
  } catch (err) {
    next(err);
  }
};

export const getTravelHistory = async (req, res, next) => {
  try {
    const accountId = req.user?.account_id;
    if (!accountId) { res.status(401); throw new Error("Unauthorized"); }

    const tourist = await TouristProfile.findOne({ account_id: accountId }).lean();
    if (!tourist) { res.status(404); throw new Error("Tourist profile not found"); }

    const itineraries = await Itinerary.find({
      tourist_profile_id: tourist.tourist_profile_id,
      status: 'Completed',
    })
      .sort({ end_date: -1 })
      .lean();

    const establishmentCache = new Map();
    const enrichStop = async stop => {
      if (!stop?.business_establishment_id) return stop;
      const key = stop.business_establishment_id;
      if (!establishmentCache.has(key)) {
        const est = await BusinessEstablishment.findOne({ businessEstablishment_id: key }).lean();
        establishmentCache.set(key, est);
      }
      const est = establishmentCache.get(key);
      return {
        ...stop,
        establishment: est
          ? {
              businessEstablishment_id: est.businessEstablishment_id,
              name: est.name,
              address: est.address,
              municipality_id: est.municipality_id,
              type: est.type,
              latitude: est.latitude,
              longitude: est.longitude,
              tags: est.tags ?? [],
            }
          : null,
      };
    };

    const hydrated = [];
    for (const itinerary of itineraries) {
      const stops = Array.isArray(itinerary.stops) ? itinerary.stops : [];
      const enrichedStops = await Promise.all(stops.map(enrichStop));

      const visitedCount = enrichedStops.length;
      const budget = itinerary.total_budget ?? 0;

      const categories = {};
      enrichedStops.forEach(stop => {
        const type = stop?.establishment?.type;
        if (type) categories[type] = (categories[type] || 0) + 1;
      });

      hydrated.push({
        ...itinerary,
        stops: enrichedStops,
        visitedCount,
        categories,
        total_budget: budget,
      });
    }

    const totalDestinations = hydrated.reduce((acc, itin) => acc + itin.visitedCount, 0);
    const totalBudget = hydrated.reduce((acc, itin) => acc + (itin.total_budget || 0), 0);

    const categoryMap = {};
    hydrated.forEach(itin => {
      Object.entries(itin.categories).forEach(([category, count]) => {
        categoryMap[category] = (categoryMap[category] || 0) + count;
      });
    });

    const stats = {
      totalTrips: hydrated.length,
      totalDestinations,
      totalBudget,
      favoriteCategories: Object.entries(categoryMap)
        .sort((a, b) => b[1] - a[1])
        .map(([category, count]) => ({ category, count })),
    };

    res.json({ itineraries: hydrated, stats });
  } catch (err) {
    next(err);
  }
};
