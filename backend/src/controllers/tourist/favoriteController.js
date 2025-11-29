import Favorite from "../../models/tourist/Favorite.js";
import TouristProfile from "../../models/tourist/TouristProfile.js";
import BusinessEstablishment from "../../models/businessEstablishmentModels/BusinessEstablishment.js";

// helper
async function getTouristProfile(account_id) {
  const t = await TouristProfile.findOne({ account_id });
  if (!t) {
    const err = new Error("Tourist profile not found");
    err.status = 404;
    throw err;
  }
  return t;
}

// POST /api/tourist/favorites
// body: { business_establishment_id }
export const addFavorite = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) { res.status(401); throw new Error("Unauthorized"); }

    const tourist = await getTouristProfile(account_id);
    const { business_establishment_id } = req.body;
    if (!business_establishment_id) {
      res.status(400); throw new Error("business_establishment_id is required");
    }

    // ensure establishment exists & approved
    const est = await BusinessEstablishment.findOne({
      businessEstablishment_id: business_establishment_id,
      status: "approved"
    });
    if (!est) { res.status(404); throw new Error("Establishment not found or not approved"); }

    const fav = await Favorite.create({
      tourist_profile_id: tourist.tourist_profile_id,
      business_establishment_id
    });

    res.status(201).json({ message: "Added to favorites", favorite: fav });
  } catch (e) {
    if (e?.code === 11000) {
      // already added — idempotent response
      return res.status(200).json({ message: "Already in favorites" });
    }
    next(e);
  }
};

// GET /api/tourist/favorites?page=&pageSize=
export const listFavorites = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) { res.status(401); throw new Error("Unauthorized"); }
    const tourist = await getTouristProfile(account_id);

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.max(1, Number(req.query.pageSize) || 20);
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      Favorite.find({ tourist_profile_id: tourist.tourist_profile_id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Favorite.countDocuments({ tourist_profile_id: tourist.tourist_profile_id })
    ]);

    res.json({
      page, pageSize, total, pages: Math.ceil(total / pageSize), items
    });
  } catch (e) { next(e); }
};

// DELETE /api/tourist/favorites/:estId
export const removeFavorite = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) { res.status(401); throw new Error("Unauthorized"); }
    const tourist = await getTouristProfile(account_id);

    const { estId } = req.params;
    const del = await Favorite.findOneAndDelete({
      tourist_profile_id: tourist.tourist_profile_id,
      business_establishment_id: estId
    });

    if (!del) return res.status(404).json({ message: "Favorite not found" });
    res.json({ message: "Removed from favorites" });
  } catch (e) { next(e); }
};
