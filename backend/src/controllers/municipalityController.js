import Municipality from "../models/Municipality.js";

// POST /api/municipalities
export const createMunicipality = async (req, res, next ) => {
    try {
        const{ municipality_id, name, latitude, longitude} = req.body;
        if (!name) {
            res.status(400);
            throw Error("name are required");
        }
        const exists = await Municipality.findOne({ municipality_id });
        if (exists) {
            res.status(409); throw new Error("municipality_id already exists");
        }

        const doc = await Municipality.create({ municipality_id, name, latitude, longitude });
        res.status(201).json({ message: "Municipality created", municipality: doc });

    } catch (error) {
        next(error)
    }
}

// GET /api/municipalities
export const listMunicipalities = async (_req, res, next) => {
  try {
    const items = await Municipality.find().sort({ name: 1 });
    res.json({ municipalities: items });
  } catch (e) { next(e); }
};