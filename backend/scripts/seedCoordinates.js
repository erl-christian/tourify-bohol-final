import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BusinessEstablishment from '../src/models/businessEstablishmentModels/BusinessEstablishment.js';

dotenv.config({ path: '../.env' });

const coords = [
  {
    businessEstablishment_id: 'EST-9001',
    location: { type: 'Point', coordinates: [123.8486, 9.6535] }, // lng, lat
  },
  {
    businessEstablishment_id: 'EST-9002',
    location: { type: 'Point', coordinates: [123.8502, 9.6491] },
  },
  {
    businessEstablishment_id: 'EST-9003',
    location: { type: 'Point', coordinates: [123.8531, 9.6517] },
  },
  {
    businessEstablishment_id: 'EST-0010',
    location: { type: 'Point', coordinates: [124.0996, 9.8087] },
  },
  {
    businessEstablishment_id: 'EST-0012',
    location: { type: 'Point', coordinates: [124.7278, 9.7458] },
  },
  {
    businessEstablishment_id: 'EST-0013',
    location: { type: 'Point', coordinates: [123.8634, 9.5872] },
  },
  {
    businessEstablishment_id: 'EST-0014',
    location: { type: 'Point', coordinates: [123.9348, 9.6293] },
  },
  {
    businessEstablishment_id: 'EST-0009',
    location: { type: 'Point', coordinates: [123.9133, 9.6297] },
  },
  {
    businessEstablishment_id: 'EST-0002',
    location: { type: 'Point', coordinates: [123.8765, 9.6421] },
  },
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected');

    for (const { businessEstablishment_id, location } of coords) {
      const res = await BusinessEstablishment.findOneAndUpdate(
        { businessEstablishment_id },
        { $set: { location } },
        { new: true },
      );
      console.log(res ? `Updated ${businessEstablishment_id}` : `Skipped ${businessEstablishment_id}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
})();
