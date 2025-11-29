import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../src/config/database.js';
import BusinessEstablishment from '../src/models/businessEstablishmentModels/BusinessEstablishment.js';
import Itinerary from '../src/models/tourist/Itinerary.js';

const TOURIST_PROFILE_ID = 'TRP-2025-10-29-0002';

const TRIPS = [
  {
    title: 'Panglao Weekend Escape',
    start_date: '2025-03-15',
    end_date: '2025-03-17',
    total_budget: 12500,
    summary: { distance_km: 28, duration_minutes: 195 },
    stops: [
      'Alona Beachfront Retreat',
      'Balicasag Island Dive Spot',
      'Bohol Bee Farm Restaurant',
    ],
  },
  {
    title: 'Heritage & Hills Mini Tour',
    start_date: '2025-05-20',
    end_date: '2025-05-22',
    total_budget: 9800,
    summary: { distance_km: 86, duration_minutes: 320 },
    stops: [
      'Baclayon Church',
      'Chocolate Hills View Deck',
      'Tarsier Conservation Area',
    ],
  },
  {
    title: 'Adventure Day Out',
    start_date: '2025-07-03',
    end_date: '2025-07-03',
    total_budget: 6200,
    summary: { distance_km: 64, duration_minutes: 240 },
    stops: [
      'Danao Adventure Park',
      'Hinagdanan Cave',
      'Anda White Beach',
    ],
  },
];

async function buildStops(stopNames) {
  const visited = [];
  for (let idx = 0; idx < stopNames.length; idx += 1) {
    const name = stopNames[idx];
    const est = await BusinessEstablishment.findOne({ name }).lean();
    if (!est) {
      console.warn(`Skipping stop "${name}" because the establishment was not found.`);
      continue;
    }
    visited.push({
      order: idx + 1,
      business_establishment_id: est.businessEstablishment_id,
      title: est.name,
      municipality: est.municipality_id,
      latitude: est.latitude,
      longitude: est.longitude,
    });
  }
  return visited;
}

async function seedTravelHistory() {
  for (const trip of TRIPS) {
    const duplicate = await Itinerary.findOne({
      tourist_profile_id: TOURIST_PROFILE_ID,
      title: trip.title,
    }).lean();
    if (duplicate) {
      console.log(`Skipping existing itinerary "${trip.title}"`);
      continue;
    }

    const stops = await buildStops(trip.stops);
    if (!stops.length) {
      console.log(`No valid stops found for "${trip.title}". Skipping.`);
      continue;
    }

    const route_geometry = stops
      .map(stop => {
        if (typeof stop.latitude !== 'number' || typeof stop.longitude !== 'number') return null;
        return { latitude: stop.latitude, longitude: stop.longitude };
      })
      .filter(Boolean);

    await Itinerary.create({
      tourist_profile_id: TOURIST_PROFILE_ID,
      title: trip.title,
      start_date: new Date(trip.start_date),
      end_date: new Date(trip.end_date),
      total_budget: trip.total_budget,
      stops,
      route_geometry,
      summary: trip.summary,
      origin: route_geometry.length ? route_geometry[0] : null,
      status: 'Completed',
    });

    console.log(`Seeded itinerary "${trip.title}"`);
  }
}

async function run() {
  await connectDB();
  try {
    await seedTravelHistory();
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(err => {
  console.error(err);
  mongoose.disconnect();
});
