import TouristProfile from '../../models/tourist/TouristProfile.js';
import BusinessEstablishment from '../../models/businessEstablishmentModels/BusinessEstablishment.js';
import Itinerary from '../../models/tourist/Itinerary.js';
import TravelHistory from '../../models/tourist/TravelHistory.js';

export const checkinStop = async (req, res, next) => {
  try {
    const accountId = req.user?.account_id;
    if (!accountId) { res.status(401); throw new Error('Unauthorized'); }

    const tourist = await TouristProfile.findOne({ account_id: accountId }).lean();
    if (!tourist) { res.status(404); throw new Error('Tourist profile not found'); }

    const { itineraryId } = req.params;
    const { business_establishment_id: establishmentId } = req.body;

    if (!establishmentId) {
      res.status(400);
      throw new Error('business_establishment_id is required');
    }

    const itinerary = await Itinerary.findOne({
      itinerary_id: itineraryId,
      tourist_profile_id: tourist.tourist_profile_id,
    }).lean();

    if (!itinerary) {
      res.status(404);
      throw new Error('Itinerary not found for this tourist');
    }

    const stopIndex = itinerary.stops.findIndex(
      stop => stop.business_establishment_id === establishmentId
    );

    if (stopIndex === -1) {
      res.status(404);
      throw new Error('Stop not found in this itinerary');
    }

    const stopMeta = itinerary.stops[stopIndex];

    const est = await BusinessEstablishment.findOne({ businessEstablishment_id: establishmentId }).lean();
    if (!est) {
      res.status(404);
      throw new Error('Establishment does not exist');
    }

    const latitude = Number(est.latitude);
    const longitude = Number(est.longitude);

    const updated = await Itinerary.findOneAndUpdate(
      { itinerary_id: itineraryId, 'stops.business_establishment_id': establishmentId },
      {
        $set: {
          'stops.$.visited': true,
          'stops.$.visited_at': new Date(),
          'stops.$.latitude': est.latitude,
          'stops.$.longitude': est.longitude,
        },
      },
      { new: true }
    );

    const now = new Date();
    const historyFilter = {
      itinerary_id: itineraryId,
      tourist_profile_id: tourist.tourist_profile_id,
      business_establishment_id: establishmentId,
    };

    const historyUpdates = {
      status: 'visited',
      date_visited: now,
      capture_method: req.body.capture_method ?? (req.body.scanned ? 'qr_scan' : 'manual'),
      actual_arrival: req.body.actual_arrival ?? now,
      actual_departure: req.body.actual_departure ?? undefined,
      capture_latitude: req.body.latitude,
      capture_longitude: req.body.longitude,
      latitude,
      longitude,
    };

    let history = await TravelHistory.findOne(historyFilter);

    if (history) {
      Object.assign(history, historyUpdates);
      await history.save();
    } else {
      history = await TravelHistory.create({
        ...historyFilter,
        ...historyUpdates,
        scheduled_date: stopMeta?.scheduled_date ?? now,
        scheduled_arrival: stopMeta?.scheduled_arrival ?? null,
        scheduled_destination: stopMeta?.title ?? stopMeta?.name ?? 'Visited stop',
        priority: stopMeta?.order ?? 1,
      });
    }

    const allVisited = updated.stops.every(stop => stop.visited);

    res.json({
      message: 'Check-in recorded',
      itinerary: updated,
      allVisited,
    });
  } catch (err) {
    next(err);
  }
};

export const finalizeItinerary = async (req, res, next) => {
  try {
    const accountId = req.user?.account_id;
    if (!accountId) { res.status(401); throw new Error('Unauthorized'); }

    const tourist = await TouristProfile.findOne({ account_id: accountId }).lean();
    if (!tourist) { res.status(404); throw new Error('Tourist profile not found'); }

    const { itineraryId } = req.params;

    const itinerary = await Itinerary.findOne({
      itinerary_id: itineraryId,
      tourist_profile_id: tourist.tourist_profile_id,
    }).lean();

    if (!itinerary) {
      res.status(404);
      throw new Error('Itinerary not found');
    }

    const allVisited = itinerary.stops.every(stop => stop.visited);
    if (!allVisited) {
      res.status(400);
      throw new Error('Not all stops have been visited yet');
    }

    const updated = await Itinerary.findOneAndUpdate(
      { itinerary_id: itineraryId },
      { $set: { status: 'Completed', end_date: new Date() } },
      { new: true }
    );

    const stops = itinerary.stops ?? [];
    await Promise.all(
      stops.map(stop =>
        TravelHistory.updateOne(
          { itinerary_id: itineraryId, tourist_profile_id: tourist.tourist_profile_id, business_establishment_id: stop.business_establishment_id },
          {
            $setOnInsert: {
              scheduled_date: stop.visited_at ?? itinerary.end_date ?? new Date(),
              scheduled_destination: stop.title ?? 'Visited stop',
            },
            $set: {
              status: 'visited',
              date_visited: stop.visited_at ?? new Date(),
              latitude: stop.latitude,
              longitude: stop.longitude,
            },
          },
          { upsert: true }
        )
      )
    );


    res.json({ message: 'Itinerary marked as completed', itinerary: updated });
  } catch (err) {
    next(err);
  }
};