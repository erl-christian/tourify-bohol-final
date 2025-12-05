import 'dotenv/config.js';
import mongoose from 'mongoose';
import { runSpmMining } from '../src/services/spmService.js';

async function connect() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB });
}

async function run() {
  await connect();
  const result = await runSpmMining();
  console.log('SPM mining complete:', result);
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
