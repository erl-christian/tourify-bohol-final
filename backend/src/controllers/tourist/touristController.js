import TouristProfile from "../../models/tourist/TouristProfile.js"
import { normalizeNationality } from "../../utils/nationalities.js";

const FULL_NAME_REGEX = /^[A-Za-z.\-\s]+$/;

const sanitizeFullName = value => String(value ?? "").replace(/\s+/g, " ").trim();

const assertValidFullName = fullName => {
    if (!fullName) {
        const err = new Error("full_name is required");
        err.status = 400;
        throw err;
    }
    if (!FULL_NAME_REGEX.test(fullName) || !/[A-Za-z]/.test(fullName)) {
        const err = new Error("Full name can only contain letters, spaces, periods, and hyphens");
        err.status = 400;
        throw err;
    }
};

const assertValidNationality = nationality => {
    const raw = String(nationality ?? "").replace(/\s+/g, " ").trim();
    if (!raw) {
        const err = new Error("nationality is required");
        err.status = 400;
        throw err;
    }

    const normalized = normalizeNationality(nationality);
    if (!normalized) {
        const err = new Error("Select a valid nationality from the list");
        err.status = 400;
        throw err;
    }
    return normalized;
};

//post /api/tourist/create-profile
export const createTouristProfile = async (req, res, next) => {
    try {
        const account_id = req.user?.account_id;
        if (!account_id) { res.status(401); throw new Error("Unauthorized"); }
        
        const { full_name, nickname, contact_no, nationality} = req.body;
        if (!full_name || !contact_no || !nationality) { 
            res.status(400); 
            throw new Error("full_name, contact_no, nationality are required"); 
        }

        const cleanedFullName = sanitizeFullName(full_name);
        const cleanedNationality = assertValidNationality(nationality);
        assertValidFullName(cleanedFullName);

        const exist = await TouristProfile.findOne({ account_id })
        if(exist)
        {
            res.status(409);
            throw new Error("TouristProfile already registered")
        }

        const profile = await TouristProfile.create({
            account_id,
            full_name: cleanedFullName,
            nickname: String(nickname ?? "").trim(),
            contact_no,
            nationality: cleanedNationality,
        });

        res.status(201).json({ message: "Tourist Profile created", profile})


    } catch (error) {
        next(error);
    }
}

//get /api/tourist/profile
export const getMyTouristProfile = async (req, res, next) => {
    try {
        const account_id = req.user?.account_id;
        if (!account_id) { 
            res.status(401); throw new Error("Unauthorized"); 
        }

        const profile = await TouristProfile.findOne({ account_id });
        if (!profile) { res.status(404); throw new Error("Tourist profile not found"); }

        res.json({ profile })

    } catch (error) {
        next(error);
    }
}

//patch /api/tourist/update-profile
export const updateMyTouristProfile = async (req, res, next) => {
    try {
    const account_id = req.user?.account_id;
    if (!account_id) { res.status(401); throw new Error("Unauthorized"); }

    const profile = await TouristProfile.findOne({ account_id });
    if (!profile) { res.status(404); throw new Error("Tourist profile not found"); }

    // Disallow updating IDs even if the client sends them
    delete req.body.account_id;
    delete req.body.tourist_profile_id;

    const allowed = ["full_name", "nickname", "contact_no", "nationality"];
    let updated = 0;
    for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        if (key === "full_name") {
            const cleanedFullName = sanitizeFullName(req.body[key]);
            assertValidFullName(cleanedFullName);
            profile[key] = cleanedFullName;
        } else if (key === "nationality") {
            profile[key] = assertValidNationality(req.body[key]);
        } else if (key === "nickname") {
            profile[key] = String(req.body[key] ?? "").trim();
        } else {
            profile[key] = req.body[key];
        }
        updated++;
        }
    }

    if (updated === 0) {
        res.status(400);
        throw new Error("Provide at least one of: full_name, nickname, contact_no, nationality");
    }

    await profile.save();
    res.json({ message: "Tourist profile updated", profile });
    } catch (e) { next(e); }
    
}

export const getMyProfile = async (req, res, next) => {
  try {
    const accId = req.user.account_id;
    const profile = await TouristProfile.findOne({ account_id: accId })
      .select("-_id -__v");
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    res.json(profile);
  } catch (e) { next(e); }
};

