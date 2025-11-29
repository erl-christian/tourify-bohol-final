import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../src/config/database.js';

import BusinessEstablishment from '../src/models/businessEstablishmentModels/BusinessEstablishment.js';
import EstablishmentTag from '../src/models/tagModels/EstablishmentTag.js';
import Tag from '../src/models/tagModels/Tag.js';
import Feedback from '../src/models/feedback/Feedback.js';
import Itinerary from '../src/models/tourist/Itinerary.js';
import TouristProfile from '../src/models/tourist/TouristProfile.js';

const OWNER_ACCOUNT_ID = '2025-10-13-0001';
const OWNER_PROFILE_ID = 'BEP-0001';

const TAGS = [
  { tag_id: 'TAG-001', tag_name: 'family' },
  { tag_id: 'TAG-002', tag_name: 'heritage' },
  { tag_id: 'TAG-003', tag_name: 'adventure' },
  { tag_id: 'TAG-004', tag_name: 'nature' },
  { tag_id: 'TAG-005', tag_name: 'food' },
];

const ESTABLISHMENTS = [
  {
    businessEstablishment_id: 'EST-9001',
    businessEstablishment_approval_id: 'EAPP-9001',
    business_establishment_profile_id: OWNER_PROFILE_ID,
    municipality_id: 'TAGB-003',
    name: 'Eartyrey',
    type: 'restaurant',
    address: 'Gallares Ext., Tagbilaran City, Bohol',
    description: 'Modern Filipino dining with locally sourced ingredients and QR check-in at the entrance.',
    contact_info: '0998-454-5461',
    accreditation_no: 'BTO-RES-9001',
    status: 'approved',
    ownership_type: 'private',
    latitude: 9.6491,
    longitude: 123.8553,
    qr_code: '',
    rating_avg: 4.6,
    rating_count: 128,
    tags: ['TAG-005'],
  },
  {
    businessEstablishment_id: 'EST-9002',
    businessEstablishment_approval_id: 'EAPP-9002',
    business_establishment_profile_id: OWNER_PROFILE_ID,
    municipality_id: 'TAGB-003',
    name: 'Bayfront Heritage Suites',
    type: 'accommodation',
    address: 'Gomez St., Tagbilaran City, Bohol',
    description: 'Boutique suites overlooking the channel with on-site QR kiosks for guest check-ins.',
    contact_info: '0917-345-6789',
    accreditation_no: 'BTO-ACC-9002',
    status: 'approved',
    ownership_type: 'private',
    latitude: 9.6504,
    longitude: 123.8579,
    qr_code: '',
    rating_avg: 4.7,
    rating_count: 184,
    tags: ['TAG-001', 'TAG-002'],
  },
  {
    businessEstablishment_id: 'EST-9003',
    businessEstablishment_approval_id: 'EAPP-9003',
    business_establishment_profile_id: OWNER_PROFILE_ID,
    municipality_id: 'TAGB-003',
    name: 'Mangrove River Eco Cruise',
    type: 'tour',
    address: 'Barangay Taloto Pier, Tagbilaran City, Bohol',
    description: 'Eco-friendly boat cruise through the mangroves with QR stamping per docking station.',
    contact_info: '0920-445-6677',
    accreditation_no: 'BTO-TOUR-9003',
    status: 'approved',
    ownership_type: 'private',
    latitude: 9.6554,
    longitude: 123.8732,
    qr_code: '',
    rating_avg: 4.8,
    rating_count: 132,
    tags: ['TAG-003', 'TAG-004'],
  },
];

const FEEDBACK_SEED = [
  {
    establishment: 'Eartyrey',
    entries: [
      {
        tourist_profile_id: 'TP-1001',
        itinerary_id: 'IT-1001',
        rating: 5,
        review_text: 'Excellent flavors and quick QR check-in when we arrived.',
      },
      {
        tourist_profile_id: 'TP-1002',
        itinerary_id: 'IT-1002',
        rating: 4,
        review_text: 'Loved the food. Dining area can get busy during dinner service.',
      },
    ],
  },
  {
    establishment: 'Bayfront Heritage Suites',
    entries: [
      {
        tourist_profile_id: 'TP-2001',
        itinerary_id: 'IT-2001',
        rating: 5,
        review_text: 'Rooftop view is amazing. QR kiosk made check-in fast.',
      },
      {
        tourist_profile_id: 'TP-2002',
        itinerary_id: 'IT-2002',
        rating: 4,
        review_text: 'Rooms are clean. Parking slots fill up quickly.',
      },
    ],
  },
  {
    establishment: 'Mangrove River Eco Cruise',
    entries: [
      {
        tourist_profile_id: 'TP-3001',
        itinerary_id: 'IT-3001',
        rating: 5,
        review_text: 'Guide was very informative and the QR scan-out per stop was seamless.',
      },
      {
        tourist_profile_id: 'TP-3002',
        itinerary_id: 'IT-3002',
        rating: 4,
        review_text: 'Great experience overall. Would love more shade on the boat.',
      },
    ],
  },
];

const TRAVEL_HISTORY_SEED = {
  tourist_profile_id: 'TRP-2025-10-29-0002',
  account_id: '2025-10-29-0001',
  trips: [
    {
      title: 'Weekend Food & Heritage Crawl',
      start_date: '2025-03-15',
      end_date: '2025-03-16',
      total_budget: 9800,
      summary: { distance_km: 12, duration_minutes: 180 },
      establishments: ['Eartyrey', 'Bayfront Heritage Suites'],
    },
    {
      title: 'Mangrove Discovery Day',
      start_date: '2025-05-20',
      end_date: '2025-05-20',
      total_budget: 6200,
      summary: { distance_km: 24, duration_minutes: 210 },
      establishments: ['Mangrove River Eco Cruise', 'Eartyrey'],
    },
  ],
};

async function ensureTags() {
  const existing = await Tag.find().lean();
  const existingById = new Map(existing.map(tag => [tag.tag_id, tag]));
  const toInsert = TAGS.filter(tag => !existingById.has(tag.tag_id));

  if (toInsert.length) {
    await Tag.insertMany(toInsert);
    console.log(`Inserted ${toInsert.length} tags`);
  } else {
    console.log('Tags already seeded');
  }
}

async function seedEstablishments() {
  for (const est of ESTABLISHMENTS) {
    const already = await BusinessEstablishment.findOne({
      name: est.name,
      business_establishment_profile_id: OWNER_PROFILE_ID,
    }).lean();
    if (already) {
      console.log(`Skipping existing establishment: ${est.name}`);
      continue;
    }

    const payload = {
      businessEstablishment_id: est.businessEstablishment_id,
      businessEstablishment_approval_id: est.businessEstablishment_approval_id,
      business_establishment_profile_id: OWNER_PROFILE_ID,
      municipality_id: est.municipality_id,
      name: est.name,
      type: est.type,
      address: est.address,
      description: est.description,
      contact_info: est.contact_info,
      accreditation_no: est.accreditation_no,
      status: est.status ?? 'approved',
      ownership_type: est.ownership_type ?? 'private',
      latitude: est.latitude,
      longitude: est.longitude,
      qr_code: est.qr_code ?? '',
      rating_avg: est.rating_avg ?? 0,
      rating_count: est.rating_count ?? 0,
    };

    const created = await BusinessEstablishment.create(payload);

    const tagLinks = (est.tags ?? []).map(tag_id => ({
      business_establishment_id: created.businessEstablishment_id,
      tag_id,
    }));
    if (tagLinks.length) {
      await EstablishmentTag.insertMany(tagLinks);
    }

    console.log(`Inserted: ${created.name}`);
  }
}

async function seedFeedback() {
  for (const bundle of FEEDBACK_SEED) {
    const est = await BusinessEstablishment.findOne({
      name: bundle.establishment,
      business_establishment_profile_id: OWNER_PROFILE_ID,
    }).lean();
    if (!est) {
      console.warn(`Cannot seed feedback. Establishment not found: ${bundle.establishment}`);
      continue;
    }

    for (const entry of bundle.entries) {
      const exists = await Feedback.findOne({
        tourist_profile_id: entry.tourist_profile_id,
        itinerary_id: entry.itinerary_id,
        business_establishment_id: est.businessEstablishment_id,
      }).lean();
      if (exists) {
        console.log(
          `Skipping existing feedback ${entry.tourist_profile_id} for ${bundle.establishment}`,
        );
        continue;
      }

      await Feedback.create({
        ...entry,
        business_establishment_id: est.businessEstablishment_id,
      });
      console.log(`Seeded feedback for ${bundle.establishment} (${entry.tourist_profile_id})`);
    }
  }
}

async function seedTravelHistory() {
  const profile = await TouristProfile.findOne({
    tourist_profile_id: TRAVEL_HISTORY_SEED.tourist_profile_id,
    account_id: TRAVEL_HISTORY_SEED.account_id,
  }).lean();

  if (!profile) {
    console.warn(
      `Tourist profile ${TRAVEL_HISTORY_SEED.tourist_profile_id} (account ${TRAVEL_HISTORY_SEED.account_id}) not found. Skipping travel history seed.`,
    );
    return;
  }

  for (const trip of TRAVEL_HISTORY_SEED.trips) {
    const exists = await Itinerary.findOne({
      tourist_profile_id: profile.tourist_profile_id,
      title: trip.title,
    }).lean();

    if (exists) {
      console.log(`Skipping existing itinerary "${trip.title}"`);
      continue;
    }

    const stopDocs = [];
    for (let order = 0; order < trip.establishments.length; order += 1) {
      const establishmentName = trip.establishments[order];
      const est = await BusinessEstablishment.findOne({
        name: establishmentName,
        business_establishment_profile_id: OWNER_PROFILE_ID,
      }).lean();
      if (!est) {
        console.warn(`Skipping stop "${establishmentName}" (not found).`);
        continue;
      }
      stopDocs.push({
        order: order + 1,
        business_establishment_id: est.businessEstablishment_id,
        title: est.name,
        municipality: est.municipality_id,
        latitude: est.latitude,
        longitude: est.longitude,
      });
    }

    if (!stopDocs.length) {
      console.warn(`No valid stops for "${trip.title}". Skipping itinerary.`);
      continue;
    }

    const routeGeometry = stopDocs
      .map(stop =>
        typeof stop.latitude === 'number' && typeof stop.longitude === 'number'
          ? { latitude: stop.latitude, longitude: stop.longitude }
          : null,
      )
      .filter(Boolean);

    await Itinerary.create({
      tourist_profile_id: profile.tourist_profile_id,
      title: trip.title,
      start_date: new Date(trip.start_date),
      end_date: new Date(trip.end_date),
      total_budget: trip.total_budget,
      stops: stopDocs,
      route_geometry: routeGeometry,
      summary: trip.summary,
      origin: routeGeometry[0] ?? null,
      status: 'Completed',
    });

    console.log(`Seeded itinerary "${trip.title}" for ${profile.full_name}`);
  }
}

async function run() {
  await connectDB();
  try {
    await ensureTags();
    await seedEstablishments();
    await seedFeedback();
    await seedTravelHistory();
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(err => {
  console.error(err);
  mongoose.disconnect();
});