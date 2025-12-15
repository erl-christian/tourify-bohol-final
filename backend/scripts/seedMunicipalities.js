// backend/scripts/seedMunicipalities.js
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import mongoose from 'mongoose';
import Municipality from '../src/models/Municipality.js';

const MUNICIPALITIES = [
  { municipality_id: 'ALBU-001', name: 'Alburquerque', latitude: 9.6025, longitude: 123.9785 },
  { municipality_id: 'ALIC-001', name: 'Alicia', latitude: 9.8919, longitude: 124.4940 },
  { municipality_id: 'ANDA-001', name: 'Anda', latitude: 9.7544, longitude: 124.5748 },
  { municipality_id: 'ANTE-001', name: 'Antequera', latitude: 9.7616, longitude: 123.8799 },
  { municipality_id: 'BACL-001', name: 'Baclayon', latitude: 9.6263, longitude: 123.9134 },
  { municipality_id: 'BALI-001', name: 'Balilihan', latitude: 9.7587, longitude: 123.9717 },
  { municipality_id: 'BATU-001', name: 'Batuan', latitude: 9.7724, longitude: 124.1180 },
  { municipality_id: 'BIEN-001', name: 'Bien Unido', latitude: 10.1421, longitude: 124.3785 },
  { municipality_id: 'BILA-001', name: 'Bilar', latitude: 9.7020, longitude: 124.1139 },
  { municipality_id: 'BUEN-001', name: 'Buenavista', latitude: 10.0630, longitude: 124.1518 },
  { municipality_id: 'CALA-001', name: 'Calape', latitude: 9.8852, longitude: 123.8793 },
  { municipality_id: 'CAND-001', name: 'Candijay', latitude: 9.8199, longitude: 124.5112 },
  { municipality_id: 'CARM-001', name: 'Carmen', latitude: 9.8213, longitude: 124.2004 },
  { municipality_id: 'CATI-001', name: 'Catigbian', latitude: 9.8560, longitude: 124.0117 },
  { municipality_id: 'CLAR-001', name: 'Clarin', latitude: 9.9607, longitude: 124.0175 },
  { municipality_id: 'CORE-001', name: 'Corella', latitude: 9.6799, longitude: 123.9169 },
  { municipality_id: 'CORT-001', name: 'Cortes', latitude: 9.6869, longitude: 123.8637 },
  { municipality_id: 'DAGO-001', name: 'Dagohoy', latitude: 9.9380, longitude: 124.2870 },
  { municipality_id: 'DANA-001', name: 'Danao', latitude: 9.9569, longitude: 124.1972 },
  { municipality_id: 'DAUI-001', name: 'Dauis', latitude: 9.6176, longitude: 123.8704 },
  { municipality_id: 'DIMI-001', name: 'Dimiao', latitude: 9.6182, longitude: 124.1437 },
  { municipality_id: 'DUER-001', name: 'Duero', latitude: 9.7074, longitude: 124.3909 },
  { municipality_id: 'GARC-001', name: 'Garcia Hernandez', latitude: 9.6426, longitude: 124.2883 },
  { municipality_id: 'GETA-001', name: 'Getafe', latitude: 10.1505, longitude: 124.1525 },
  { municipality_id: 'GUIN-001', name: 'Guindulman', latitude: 9.7602, longitude: 124.4880 },
  { municipality_id: 'INAB-001', name: 'Inabanga', latitude: 10.0369, longitude: 124.0751 },
  { municipality_id: 'JAGN-001', name: 'Jagna', latitude: 9.6538, longitude: 124.3673 },
  { municipality_id: 'LILA-001', name: 'Lila', latitude: 9.5946, longitude: 124.1067 },
  { municipality_id: 'LOAY-001', name: 'Loay', latitude: 9.6065, longitude: 124.0110 },
  { municipality_id: 'LOBO-001', name: 'Loboc', latitude: 9.6359, longitude: 124.0429 },
  { municipality_id: 'LOON-001', name: 'Loon', latitude: 9.7999, longitude: 123.7925 },
  { municipality_id: 'MABI-001', name: 'Mabini', latitude: 9.9518, longitude: 124.5027 },
  { municipality_id: 'MARI-001', name: 'Maribojoc', latitude: 9.7530, longitude: 123.8412 },
  { municipality_id: 'PANG-001', name: 'Panglao', latitude: 9.5880, longitude: 123.7457 },
  { municipality_id: 'PILA-001', name: 'Pilar', latitude: 9.8295, longitude: 124.3450 },
  { municipality_id: 'PCPG-001', name: 'President Carlos P. Garcia', latitude: 9.7898, longitude: 124.5669 },
  { municipality_id: 'SAGB-001', name: 'Sagbayan', latitude: 9.9016, longitude: 124.1147 },
  { municipality_id: 'SANI-001', name: 'San Isidro', latitude: 9.9039, longitude: 124.0233 },
  { municipality_id: 'SANM-001', name: 'San Miguel', latitude: 9.9502, longitude: 124.4243 },
  { municipality_id: 'SEVI-001', name: 'Sevilla', latitude: 9.7054, longitude: 124.0346 },
  { municipality_id: 'SIER-001', name: 'Sierra Bullones', latitude: 9.8066, longitude: 124.2794 },
  { municipality_id: 'SIKA-001', name: 'Sikatuna', latitude: 9.7088, longitude: 123.9713 },
  { municipality_id: 'TAGB-003', name: 'Tagbilaran City', latitude: 9.6512, longitude: 123.8587 },
  { municipality_id: 'TALI-001', name: 'Talibon', latitude: 10.1022, longitude: 124.2370 },
  { municipality_id: 'TRIN-001', name: 'Trinidad', latitude: 10.0580, longitude: 124.3439 },
  { municipality_id: 'TUBI-001', name: 'Tubigon', latitude: 9.9549, longitude: 123.9521 },
  { municipality_id: 'UBAY-001', name: 'Ubay', latitude: 10.0459, longitude: 124.4722 },
  { municipality_id: 'VALE-001', name: 'Valencia', latitude: 9.6348, longitude: 124.2045 },
];

async function seedMunicipalities() {
  for (const muni of MUNICIPALITIES) {
    const doc = await Municipality.findOneAndUpdate(
      { municipality_id: muni.municipality_id },
      { $set: { name: muni.name, latitude: muni.latitude, longitude: muni.longitude } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    console.log(`Upserted ${doc.municipality_id} – ${doc.name}`);
  }
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    await seedMunicipalities();
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
