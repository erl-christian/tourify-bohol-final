import TravelHistory from "../../models/tourist/TravelHistory.js";
import Itinerary from "../../models/tourist/Itinerary.js";
import TouristProfile from "../../models/tourist/TouristProfile.js";
import BusinessEstablishment from "../../models/businessEstablishmentModels/BusinessEstablishment.js";


// helper: find tourist_profile_id from JWT
async function getTouristProfileId(account_id) {
  const t = await TouristProfile.findOne({ account_id });
  if (!t) throw new Error("Tourist profile not found");
  return t.tourist_profile_id;
}

// POST /api/tourist/itineraries/:itineraryId/history
export const addHistoryStop = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) { res.status(401); throw new Error("Unauthorized"); }

    const tourist = await TouristProfile.findOne({ account_id });
    if (!tourist) { res.status(404); throw new Error("Tourist profile not found"); }

    const { itineraryId } = req.params;
    const itinerary = await Itinerary.findOne({
      itinerary_id: itineraryId,
      tourist_profile_id: tourist.tourist_profile_id
    });
    if (!itinerary) { res.status(404); throw new Error("Itinerary not found"); }

    const {
      business_establishment_id,
      estimated_arrival,
      estimated_departure,
      scheduled_date,
      scheduled_arrival,
      scheduled_destination,
      method,
      priority,
      notes
    } = req.body;

    if (!business_establishment_id || !scheduled_date) {
      res.status(400); throw new Error("business_establishment_id and scheduled_date are required");
    }

    // ensure establishment exists & approved
    const est = await BusinessEstablishment.findOne({ businessEstablishment_id: business_establishment_id });
    if (!est) { res.status(404); throw new Error("Business establishment not found"); }
    if (est.status !== "approved") { res.status(400); throw new Error("Establishment is not approved"); }

    const stop = await TravelHistory.create({
      tourist_profile_id: tourist.tourist_profile_id,
      itinerary_id: itinerary.itinerary_id,
      business_establishment_id,
      estimated_arrival,
      estimated_departure,
      scheduled_date,
      scheduled_arrival,
      scheduled_destination,
      method,
      priority,
      notes
    });

    res.status(201).json({ message: "Stop added", stop });
  } catch (e) { next(e); }
};

// GET /api/tourist/itineraries/:itineraryId/history
export const listItineraryStops = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) { res.status(401); throw new Error("Unauthorized"); }

    const tourist = await TouristProfile.findOne({ account_id });
    if (!tourist) { res.status(404); throw new Error("Tourist profile not found"); }

    const { itineraryId } = req.params;

    // ensure ownership (optional but good)
    const owns = await Itinerary.findOne({
      itinerary_id: itineraryId,
      tourist_profile_id: tourist.tourist_profile_id
    });
    if (!owns) { res.status(404); throw new Error("Itinerary not found"); }

    const stops = await TravelHistory.find({
      itinerary_id: itineraryId,
      tourist_profile_id: tourist.tourist_profile_id
    }).sort({ scheduled_date: 1, priority: 1 });

    res.json({ stops });
  } catch (e) { next(e); }
};

// PATCH /api/tourist/history/:thId
// body: any of { scheduled_date, scheduled_arrival, method, priority, notes, status }
export const updateHistoryStop = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) { res.status(401); throw new Error("Unauthorized"); }
    const tourist_profile_id = await getTouristProfileId(account_id);

    const { thId } = req.params;
    const stop = await TravelHistory.findOne({ travel_history_id: thId, tourist_profile_id });
    if (!stop) { res.status(404); throw new Error("Travel history stop not found"); }

    const allowed = ["scheduled_date","scheduled_arrival","method","priority","notes","status"," estimated_arrival", "estimated_departure"];
    let changed = 0;
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, k)) {
        stop[k] = req.body[k];
        changed++;
      }
    }

    // handle visited timestamp logic
    if (req.body.status) {
      if (req.body.status === "visited" && !stop.date_visited) {
        stop.date_visited = new Date();
      }
      if (req.body.status !== "visited") {
        stop.date_visited = undefined;
      }
    }

    if (!changed) { res.status(400); throw new Error("No updatable fields provided"); }

    await stop.save();
    res.json({ message: "Stop updated", stop });
  } catch (e) { next(e); }
};

// PATCH /api/tourist/history/:thId/visit
// body: { actual_arrival?, actual_departure?, date_visited? }
export const markStopVisited = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) { res.status(401); throw new Error("Unauthorized"); }
    const tourist_profile_id = await getTouristProfileId(account_id);

    const { thId } = req.params;
    const stop = await TravelHistory.findOne({ travel_history_id: thId, tourist_profile_id });
    if (!stop) { res.status(404); throw new Error("Travel history stop not found"); }

    const { actual_arrival, actual_departure, date_visited } = req.body;
    if (actual_arrival !== undefined)  stop.actual_arrival  = actual_arrival;
    if (actual_departure !== undefined) stop.actual_departure = actual_departure;

    stop.status = "visited";
    stop.date_visited = date_visited ? new Date(date_visited) : new Date();

    await stop.save();
    res.json({ message: "Stop marked as visited", stop });
  } catch (e) { next(e); }
};

// DELETE /api/tourist/history/:thId
export const deleteHistoryStop = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) { res.status(401); throw new Error("Unauthorized"); }
    const tourist_profile_id = await getTouristProfileId(account_id);

    const { thId } = req.params;
    const deleted = await TravelHistory.findOneAndDelete({ travel_history_id: thId, tourist_profile_id });
    if (!deleted) { res.status(404); throw new Error("Travel history stop not found"); }

    res.json({ message: "Stop deleted", travel_history_id: thId });
  } catch (e) { next(e); }
};

// PATCH /api/tourist/itineraries/:itineraryId/history/reorder
// body: { order: [ "THI-...", "THI-...", ... ] }  // new order, top = priority 1
export const reorderItineraryStops = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) { res.status(401); throw new Error("Unauthorized"); }

    const tourist = await TouristProfile.findOne({ account_id });
    if (!tourist) { res.status(404); throw new Error("Tourist profile not found"); }

    const { itineraryId } = req.params;
    const { order } = req.body;

    if (!Array.isArray(order) || order.length === 0) {
      res.status(400); throw new Error("Body must include non-empty array 'order'");
    }

    // ensure itinerary belongs to this tourist
    const itinerary = await Itinerary.findOne({
      itinerary_id: itineraryId,
      tourist_profile_id: tourist.tourist_profile_id
    });
    if (!itinerary) { res.status(404); throw new Error("Itinerary not found"); }

    // fetch current stops
    const stops = await TravelHistory.find({
      itinerary_id: itineraryId,
      tourist_profile_id: tourist.tourist_profile_id
    }).select("travel_history_id");

    const currentIds = stops.map(s => s.travel_history_id);
    const uniqueNew = new Set(order);

    // strict mode: order must contain exactly all current stop IDs (no missing / no extras)
    if (uniqueNew.size !== order.length) {
      res.status(400); throw new Error("Duplicate IDs in 'order'");
    }
    if (order.length !== currentIds.length) {
      res.status(400); throw new Error("Order must include all existing stop IDs");
    }
    // every id in order must exist in current
    for (const id of order) {
      if (!currentIds.includes(id)) {
        res.status(400); throw new Error(`Unknown stop id in order: ${id}`);
      }
    }

    // build bulk updates: priority = index+1
    const ops = order.map((id, idx) => ({
      updateOne: {
        filter: {
          travel_history_id: id,
          itinerary_id: itineraryId,
          tourist_profile_id: tourist.tourist_profile_id
        },
        update: { $set: { priority: idx + 1 } }
      }
    }));

    await TravelHistory.bulkWrite(ops, { ordered: true });

    const updated = await TravelHistory.find({
      itinerary_id: itineraryId,
      tourist_profile_id: tourist.tourist_profile_id
    }).sort({ priority: 1, scheduled_date: 1 });

    res.json({ message: "Reordered", stops: updated });
  } catch (e) { next(e); }
};
