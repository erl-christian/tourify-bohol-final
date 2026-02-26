// backend/scripts/undoDefendDemoDataset.js
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

import { connectDB } from '../src/config/database.js';
import Counter from '../src/models/Counter.js';
import Account from '../src/models/Account.js';
import AdminStaffProfile from '../src/models/adminModels/AdminStaffProfile.js';
import BusinessEstablishmentProfile from '../src/models/businessEstablishmentModels/BusinessEstablishmentProfile.js';
import BusinessEstablishment from '../src/models/businessEstablishmentModels/BusinessEstablishment.js';
import EstablishmentApproval from '../src/models/businessEstablishmentModels/EstablishmentApproval.js';
import Media from '../src/models/Media/Media.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_DIR = path.join(__dirname, '.seed-state');
const LATEST_PATH = path.join(STATE_DIR, 'latest-defend-demo.json');

const explicitSeedId = process.argv[2] || process.env.DEFEND_SEED_ID || null;

async function loadState() {
  if (explicitSeedId) {
    const p = path.join(STATE_DIR, `${explicitSeedId}.json`);
    const raw = await fs.readFile(p, 'utf-8');
    return { path: p, state: JSON.parse(raw) };
  }

  const latestRaw = await fs.readFile(LATEST_PATH, 'utf-8');
  const latest = JSON.parse(latestRaw);
  const raw = await fs.readFile(latest.statePath, 'utf-8');
  return { path: latest.statePath, state: JSON.parse(raw) };
}

async function safeDelete(label, model, field, ids) {
  const clean = (ids || []).filter(Boolean);
  if (!clean.length) {
    console.log(`[skip] ${label}: none`);
    return;
  }
  const result = await model.deleteMany({ [field]: { $in: clean } });
  console.log(`[ok] ${label}: ${result.deletedCount}`);
}

async function rollbackCounters(state) {
  const snapshots = state.counterSnapshot || {};
  const deltas = state.counterDeltas || {};
  const keys = Object.keys(snapshots);

  if (!keys.length) {
    console.log('[skip] Counters: no snapshot in state file');
    return;
  }

  for (const key of keys) {
    const beforeSeq = Number(snapshots[key] ?? 0);
    const delta = Number(deltas[key] ?? 0);
    const expectedCurrent = beforeSeq + delta;

    const currentDoc = await Counter.findById(key).lean();
    const currentSeq = Number(currentDoc?.seq ?? 0);

    if (currentSeq !== expectedCurrent) {
      console.warn(
        `[skip] Counter ${key}: current=${currentSeq}, expected=${expectedCurrent} (possible external writes).`,
      );
      continue;
    }

    if (beforeSeq <= 0) {
      await Counter.deleteOne({ _id: key });
      console.log(`[ok] Counter ${key}: deleted`);
    } else {
      await Counter.updateOne({ _id: key }, { $set: { seq: beforeSeq } }, { upsert: true });
      console.log(`[ok] Counter ${key}: restored to ${beforeSeq}`);
    }
  }
}

async function maybeDeleteLatestPointer(statePath, seedId) {
  try {
    const latestRaw = await fs.readFile(LATEST_PATH, 'utf-8');
    const latest = JSON.parse(latestRaw);

    if (latest?.statePath === statePath || latest?.seedId === seedId) {
      await fs.unlink(LATEST_PATH).catch(() => {});
    }
  } catch {
    // ignore
  }
}

async function run() {
  const { path: statePath, state } = await loadState();
  const seedId = state.seedId;

  await connectDB();
  try {
    await safeDelete('Media', Media, 'media_id', state.created?.mediaIds);
    await safeDelete('Approvals', EstablishmentApproval, 'establishment_approval_id', state.created?.approvalIds);
    await safeDelete('Establishments', BusinessEstablishment, 'businessEstablishment_id', state.created?.establishmentIds);
    await safeDelete('Owner profiles', BusinessEstablishmentProfile, 'business_establishment_profile_id', state.created?.ownerProfileIds);
    await safeDelete('Admin/Staff profiles', AdminStaffProfile, 'admin_staff_profile_id', state.created?.adminProfileIds);
    await safeDelete('Accounts', Account, 'account_id', state.created?.accountIds);

    await rollbackCounters(state);

    await fs.unlink(statePath).catch(() => {});
    await maybeDeleteLatestPointer(statePath, seedId);

    console.log(`\nUndo complete for seed: ${seedId}`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
