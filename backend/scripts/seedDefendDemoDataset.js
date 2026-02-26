// backend/scripts/seedDefendDemoDataset.js
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
import Municipality from '../src/models/Municipality.js';

const SEED_ID = process.env.DEFEND_SEED_ID || 'defend-demo-v1';
const DEFAULT_PASSWORD = process.env.DEFEND_SEED_PASSWORD || 'Defend@123';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_DIR = path.join(__dirname, '.seed-state');
const STATE_PATH = path.join(STATE_DIR, `${SEED_ID}.json`);
const LATEST_PATH = path.join(STATE_DIR, 'latest-defend-demo.json');

const COUNTER_KEYS = {
  adminStaff: 'admin_staff_profile',
  ownerProfile: 'business_establishment_profile',
  establishment: 'businessEstablishment',
  approval: 'establishmentApproval',
};

const FALLBACK_MUNICIPALITY_COORDS = {
  'TAGB-003': { name: 'Tagbilaran City', latitude: 9.6512, longitude: 123.8587 },
  'PANG-001': { name: 'Panglao', latitude: 9.588, longitude: 123.7457 },
  'BACL-001': { name: 'Baclayon', latitude: 9.6263, longitude: 123.9134 },
  'LOBO-001': { name: 'Loboc', latitude: 9.6359, longitude: 124.0429 },
  'CARM-001': { name: 'Carmen', latitude: 9.8213, longitude: 124.2004 },
  'ANDA-001': { name: 'Anda', latitude: 9.7544, longitude: 124.5748 },
  'DAUI-001': { name: 'Dauis', latitude: 9.6176, longitude: 123.8704 },
  'JAGN-001': { name: 'Jagna', latitude: 9.6538, longitude: 124.3673 },
  'UBAY-001': { name: 'Ubay', latitude: 10.0459, longitude: 124.4722 },
  'TUBI-001': { name: 'Tubigon', latitude: 9.9549, longitude: 123.9521 },
  'LOON-001': { name: 'Loon', latitude: 9.7999, longitude: 123.7925 },
  'ALBU-001': { name: 'Alburquerque', latitude: 9.6025, longitude: 123.9785 },
};

const ESTABLISHMENTS = [
  {
    slug: 'tagbilaran-heritage-food-hub',
    name: 'Tagbilaran Heritage Food Hub',
    municipality_id: 'TAGB-003',
    type: 'restaurant',
    address: 'C. P. Garcia Avenue, Tagbilaran City, Bohol',
    description: 'Local cuisine hall with weekend acoustic nights and curated Boholano dishes.',
    budget_min: 250,
    budget_max: 1200,
    contact_info: '0917-100-0001',
    lat_offset: 0.0021,
    lng_offset: -0.0014,
  },
  {
    slug: 'tagbilaran-riverfront-stay',
    name: 'Tagbilaran Riverfront Stay',
    municipality_id: 'TAGB-003',
    type: 'accommodation',
    address: 'Carlos P. Garcia North Ave, Tagbilaran City, Bohol',
    description: 'Mid-range city hotel near terminal and port with business-friendly amenities.',
    budget_min: 1800,
    budget_max: 4500,
    contact_info: '0917-100-0002',
    lat_offset: -0.0019,
    lng_offset: 0.0011,
  },
  {
    slug: 'tagbilaran-culture-walk',
    name: 'Tagbilaran Culture Walk Center',
    municipality_id: 'TAGB-003',
    type: 'attraction',
    address: 'Rajah Sikatuna Avenue, Tagbilaran City, Bohol',
    description: 'Interactive visitor center featuring local history, crafts, and walking maps.',
    budget_min: 80,
    budget_max: 300,
    contact_info: '0917-100-0003',
    lat_offset: 0.0012,
    lng_offset: 0.0015,
  },
  {
    slug: 'island-gateway-lounge',
    name: 'Island Gateway Transport Lounge',
    municipality_id: 'TAGB-003',
    type: 'transport',
    address: 'Port Area, Tagbilaran City, Bohol',
    description: 'Tour assistance desk, baggage service, and onward transport booking point.',
    budget_min: 50,
    budget_max: 500,
    contact_info: '0917-100-0004',
    lat_offset: -0.0022,
    lng_offset: -0.0018,
  },
  {
    slug: 'panglao-coral-dive-center',
    name: 'Panglao Coral Dive Center',
    municipality_id: 'PANG-001',
    type: 'tour',
    address: 'Alona Beach Road, Panglao, Bohol',
    description: 'Certified dive school offering beginner to advanced reef dives.',
    budget_min: 1500,
    budget_max: 6500,
    contact_info: '0917-200-0001',
    lat_offset: 0.0017,
    lng_offset: -0.0016,
  },
  {
    slug: 'alona-sunset-bistro',
    name: 'Alona Sunset Bistro',
    municipality_id: 'PANG-001',
    type: 'restaurant',
    address: 'Alona Beach Front, Panglao, Bohol',
    description: 'Sunset-facing seafood grill with live band nights and family platters.',
    budget_min: 350,
    budget_max: 2200,
    contact_info: '0917-200-0002',
    lat_offset: -0.0013,
    lng_offset: 0.0013,
  },
  {
    slug: 'panglao-marine-adventure-park',
    name: 'Panglao Marine Adventure Park',
    municipality_id: 'PANG-001',
    type: 'attraction',
    address: 'Danao Coastal Road, Panglao, Bohol',
    description: 'Marine-themed activity park with guided coastal experiences.',
    budget_min: 200,
    budget_max: 1500,
    contact_info: '0917-200-0003',
    lat_offset: 0.0025,
    lng_offset: 0.0008,
  },
  {
    slug: 'panglao-seaside-suites',
    name: 'Panglao Seaside Suites',
    municipality_id: 'PANG-001',
    type: 'accommodation',
    address: 'Purok 5, Panglao, Bohol',
    description: 'Boutique suites with island-hopping concierge and airport transfers.',
    budget_min: 2500,
    budget_max: 7800,
    contact_info: '0917-200-0004',
    lat_offset: -0.0021,
    lng_offset: -0.0012,
  },
  {
    slug: 'baclayon-heritage-chapel-tour',
    name: 'Baclayon Heritage Chapel Tour Base',
    municipality_id: 'BACL-001',
    type: 'attraction',
    address: 'Church Complex Road, Baclayon, Bohol',
    description: 'Guided heritage tour jump-off with museum and old-town walking trail.',
    budget_min: 100,
    budget_max: 400,
    contact_info: '0917-300-0001',
    lat_offset: 0.0014,
    lng_offset: -0.0011,
  },
  {
    slug: 'baclayon-craft-house',
    name: 'Baclayon Craft and Pasalubong House',
    municipality_id: 'BACL-001',
    type: 'shop',
    address: 'Poblacion Market Street, Baclayon, Bohol',
    description: 'Local handicraft and delicacy center showcasing community products.',
    budget_min: 120,
    budget_max: 3000,
    contact_info: '0917-300-0002',
    lat_offset: -0.0015,
    lng_offset: 0.0016,
  },
  {
    slug: 'baclayon-riverside-cafe',
    name: 'Baclayon Riverside Cafe',
    municipality_id: 'BACL-001',
    type: 'restaurant',
    address: 'Riverside Road, Baclayon, Bohol',
    description: 'All-day cafe with local coffee, pastries, and river view seating.',
    budget_min: 180,
    budget_max: 1200,
    contact_info: '0917-300-0003',
    lat_offset: 0.002,
    lng_offset: 0.001,
  },
  {
    slug: 'loboc-floating-lunch-wharf',
    name: 'Loboc Floating Lunch Wharf',
    municipality_id: 'LOBO-001',
    type: 'tour',
    address: 'Loboc River Port, Loboc, Bohol',
    description: 'Floating lunch cruise boarding point with cultural performances.',
    budget_min: 450,
    budget_max: 1800,
    contact_info: '0917-400-0001',
    lat_offset: 0.0019,
    lng_offset: -0.0013,
  },
  {
    slug: 'loboc-eco-zip-camp',
    name: 'Loboc Eco Zip Camp',
    municipality_id: 'LOBO-001',
    type: 'adventure',
    address: 'Busay Hills, Loboc, Bohol',
    description: 'Zipline and light trekking camp with safety-guided activities.',
    budget_min: 250,
    budget_max: 1700,
    contact_info: '0917-400-0002',
    lat_offset: -0.002,
    lng_offset: 0.0014,
  },
  {
    slug: 'carmen-chocolate-view-deck',
    name: 'Carmen Chocolate View Deck',
    municipality_id: 'CARM-001',
    type: 'attraction',
    address: 'Chocolate Hills Access Rd, Carmen, Bohol',
    description: 'Scenic deck and interpretation center for Chocolate Hills visitors.',
    budget_min: 100,
    budget_max: 600,
    contact_info: '0917-500-0001',
    lat_offset: 0.0018,
    lng_offset: -0.001,
  },
  {
    slug: 'carmen-atv-trail-base',
    name: 'Carmen ATV Trail Base',
    municipality_id: 'CARM-001',
    type: 'adventure',
    address: 'Hillside Route 2, Carmen, Bohol',
    description: 'ATV and off-road adventure booking station with helmet rental.',
    budget_min: 900,
    budget_max: 3200,
    contact_info: '0917-500-0002',
    lat_offset: -0.0017,
    lng_offset: 0.0012,
  },
  {
    slug: 'anda-white-beach-camp',
    name: 'Anda White Beach Camp',
    municipality_id: 'ANDA-001',
    type: 'accommodation',
    address: 'Quinale Beach Road, Anda, Bohol',
    description: 'Beachfront cabins with snorkeling and sunrise tour packages.',
    budget_min: 1500,
    budget_max: 5200,
    contact_info: '0917-600-0001',
    lat_offset: 0.0016,
    lng_offset: -0.0014,
  },
  {
    slug: 'anda-cliffside-cafe',
    name: 'Anda Cliffside Cafe',
    municipality_id: 'ANDA-001',
    type: 'restaurant',
    address: 'East Coast Viewpoint, Anda, Bohol',
    description: 'Cliff-view cafe specializing in seafood bowls and local desserts.',
    budget_min: 220,
    budget_max: 1600,
    contact_info: '0917-600-0002',
    lat_offset: -0.0014,
    lng_offset: 0.0012,
  },
  {
    slug: 'dauis-churchfront-gallery',
    name: 'Dauis Churchfront Gallery',
    municipality_id: 'DAUI-001',
    type: 'attraction',
    address: 'Poblacion Plaza, Dauis, Bohol',
    description: 'Small gallery and cultural exhibit hub near historic church grounds.',
    budget_min: 70,
    budget_max: 350,
    contact_info: '0917-700-0001',
    lat_offset: 0.0011,
    lng_offset: -0.0015,
  },
  {
    slug: 'dauis-mangrove-paddle',
    name: 'Dauis Mangrove Paddle Spot',
    municipality_id: 'DAUI-001',
    type: 'tour',
    address: 'Mangrove Channel, Dauis, Bohol',
    description: 'Kayak and paddle board guided tours through mangrove channels.',
    budget_min: 350,
    budget_max: 2100,
    contact_info: '0917-700-0002',
    lat_offset: -0.0012,
    lng_offset: 0.0011,
  },
  {
    slug: 'jagna-portside-grill',
    name: 'Jagna Portside Seafood Grill',
    municipality_id: 'JAGN-001',
    type: 'restaurant',
    address: 'Port District, Jagna, Bohol',
    description: 'Seafood grill and market-style dining close to Jagna port.',
    budget_min: 300,
    budget_max: 2000,
    contact_info: '0917-800-0001',
    lat_offset: 0.0015,
    lng_offset: -0.0012,
  },
  {
    slug: 'jagna-heritage-homestay',
    name: 'Jagna Heritage Homestay',
    municipality_id: 'JAGN-001',
    type: 'accommodation',
    address: 'Old Town Quarter, Jagna, Bohol',
    description: 'Family-run heritage home with guided local community tours.',
    budget_min: 1300,
    budget_max: 3800,
    contact_info: '0917-800-0002',
    lat_offset: -0.0013,
    lng_offset: 0.0014,
  },
  {
    slug: 'ubay-farm-market-village',
    name: 'Ubay Farm and Market Village',
    municipality_id: 'UBAY-001',
    type: 'attraction',
    address: 'Agri Zone Road, Ubay, Bohol',
    description: 'Farm tourism site with produce market and educational tours.',
    budget_min: 120,
    budget_max: 1200,
    contact_info: '0917-900-0001',
    lat_offset: 0.0018,
    lng_offset: -0.0011,
  },
  {
    slug: 'tubigon-boardwalk-hub',
    name: 'Tubigon Bay Boardwalk Hub',
    municipality_id: 'TUBI-001',
    type: 'attraction',
    address: 'Baywalk Area, Tubigon, Bohol',
    description: 'Boardwalk visitor hub with food kiosks and sunset viewing deck.',
    budget_min: 80,
    budget_max: 800,
    contact_info: '0917-910-0001',
    lat_offset: -0.0016,
    lng_offset: 0.0012,
  },
  {
    slug: 'loon-cliff-view-deck',
    name: 'Loon Cliff View Deck',
    municipality_id: 'LOON-001',
    type: 'attraction',
    address: 'North Ridge Road, Loon, Bohol',
    description: 'Scenic cliffside viewpoint with rest area and local snack stalls.',
    budget_min: 60,
    budget_max: 500,
    contact_info: '0917-920-0001',
    lat_offset: 0.0012,
    lng_offset: -0.0013,
  },
];

const state = {
  seedId: SEED_ID,
  createdAt: new Date().toISOString(),
  defaultPassword: DEFAULT_PASSWORD,
  created: {
    accountIds: [],
    adminProfileIds: [],
    ownerProfileIds: [],
    establishmentIds: [],
    approvalIds: [],
    mediaIds: [],
  },
  credentials: {
    lgu_admins: [],
    lgu_staffs: [],
    owners: [],
  },
  counterSnapshot: {},
  counterDeltas: {},
};

function seededPhotoUrl(slug) {
  return `https://picsum.photos/seed/${encodeURIComponent(`${SEED_ID}-${slug}`)}/1280/720`;
}

function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getAccountCounterKey() {
  return dateKey();
}

function getMediaCounterKey() {
  return `media_${dateKey()}`;
}

function toEmailToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mergeUnique(target = [], source = []) {
  const set = new Set((target || []).filter(Boolean));
  for (const item of source || []) {
    if (item) set.add(item);
  }
  return Array.from(set);
}

function mergeCredentialsByEmail(target = [], source = []) {
  const byEmail = new Map();
  for (const item of [...(target || []), ...(source || [])]) {
    if (item?.email) byEmail.set(item.email, item);
  }
  return Array.from(byEmail.values());
}

function pushUnique(arr, value) {
  if (!value) return;
  if (!arr.includes(value)) arr.push(value);
}

function pushCredentialUnique(arr, item) {
  if (!item?.email) return;
  if (!arr.some(x => x.email === item.email)) arr.push(item);
}

async function hydrateExistingState() {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf-8');
    const prev = JSON.parse(raw);

    state.created.accountIds = mergeUnique(state.created.accountIds, prev.created?.accountIds);
    state.created.adminProfileIds = mergeUnique(state.created.adminProfileIds, prev.created?.adminProfileIds);
    state.created.ownerProfileIds = mergeUnique(state.created.ownerProfileIds, prev.created?.ownerProfileIds);
    state.created.establishmentIds = mergeUnique(state.created.establishmentIds, prev.created?.establishmentIds);
    state.created.approvalIds = mergeUnique(state.created.approvalIds, prev.created?.approvalIds);
    state.created.mediaIds = mergeUnique(state.created.mediaIds, prev.created?.mediaIds);

    const prevCreds = prev.credentials || {};
    state.credentials.owners = mergeCredentialsByEmail(state.credentials.owners, prevCreds.owners || []);
    state.credentials.lgu_admins = mergeCredentialsByEmail(state.credentials.lgu_admins, prevCreds.lgu_admins || []);
    state.credentials.lgu_staffs = mergeCredentialsByEmail(state.credentials.lgu_staffs, prevCreds.lgu_staffs || []);

    if (prevCreds.lgu_admin?.email) pushCredentialUnique(state.credentials.lgu_admins, prevCreds.lgu_admin);
    if (prevCreds.lgu_staff?.email) pushCredentialUnique(state.credentials.lgu_staffs, prevCreds.lgu_staff);

    state.counterSnapshot = { ...(prev.counterSnapshot || {}) };
    state.counterDeltas = { ...(prev.counterDeltas || {}) };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[warn] Unable to load previous seed state: ${err.message}`);
    }
  }
}

async function snapshotCounter(key) {
  if (!key || Object.prototype.hasOwnProperty.call(state.counterSnapshot, key)) return;
  const doc = await Counter.findById(key).lean();
  state.counterSnapshot[key] = doc?.seq ?? 0;
}

function bumpCounterDelta(key, by = 1) {
  if (!key) return;
  state.counterDeltas[key] = (state.counterDeltas[key] || 0) + by;
}

async function ensureAccount({ email, role, password }) {
  let account = await Account.findOne({ email });
  if (account) return { account, created: false };

  const key = getAccountCounterKey();
  await snapshotCounter(key);

  account = await Account.create({
    email,
    password,
    role,
    is_active: true,
    must_change_password: false,
    email_verified: true,
    email_verified_at: new Date(),
  });

  pushUnique(state.created.accountIds, account.account_id);
  bumpCounterDelta(key);
  return { account, created: true };
}

async function ensureAdminProfile({ account, municipality_id, full_name, position }) {
  let profile = await AdminStaffProfile.findOne({ account_id: account.account_id });
  if (profile) return { profile, created: false };

  await snapshotCounter(COUNTER_KEYS.adminStaff);

  profile = await AdminStaffProfile.create({
    account_id: account.account_id,
    municipality_id,
    full_name,
    position,
  });

  pushUnique(state.created.adminProfileIds, profile.admin_staff_profile_id);
  bumpCounterDelta(COUNTER_KEYS.adminStaff);
  return { profile, created: true };
}

async function ensureOwnerProfile({ account, municipality_id, full_name, contact_no }) {
  let profile = await BusinessEstablishmentProfile.findOne({ account_id: account.account_id });
  if (profile) return { profile, created: false };

  await snapshotCounter(COUNTER_KEYS.ownerProfile);

  profile = await BusinessEstablishmentProfile.create({
    account_id: account.account_id,
    municipality_id,
    full_name,
    role: 'Owner',
    contact_no,
  });

  pushUnique(state.created.ownerProfileIds, profile.business_establishment_profile_id);
  bumpCounterDelta(COUNTER_KEYS.ownerProfile);
  return { profile, created: true };
}

function resolveCoordinates({ municipality_id, municipalityDoc, lat_offset, lng_offset }) {
  const fallback = FALLBACK_MUNICIPALITY_COORDS[municipality_id];
  const baseLat = Number.isFinite(municipalityDoc?.latitude)
    ? municipalityDoc.latitude
    : Number.isFinite(fallback?.latitude)
      ? fallback.latitude
      : null;
  const baseLng = Number.isFinite(municipalityDoc?.longitude)
    ? municipalityDoc.longitude
    : Number.isFinite(fallback?.longitude)
      ? fallback.longitude
      : null;

  if (baseLat === null || baseLng === null) {
    return { latitude: null, longitude: null };
  }

  const latOffset = Number(lat_offset || 0);
  const lngOffset = Number(lng_offset || 0);

  return {
    latitude: Number((baseLat + latOffset).toFixed(6)),
    longitude: Number((baseLng + lngOffset).toFixed(6)),
  };
}

async function ensureLguUsersForMunicipalities(municipalities) {
  const byMunicipality = new Map();

  const uniqueMunicipalities = Array.from(
    new Map((municipalities || []).map(m => [m.municipality_id, m])).values(),
  )
    .filter(m => m?.municipality_id)
    .sort((a, b) => String(a.municipality_id).localeCompare(String(b.municipality_id)));

  for (const muni of uniqueMunicipalities) {
    const municipality_id = muni.municipality_id;
    const municipality_name = muni.name || municipality_id;
    const token = toEmailToken(municipality_id);

    const adminEmail = `${SEED_ID}.lgu.admin.${token}@tourify.local`;
    const staffEmail = `${SEED_ID}.lgu.staff.${token}@tourify.local`;

    const { account: adminAccount } = await ensureAccount({
      email: adminEmail,
      role: 'lgu_admin',
      password: DEFAULT_PASSWORD,
    });

    const { profile: adminProfile } = await ensureAdminProfile({
      account: adminAccount,
      municipality_id,
      full_name: `${municipality_name} LGU Admin`,
      position: 'LGU Admin',
    });

    const { account: staffAccount } = await ensureAccount({
      email: staffEmail,
      role: 'lgu_staff',
      password: DEFAULT_PASSWORD,
    });

    await ensureAdminProfile({
      account: staffAccount,
      municipality_id,
      full_name: `${municipality_name} LGU Staff`,
      position: 'LGU Staff',
    });

    byMunicipality.set(municipality_id, adminProfile);

    pushCredentialUnique(state.credentials.lgu_admins, {
      municipality_id,
      municipality_name,
      email: adminEmail,
      password: DEFAULT_PASSWORD,
    });

    pushCredentialUnique(state.credentials.lgu_staffs, {
      municipality_id,
      municipality_name,
      email: staffEmail,
      password: DEFAULT_PASSWORD,
    });
  }

  return byMunicipality;
}

async function ensureEstablishment({ entry, index, lguAdminByMunicipality, municipalityById }) {
  const seq = String(index + 1).padStart(3, '0');
  const accreditation_no = `DEF-${SEED_ID}-${seq}`;
  const ownerEmail = `${SEED_ID}.owner.${seq}@tourify.local`;

  const municipalityDoc = municipalityById.get(entry.municipality_id);
  if (!municipalityDoc) {
    console.warn(`[skip] Municipality not found: ${entry.municipality_id} (${entry.name})`);
    return;
  }

  const lguAdminProfile = lguAdminByMunicipality.get(entry.municipality_id);
  if (!lguAdminProfile) {
    console.warn(`[skip] No LGU admin profile for municipality: ${entry.municipality_id} (${entry.name})`);
    return;
  }

  const { account: ownerAccount } = await ensureAccount({
    email: ownerEmail,
    role: 'business_establishment',
    password: DEFAULT_PASSWORD,
  });

  pushCredentialUnique(state.credentials.owners, {
    email: ownerEmail,
    password: DEFAULT_PASSWORD,
    establishment: entry.name,
    municipality_id: entry.municipality_id,
  });

  const { profile: ownerProfile } = await ensureOwnerProfile({
    account: ownerAccount,
    municipality_id: entry.municipality_id,
    full_name: `${entry.name} Owner`,
    contact_no: entry.contact_info,
  });

  let establishment = await BusinessEstablishment.findOne({ accreditation_no });
  if (!establishment) {
    const coords = resolveCoordinates({
      municipality_id: entry.municipality_id,
      municipalityDoc,
      lat_offset: entry.lat_offset,
      lng_offset: entry.lng_offset,
    });

    await snapshotCounter(COUNTER_KEYS.establishment);

    establishment = await BusinessEstablishment.create({
      municipality_id: entry.municipality_id,
      business_establishment_profile_id: ownerProfile.business_establishment_profile_id,
      name: entry.name,
      type: entry.type,
      address: entry.address,
      description: entry.description,
      contact_info: entry.contact_info,
      accreditation_no,
      budget_min: entry.budget_min,
      budget_max: entry.budget_max,
      status: 'approved',
      ownership_type: 'private',
      created_by_adminStaffProfile_id: lguAdminProfile.admin_staff_profile_id,
      latitude: coords.latitude,
      longitude: coords.longitude,
      qr_code: `seed:${SEED_ID}:${entry.slug}`,
      rating_count: 0,
      rating_avg: 0,
    });

    pushUnique(state.created.establishmentIds, establishment.businessEstablishment_id);
    bumpCounterDelta(COUNTER_KEYS.establishment);
  }

  let approval = await EstablishmentApproval.findOne({
    businessEstablishment_id: establishment.businessEstablishment_id,
    is_latest: true,
  });

  if (!approval) {
    await snapshotCounter(COUNTER_KEYS.approval);

    approval = await EstablishmentApproval.create({
      approval_status: 'approved',
      action: 'approve',
      remarks: `[seed:${SEED_ID}] Approved by seed script`,
      action_date: new Date(),
      is_latest: true,
      businessEstablishment_id: establishment.businessEstablishment_id,
      admin_staff_profile_id: lguAdminProfile.admin_staff_profile_id,
    });

    pushUnique(state.created.approvalIds, approval.establishment_approval_id);
    bumpCounterDelta(COUNTER_KEYS.approval);

    await BusinessEstablishment.updateOne(
      { businessEstablishment_id: establishment.businessEstablishment_id },
      {
        $set: {
          businessEstablishment_approval_id: approval.establishment_approval_id,
          status: 'approved',
          created_by_adminStaffProfile_id: lguAdminProfile.admin_staff_profile_id,
        },
      },
    );
  }

  const mediaCaption = `[seed:${SEED_ID}] ${entry.name} cover`;
  const existingMedia = await Media.findOne({
    business_establishment_id: establishment.businessEstablishment_id,
    caption: mediaCaption,
  });

  if (!existingMedia) {
    const mediaCounterKey = getMediaCounterKey();
    await snapshotCounter(mediaCounterKey);

    const media = await Media.create({
      account_id: ownerAccount.account_id,
      business_establishment_id: establishment.businessEstablishment_id,
      file_url: seededPhotoUrl(entry.slug),
      file_type: 'image',
      media_kind: 'spot_gallery',
      original_name: `${entry.slug}.jpg`,
      mime_type: 'image/jpeg',
      caption: mediaCaption,
      uploaded_by: ownerAccount.account_id,
      public_id: `seed/${SEED_ID}/${entry.slug}`,
    });

    pushUnique(state.created.mediaIds, media.media_id);
    bumpCounterDelta(mediaCounterKey);
  }

  console.log(`[ok] ${entry.name} (${entry.municipality_id})`);
}

async function saveState() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  await fs.writeFile(LATEST_PATH, JSON.stringify({ seedId: SEED_ID, statePath: STATE_PATH }, null, 2), 'utf-8');
}

async function run() {
  await connectDB();
  try {
    await hydrateExistingState();

    const municipalities = await Municipality.find(
      {},
      { _id: 0, municipality_id: 1, name: 1, latitude: 1, longitude: 1 },
    ).lean();

    if (!municipalities.length) {
      throw new Error('No municipalities found. Seed municipalities first.');
    }

    const municipalityById = new Map(municipalities.map(m => [m.municipality_id, m]));
    const lguAdminByMunicipality = await ensureLguUsersForMunicipalities(municipalities);

    for (let i = 0; i < ESTABLISHMENTS.length; i += 1) {
      await ensureEstablishment({
        entry: ESTABLISHMENTS[i],
        index: i,
        lguAdminByMunicipality,
        municipalityById,
      });
    }

    await saveState();

    console.log('\nSeed complete');
    console.log(`Seed ID: ${SEED_ID}`);
    console.log(`LGU Admin accounts ensured: ${state.credentials.lgu_admins.length}`);
    console.log(`LGU Staff accounts ensured: ${state.credentials.lgu_staffs.length}`);
    console.log(`Owner accounts ensured: ${state.credentials.owners.length}`);
    console.log(`State file: ${STATE_PATH}`);
    console.log(`Establishments created/ensured: ${ESTABLISHMENTS.length}`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
