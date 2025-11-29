import Account from "../../models/Account.js";
import TouristProfile from "../../models/tourist/TouristProfile.js"

//post /api/tourist/create-profile
export const createTouristProfile = async (req, res, next) => {
    try {
        const account_id = req.user?.account_id;
        if (!account_id) { res.status(401); throw new Error("Unauthorized"); }
        
        const { full_name, contact_no, nationality} = req.body;
        if (!full_name || !contact_no || !nationality) { 
            res.status(400); 
            throw new Error("email, password, full_name are required"); 
        }

        const exist = await TouristProfile.findOne({ account_id })
        if(exist)
        {
            res.status(409);
            throw new Error("TouristProfile already registered")
        }

        const profile = await TouristProfile.create({
            account_id,
            full_name,
            contact_no,
            nationality,
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

    const allowed = ["full_name", "contact_no", "nationality"];
    let updated = 0;
    for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        profile[key] = req.body[key];
        updated++;
        }
    }

    if (updated === 0) {
        res.status(400);
        throw new Error("Provide at least one of: full_name, contact_no, nationality");
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

