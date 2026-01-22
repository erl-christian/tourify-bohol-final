// backend/scripts/seedMunicipalities.js

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Municipality from '../src/models/Municipality.js';
import { getMongoUri } from "../src/config/dbUri.js";

const uri = getMongoUri();
if (!uri) {
  console.error("Missing Mongo URI");
  process.exit(1);
}
await mongoose.connect(uri);


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, '..', '.env'),
});

console.log("Loaded MONGO_URI:", process.env.MONGO_URI);

const MUNICIPALITIES = [
  { name: 'Alburquerque', latitude: 9.6025, longitude: 123.9785 },
  { name: 'Alicia', latitude: 9.8919, longitude: 124.4940 },
  { name: 'Anda', latitude: 9.7544, longitude: 124.5748 },
  { name: 'Antequera', latitude: 9.7616, longitude: 123.8799 },
  { name: 'Baclayon', latitude: 9.6263, longitude: 123.9134 },
  { name: 'Balilihan', latitude: 9.7587, longitude: 123.9717 },
  { name: 'Batuan', latitude: 9.7724, longitude: 124.1180 },
  { name: 'Bien Unido', latitude: 10.1421, longitude: 124.3785 },
  { name: 'Bilar', latitude: 9.7020, longitude: 124.1139 },
  { name: 'Buenavista', latitude: 10.0630, longitude: 124.1518 },
  { name: 'Calape', latitude: 9.8852, longitude: 123.8793 },
  { name: 'Candijay', latitude: 9.8199, longitude: 124.5112 },
  { name: 'Carmen', latitude: 9.8213, longitude: 124.2004 },
  { name: 'Catigbian', latitude: 9.8560, longitude: 124.0117 },
  { name: 'Clarin', latitude: 9.9607, longitude: 124.0175 },
  { name: 'Corella', latitude: 9.6799, longitude: 123.9169 },
  { name: 'Cortes', latitude: 9.6869, longitude: 123.8637 },
  { name: 'Dagohoy', latitude: 9.9380, longitude: 124.2870 },
  { name: 'Danao', latitude: 9.9569, longitude: 124.1972 },
  { name: 'Dauis', latitude: 9.6176, longitude: 123.8704 },
  { name: 'Dimiao', latitude: 9.6182, longitude: 124.1437 },
  { name: 'Duero', latitude: 9.7074, longitude: 124.3909 },
  { name: 'Garcia Hernandez', latitude: 9.6426, longitude: 124.2883 },
  { name: 'Getafe', latitude: 10.1505, longitude: 124.1525 },
  { name: 'Guindulman', latitude: 9.7602, longitude: 124.4880 },
  { name: 'Inabanga', latitude: 10.0369, longitude: 124.0751 },
  { name: 'Jagna', latitude: 9.6538, longitude: 124.3673 },
  { name: 'Lila', latitude: 9.5946, longitude: 124.1067 },
  { name: 'Loay', latitude: 9.6065, longitude: 124.0110 },
  { name: 'Loboc', latitude: 9.6359, longitude: 124.0429 },
  { name: 'Loon', latitude: 9.7999, longitude: 123.7925 },
  { name: 'Mabini', latitude: 9.9518, longitude: 124.5027 },
  { name: 'Maribojoc', latitude: 9.7530, longitude: 123.8412 },
  { name: 'Panglao', latitude: 9.5880, longitude: 123.7457 },
  { name: 'Pilar', latitude: 9.8295, longitude: 124.3450 },
  { name: 'President Carlos P. Garcia', latitude: 9.7898, longitude: 124.5669 },
  { name: 'Sagbayan', latitude: 9.9016, longitude: 124.1147 },
  { name: 'San Isidro', latitude: 9.9039, longitude: 124.0233 },
  { name: 'San Miguel', latitude: 9.9502, longitude: 124.4243 },
  { name: 'Sevilla', latitude: 9.7054, longitude: 124.0346 },
  { name: 'Sierra Bullones', latitude: 9.8066, longitude: 124.2794 },
  { name: 'Sikatuna', latitude: 9.7088, longitude: 123.9713 },
  { name: 'Tagbilaran City', latitude: 9.6512, longitude: 123.8587 },
  { name: 'Talibon', latitude: 10.1022, longitude: 124.2370 },
  { name: 'Trinidad', latitude: 10.0580, longitude: 124.3439 },
  { name: 'Tubigon', latitude: 9.9549, longitude: 123.9521 },
  { name: 'Ubay', latitude: 10.0459, longitude: 124.4722 },
  { name: 'Valencia', latitude: 9.6348, longitude: 124.2045 },
];

// Delete old prefixed IDs
async function cleanOldMunicipalities() {
  const result = await Municipality.deleteMany({
    municipality_id: { $regex: /^[A-Z]{4}-\d{3}$/ },
  });
  console.log(`🧹 Removed old prefixed IDs: ${result.deletedCount}`);
}

async function seedMunicipalities() {
  // Ensure no one has TAGB-003
  await Municipality.updateMany(
    { municipality_id: 'TAGB-003' },
    { $unset: { municipality_id: "" } }
  );

  for (const muni of MUNICIPALITIES) {
    let existing = await Municipality.findOne({ name: muni.name });

    if (existing) {
      existing.latitude = muni.latitude;
      existing.longitude = muni.longitude;

      // Special case for Tagbilaran City
      if (muni.name === 'Tagbilaran City') {
        existing.municipality_id = 'TAGB-003';
      }

      await existing.save();
      console.log(`✅ Updated ${existing.municipality_id || 'NEW'} – ${existing.name}`);
    } else {
      const newMuni = new Municipality(muni);

      // Special case for Tagbilaran City
      if (muni.name === 'Tagbilaran City') {
        newMuni.municipality_id = 'TAGB-003';
      }

      await newMuni.save();
      console.log(`➕ Created ${newMuni.municipality_id} – ${newMuni.name}`);
    }
  }
}

async function run() {
  if (!process.env.MONGO_URI) {
    console.error("❌ ERROR: MONGO_URI is missing. Check your .env file!");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    await cleanOldMunicipalities();
    await seedMunicipalities();
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
