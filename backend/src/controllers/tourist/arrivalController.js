import TouristArrival from "../../models/tourist/TouristArrival.js";
import TouristProfile from "../../models/tourist/TouristProfile.js";

const ENTRY_POINT_TYPES = new Set(["airport", "seaport", "landport", "other"]);

const normalizeEntryType = value => {
  const key = String(value ?? "other").trim().toLowerCase();
  return ENTRY_POINT_TYPES.has(key) ? key : "other";
};

const resolveTouristProfile = async accountId => {
  if (!accountId) return null;
  return TouristProfile.findOne({ account_id: accountId }).lean();
};

// POST /api/public/arrivals/scan
export const scanTouristArrival = async (req, res, next) => {
  try {
    const { entry_point_type, entry_point_name, qr_code_id, session_id, scanned_at } = req.body;

    if (!qr_code_id || !session_id) {
      res.status(400);
      throw new Error("qr_code_id and session_id are required");
    }

    const accountId = req.user?.account_id ?? null;
    const tourist = await resolveTouristProfile(accountId);

    const doc = await TouristArrival.create({
      entry_point_type: normalizeEntryType(entry_point_type),
      entry_point_name: String(entry_point_name ?? "").trim(),
      qr_code_id: String(qr_code_id).trim(),
      session_id: String(session_id).trim(),
      scanned_at: scanned_at ? new Date(scanned_at) : new Date(),
      account_id: accountId || undefined,
      tourist_profile_id: tourist?.tourist_profile_id || undefined,
      linked_at: accountId ? new Date() : null,
      source: "arrival_qr",
    });

    res.status(201).json({
      message: "Arrival recorded",
      arrival: doc,
      linked: Boolean(accountId),
      requires_profile: Boolean(accountId && !tourist),
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/tourist/arrivals/link
export const linkTouristArrivalSession = async (req, res, next) => {
  try {
    const accountId = req.user?.account_id;
    if (!accountId) {
      res.status(401);
      throw new Error("Unauthorized");
    }

    const { session_id } = req.body;
    if (!session_id) {
      res.status(400);
      throw new Error("session_id is required");
    }

    const tourist = await resolveTouristProfile(accountId);
    const now = new Date();

    const update = {
      account_id: accountId,
      linked_at: now,
    };
    if (tourist?.tourist_profile_id) {
      update.tourist_profile_id = tourist.tourist_profile_id;
    }

    const result = await TouristArrival.updateMany(
      { session_id: String(session_id).trim() },
      { $set: update }
    );

    res.json({
      message: "Arrival session linked",
      matched: result.matchedCount ?? 0,
      modified: result.modifiedCount ?? 0,
      linked_to_profile: Boolean(tourist?.tourist_profile_id),
    });
  } catch (err) {
    next(err);
  }
};
