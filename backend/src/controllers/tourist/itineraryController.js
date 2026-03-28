import Itinerary from "../../models/tourist/Itinerary.js";
import TouristProfile from "../../models/tourist/TouristProfile.js";
import BusinessEstablishment from "../../models/businessEstablishmentModels/BusinessEstablishment.js";

const perpendicularDistance = (point, start, end) => {
  if (!point || !start || !end) return 0;

  if (start.latitude === end.latitude && start.longitude === end.longitude) {
    const dx = point.latitude - start.latitude;
    const dy = point.longitude - start.longitude;
    return Math.sqrt(dx * dx + dy * dy);
  }

  const numerator = Math.abs(
    (end.longitude - start.longitude) * (start.latitude - point.latitude) -
      (start.longitude - point.longitude) * (end.latitude - start.latitude)
  );
  const denominator = Math.sqrt(
    (end.longitude - start.longitude) ** 2 + (end.latitude - start.latitude) ** 2
  );

  return denominator > 0 ? numerator / denominator : 0;
};

const douglasPeucker = (points, tolerance) => {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let splitIndex = 0;

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(
      points[index],
      points[0],
      points[points.length - 1]
    );
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = index;
    }
  }

  if (maxDistance <= tolerance) {
    return [points[0], points[points.length - 1]];
  }

  const left = douglasPeucker(points.slice(0, splitIndex + 1), tolerance);
  const right = douglasPeucker(points.slice(splitIndex), tolerance);
  return [...left.slice(0, -1), ...right];
};

const capRouteGeometry = (points, maxPoints) => {
  if (points.length <= maxPoints) return points;

  const capped = [points[0]];
  const step = (points.length - 1) / (maxPoints - 1);

  for (let index = 1; index < maxPoints - 1; index += 1) {
    const sourceIndex = Math.round(index * step);
    const point = points[sourceIndex];
    if (!point) continue;

    const previous = capped[capped.length - 1];
    if (
      previous?.latitude === point.latitude &&
      previous?.longitude === point.longitude
    ) {
      continue;
    }

    capped.push(point);
  }

  const lastPoint = points[points.length - 1];
  const previous = capped[capped.length - 1];
  if (
    !previous ||
    previous.latitude !== lastPoint.latitude ||
    previous.longitude !== lastPoint.longitude
  ) {
    capped.push(lastPoint);
  }

  return capped;
};

const reduceRouteGeometry = (points) => {
  const normalized = (Array.isArray(points) ? points : [])
    .map(point => {
      if (!Number.isFinite(point?.latitude) || !Number.isFinite(point?.longitude)) return null;
      return {
        latitude: Number(Number(point.latitude).toFixed(5)),
        longitude: Number(Number(point.longitude).toFixed(5)),
      };
    })
    .filter(Boolean);

  if (normalized.length <= 2) return normalized;

  const simplified = douglasPeucker(normalized, 0.00018);
  return capRouteGeometry(simplified, 160);
};

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

    const normalizedRoute = reduceRouteGeometry(route_geometry);

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
