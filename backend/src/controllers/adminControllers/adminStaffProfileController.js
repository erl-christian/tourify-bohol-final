import Account from "../../models/Account.js";
import AdminStaffProfile from "../../models/adminModels/AdminStaffProfile.js";
import Municipality from "../../models/Municipality.js";
import BusinessEstablishment from "../../models/businessEstablishmentModels/BusinessEstablishment.js";
import EstablishmentApproval from "../../models/businessEstablishmentModels/EstablishmentApproval.js"
import BusinessEstablishmentProfile from "../../models/businessEstablishmentModels/BusinessEstablishmentProfile.js"
import { generateEstablishmentQr } from '../../services/qrService.js';
import { listFeedbackForEstablishment } from "../publicControllers/publicFeedbackController.js";
import Feedback from "../../models/feedback/Feedback.js";
import FeedbackResponse from "../../models/feedback/FeedbackResponse.js";

//post /api/admin/bto/create-lgu-admin
export const createLGUAdmin = async (req, res, next) => {
    try {
        const { email, password, full_name, municipality_id } = req.body;
        if (!email || !password || !full_name || !municipality_id) { 
            res.status(400); 
            throw new Error("email, password, full_name, municipality_id are required"); 
        }

        const muni = await Municipality.findOne({ municipality_id });
        if (!muni) { 
            res.status(404); 
            throw new Error("Municipality not found"); 
        }

        const exists = await Account.findOne({ email });
        if (exists) { 
            res.status(409); 
            throw new Error("Email already in use"); 
        }

        const acc = await Account.create({ email, password, role: "lgu_admin" });

        const profile = await AdminStaffProfile.create({
            account: acc._id,
            account_id: acc.account_id,
            municipality_id,
            full_name,
            position: "LGU Admin"
        });

        res.status(201).json({
            message: "LGU Admin created",
            account: { id: acc._id, account_id: acc.account_id, email: acc.email, role: acc.role },
            profile
        });

    } catch (err) { next(err); }
}

//post api/admin/lgu/create-lgu-staff
export const createLGUStaff = async (req, res, next) => {
  try {
    //Find the LGU Admin’s profile using the token (set by auth middleware)
    const creatorAccId = req.user?.account_id; // comes from auth.js
    if (!creatorAccId) { res.status(401); throw new Error("Unauthorized"); }

    const creatorProfile = await AdminStaffProfile.findOne({
      account_id: creatorAccId,
      position: "LGU Admin"
    });

    if (!creatorProfile) {
      res.status(403);
      throw new Error("Only LGU Admins with a profile can create staff");
    }

    //Validate request body (no municipality_id in body)
    const { email, password, full_name } = req.body;
    if (!email || !password || !full_name) {
      res.status(400);
      throw new Error("email, password, full_name are required");
    }

    //Unique email
    const exists = await Account.findOne({ email });
    if (exists) { res.status(409); throw new Error("Email already in use"); }

    //Create staff account
    const acc = await Account.create({ email, password, role: "lgu_staff" });

    //Create staff profile inheriting municipality from creator
    const profile = await AdminStaffProfile.create({
      account: acc._id,
      account_id: acc.account_id,
      municipality_id: creatorProfile.municipality_id, // ← auto-inherited
      full_name,
      position: "LGU Staff"
    });

    res.status(201).json({
      message: "LGU Staff created",
      account: { id: acc._id, account_id: acc.account_id, email: acc.email, role: acc.role },
      profile
    });
  } catch (err) {
    next(err);
  }
};


// GET /api/admin/bto/establishments
export const listAllEstablishments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, municipality_id, q } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(100, Number(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;
    if (municipality_id) filter.municipality_id = municipality_id;

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { type: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      BusinessEstablishment.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      BusinessEstablishment.countDocuments(filter),
    ]);

    res.json({
      page: pageNum,
      limit: limitNum,
      total,
      items,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/lgu/establishments
export const listMunicipalEstablishments = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) { res.status(401); throw new Error('Unauthorized'); }

    const adminProfile = await AdminStaffProfile.findOne({
      account_id,
      position: { $in: ['LGU Admin', 'LGU Staff'] },
    });
    if (!adminProfile) {
      res.status(403);
      throw new Error('Only LGU Admin or LGU Staff profiles can view establishments');
    }

    const { page = 1, limit = 10, status, q } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = { municipality_id: adminProfile.municipality_id };
    if (status) filter.status = status;

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { type: { $regex: q, $options: 'i' } },
        { address: { $regex: q, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      BusinessEstablishment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      BusinessEstablishment.countDocuments(filter),
    ]);

    res.json({ page: Number(page), limit: Number(limit), total, items });
  } catch (err) {
    next(err);
  }
};


//get /api/admin/bto/lgu-list
//get all the list of the accounts
export const getLGUStaffs = async (req, res, next) => {
  try {
    let limitToMunicipality = null;
    if (req.user?.role === "lgu_admin") {
      const profile = await AdminStaffProfile.findOne({
        account_id: req.user.account_id,
        position: "LGU Admin"
      }).lean();

      if (!profile) {
        res.status(403);
        throw new Error("LGU Admin profile not found");
      }
      limitToMunicipality = profile.municipality_id;
    }

    const staffAccounts = await Account.find({
      role: { $in: ["lgu_admin", "lgu_staff", "business_establishment"] },
    })
      .select("-password") // never expose password hashes
      .sort({ createdAt: -1 })
      .lean();

      const accountIds = staffAccounts.map((acc) => acc.account_id);
      const staffProfiles = await AdminStaffProfile.find({
            account_id: { $in: accountIds },
      })
        .select('-_id -__v')
        .lean();

      const ownerProfiles = await BusinessEstablishmentProfile.find({
      account_id: { $in: accountIds },
      })
        .select('-_id -__v')
        .lean();

      const profileByAccountId = [...staffProfiles, ...ownerProfiles].reduce(
        (acc, profile) => {
          acc[profile.account_id] = profile;
          return acc;
        },
        {},
      );

    const staff = staffAccounts.map((acc) => ({
      account: acc,
      profile: profileByAccountId[acc.account_id] || null,
    }));

    const filtered = limitToMunicipality
      ? staff.filter((item) => item.profile?.municipality_id === limitToMunicipality)
      : staff;

    res.json({ staff: filtered });
  } catch (error) {
    next(error);
  }
};


// POST /api/owners/establishments
// body: { name, type, address?, description?, contact_info?, accreditation_no?, latitude?, longitude? }
export const ownerCreateEstablishment = async (req, res, next) => {
    try {
    const account_id = req.user?.account_id;
    if (!account_id) {
      res.status(401);
      throw new Error("Unauthorized");
    }

    const ownerProfile = await BusinessEstablishmentProfile.findOne({ account_id });
    if (!ownerProfile) {
      res.status(403);
      throw new Error("Owner profile not found. Ask LGU to create one.");
    }

    const {
      name,
      type,
      address,
      description,
      contact_info,
      accreditation_no,
      latitude,
      longitude,
    } = req.body;
    if (!name || !type) {
      res.status(400);
      throw new Error("name and type are required");
    }

    const est = await BusinessEstablishment.create({
      municipality_id: ownerProfile.municipality_id,
      // Use the field name defined in the schema so the reference is persisted
      business_establishment_profile_id: ownerProfile.business_establishment_profile_id,
      name,
      type,
      address,
      description,
      contact_info,
      accreditation_no,
      latitude,
      longitude,
      status: "pending",
    });

    const { publicUrl } = await generateEstablishmentQr(est.businessEstablishment_id);
    est.qr_code = publicUrl;
    await est.save();

    res.status(201).json({
      message: "Establishment submitted (pending LGU approval)",
      establishment: est,
    });
  } catch (e) {
    next(e);
  }
};

export const regenerateEstablishmentQr = async (req, res, next) => {
  try {
    const { estId } = req.params;
    const est = await BusinessEstablishment.findOne({
      businessEstablishment_id: estId,
    });
    if (!est) { res.status(404); throw new Error('Establishment not found'); }

    //verify requester owns/oversees this establishment.
    const { publicUrl } =
      await generateEstablishmentQr(est.businessEstablishment_id);
    est.qr_code = publicUrl;
    await est.save();

    res.json({ message: 'QR code regenerated', qr_code: est.qr_code });
  } catch (err) {
    next(err);
  }
};


export const lguCreateOwnerProfile = async (req, res, next) => {
  try {
    // must be LGU Admin
    const callerAccId = req.user?.account_id;
    if (!callerAccId) { res.status(401); throw new Error("Unauthorized"); }

    const lguAdmin = await AdminStaffProfile.findOne({
      account_id: callerAccId, position: "LGU Admin"
    });
    if (!lguAdmin) { res.status(403); throw new Error("Only LGU Admins can create owners"); }

    const { email, password, full_name, contact_no, role = "Owner" } = req.body;
    if (!email || !password || !full_name) {
      res.status(400); throw new Error("email, password, full_name are required");
    }

    // unique email
    const exists = await Account.findOne({ email });
    if (exists) { res.status(409); throw new Error("Email already in use"); }

    // create owner account
    const acc = await Account.create({ email, password, role: "business_establishment" });

    // create owner profile; municipality comes from the LGU Admin creating them
    const profile = await BusinessEstablishmentProfile.create({
      account_id: acc.account_id,
      municipality_id: lguAdmin.municipality_id,  // <-- inherit
      full_name, contact_no, role
    });

    res.status(201).json({
      message: "Owner profile created",
      account: { id: acc._id, account_id: acc.account_id, email: acc.email, role: acc.role },
      profile
    });
  } catch (e) { next(e); }
};

// POST /api/admin/lgu/establishments/:estId/approval
// body: { action: "approve" | "reject" | "return", remarks?: string }
export const actOnEstablishment = async (req, res, next) => {
  try {
    const creatorAccId = req.user?.account_id;
    if (!creatorAccId) {
      res.status(401);
      throw new Error("Unauthorized");
    }

    const actor = await AdminStaffProfile.findOne({
      account_id: creatorAccId,
      position: { $in: ["LGU Admin", "LGU Staff"] },
    });
    if (!actor) {
      res.status(403);
      throw new Error("Only LGU Admin or LGU Staff profiles can approve/reject");
    }

    const { estId } = req.params;
    const est = await BusinessEstablishment.findOne({
      businessEstablishment_id: estId,
    });
    if (!est) {
      res.status(404);
      throw new Error("Establishment not found");
    }

    if (est.municipality_id !== actor.municipality_id) {
      res.status(403);
      throw new Error("Cannot act on establishments outside your municipality");
    }

    const { action, remarks } = req.body;
    if (!["approve", "reject", "return"].includes(action)) {
      res.status(400);
      throw new Error('action must be "approve", "reject", or "return"');
    }
    let approval_status = "rejected";
    if (action === "approve") approval_status = "approved";
    if (action === "return") approval_status = "needs_owner_revision";

    await EstablishmentApproval.updateMany(
      { businessEstablishment_id: est.businessEstablishment_id, is_latest: true },
      { $set: { is_latest: false } }
    );

    const appr = await EstablishmentApproval.create({
      businessEstablishment_id: est.businessEstablishment_id,
      admin_staff_profile_id: actor.admin_staff_profile_id,
      approval_status,
      action,
      remarks,
      is_latest: true,
    });

    est.status = approval_status;
    // Persist the latest approval reference using the schema’s field names
    est.businessEstablishment_approval_id = appr.establishment_approval_id;
    await est.save();

    res.status(201).json({
      message: `Establishment ${approval_status}`,
      approval: appr,
      establishment: est,
    });
  } catch (e) {
    next(e);
  }
};

export const lguModerateFeedback = async (req, res, next) => {
  try {
    const adminAccId = req.user?.account_id;
    if (!adminAccId) { res.status(401); throw new Error('Unauthorized'); }

    const admin = await AdminStaffProfile.findOne({
      account_id: adminAccId,
      position: { $in: ['LGU Admin', 'LGU Staff'] },
    }).lean();
    if (!admin) { res.status(403); throw new Error('Only LGU Admin/Staff can moderate'); }

    const { feedbackId } = req.params;
    const { action, reason = '' } = req.body;
    if (!['hide', 'unhide', 'flag', 'delete'].includes(action)) {
      res.status(400); throw new Error('Invalid action');
    }

    const fb = await Feedback.findOne({ feedback_id: feedbackId });
    if (!fb) { res.status(404); throw new Error('Feedback not found'); }

    const est = await BusinessEstablishment.findOne({ businessEstablishment_id: fb.business_establishment_id });
    if (!est || est.municipality_id !== admin.municipality_id) {
      res.status(403); throw new Error('Cannot moderate outside your municipality');
    }

    if (action === 'hide') {
      fb.is_hidden = true;
      fb.moderated_note = reason;
      fb.moderated_by = adminAccId;
    } else if (action === 'unhide') {
      fb.is_hidden = false;
      fb.moderated_note = reason;
      fb.moderated_by = adminAccId;
    } else if (action === 'flag') {
      fb.is_flagged = true;
      fb.flagged_reason = reason;
      fb.moderated_by = adminAccId;
    } else if (action === 'delete') {
      fb.deleted_at = new Date();
      fb.moderated_note = reason;
      fb.moderated_by = adminAccId;
    }

    await fb.save();
    res.json({ message: 'Feedback updated', feedback: fb });
  } catch (e) { next(e); }
};

export const listPendingEstablishment = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) { res.status(401); throw new Error("Unauthorized"); }

    const adminProfile = await AdminStaffProfile.findOne({
      account_id,
      position: { $in: ["LGU Admin", "LGU Staff"] }
    });
    if (!adminProfile) {
      res.status(403);
      throw new Error("Only LGU Admin or LGU Staff profiles can view pending list");
    }

    const { page = 1, limit = 10, q} = req.query;
     const skip = (Number(page) - 1) * Number(limit);

    const filter = {
      municipality_id: adminProfile.municipality_id,
       status: { $in: ['pending', 'needs_admin_review'] },
    };

    // Optional text search by name/type/address
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { type: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      BusinessEstablishment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      BusinessEstablishment.countDocuments(filter)
    ]);

    res.json({
      page: Number(page),
      limit: Number(limit),
      total,
      items
    });

  } catch (error) {
    next(error);
  }
}

export const listMyEstablishments = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) { res.status(401); throw new Error("Unauthorized"); }

    const ownerProfile = await BusinessEstablishmentProfile.findOne({ account_id });
    if (!ownerProfile) { res.status(403); throw new Error("Owner profile not found"); }

    const { page = 1, limit = 10, status, q } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = {
      business_establishment_profile_id: ownerProfile.business_establishment_profile_id
    };
    if (status) filter.status = status; // pending|approved|rejected

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { type: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      BusinessEstablishment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      BusinessEstablishment.countDocuments(filter)
    ]);

    res.json({
      page: Number(page),
      limit: Number(limit),
      total,
      items
    });
  } catch (e) { next(e); }
};

export const getEstablishmentDetails = async (req, res, next) => {
  try {
    const { estId } = req.params;

    // Base doc
    const est = await BusinessEstablishment.findOne({ businessEstablishment_id: estId });
    if (!est) { res.status(404); throw new Error("Establishment not found"); }

    // Owner profile (if any)
    let ownerProfile = null;
    if (est.business_establishment_profile_id) {
      ownerProfile = await BusinessEstablishmentProfile.findOne({
        business_establishment_profile_id: est.business_establishment_profile_id
      }, { _id: 0, business_establishment_profile_id: 1, full_name: 1, contact_no: 1, account_id: 1 });
    }

    // Latest approval (if any)
    const latestApproval = await EstablishmentApproval.findOne({
      businessEstablishment_id: est.businessEstablishment_id,
      is_latest: true
    }, { _id: 0, establishmentApproval_id: 1, approval_status: 1, action: 1, remarks: 1, action_date: 1, admin_staff_profile_id: 1 });

    res.json({
      establishment: est,
      ownerProfile,
      latestApproval
    });
  } catch (e) { next(e); }
};

// PATCH /api/owners/establishments/:estId
// body: { name?, type?, address?, description?, contact_info?, accreditation_no?, latitude?, longitude? }
export const ownerUpdatePendingEstablishment = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) { res.status(401); throw new Error("Unauthorized"); }

    // Owner must have a profile
    const ownerProfile = await BusinessEstablishmentProfile.findOne({ account_id });
    if (!ownerProfile) { res.status(403); throw new Error("Owner profile not found"); }

    const { estId } = req.params;

    // Must be this owner's establishment
    const est = await BusinessEstablishment.findOne({
      businessEstablishment_id: estId,
      business_establishment_profile_id: ownerProfile.business_establishment_profile_id
    });
    if (!est) { res.status(404); throw new Error("Establishment not found"); }

    const previousStatus = est.status;

    const updatable = ["name","type","address","description","contact_info","accreditation_no","latitude","longitude"];
  let hasChanges = false;
  for (const key of updatable) {
    if (req.body[key] !== undefined) {
      est[key] = req.body[key];
      hasChanges = true;
    }
  }
  if (!hasChanges) {
    res.status(400);    throw new Error("No changes provided");
  }

  if (previousStatus !== "pending") {
    est.status = "pending";           // send back to LGU for approval
    est.ownerRevisionAt = new Date(); // optional audit field if your schema allows
  }

  await est.save();
  res.json({
    message:      previousStatus === "pending"
        ? "Establishment updated."
        : "Changes submitted. LGU will re-approve this listing.",
    establishment: est,
  });

    await est.save();
    res.json({ message: "Establishment updated", establishment: est });
  } catch (e) { next(e); }
};

export const updateLguManagedAccountStatus = async (req, res, next) => {
  try {
    const adminAccountId = req.user?.account_id;
    if (!adminAccountId) { res.status(401); throw new Error('Unauthorized'); }

    const adminProfile = await AdminStaffProfile.findOne({
      account_id: adminAccountId,
      position: 'LGU Admin',
    }).lean();
    if (!adminProfile) { res.status(403); throw new Error('Only LGU admins can manage these accounts'); }

    const { accountId } = req.params;
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      res.status(400);
      throw new Error('is_active flag is required.');
    }

    const account = await Account.findOne({
      account_id: accountId,
      role: { $in: ['lgu_staff', 'business_establishment'] },
    });
    if (!account) { res.status(404); throw new Error('Account not found'); }

    if (account.role === 'lgu_staff') {
      const profile = await AdminStaffProfile.findOne({ account_id: accountId, position: 'LGU Staff' }).lean();
      if (!profile || profile.municipality_id !== adminProfile.municipality_id) {
        res.status(403);
        throw new Error('You can only manage staff within your municipality');
      }
    } else {
      const ownerProfile = await BusinessEstablishmentProfile.findOne({ account_id: accountId }).lean();
      if (!ownerProfile || ownerProfile.municipality_id !== adminProfile.municipality_id) {
        res.status(403);
        throw new Error('You can only manage owners from your municipality');
      }
    }

    if (account.is_active === is_active) {
      return res.json({
        message: `Account already ${is_active ? 'active' : 'deactivated'}.`,
        account: { account_id: account.account_id, role: account.role, is_active: account.is_active },
      });
    }

    account.is_active = is_active;
    await account.save();

    res.json({
      message: `Account ${is_active ? 'activated' : 'deactivated'}.`,
      account: { account_id: account.account_id, role: account.role, is_active: account.is_active },
    });
  } catch (err) { next(err); }
};


export const updateLguAdminStatus = async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const { is_active } = req.body;
    if (typeof is_active !== "boolean") {
      res.status(400);
      throw new Error("is_active flag is required.");
    }

    const account = await Account.findOne({ account_id: accountId, role: "lgu_admin" });
    if (!account) { res.status(404); throw new Error("LGU admin not found"); }

    if (account.is_active === is_active) {
      return res.json({
        message: `LGU admin is already ${is_active ? "active" : "deactivated"}.`,
        account: { account_id: account.account_id, email: account.email, is_active: account.is_active },
      });
    }

    account.is_active = is_active;
    await account.save();

    res.json({
      message: `LGU admin ${is_active ? "reactivated" : "deactivated"}.`,
      account: { account_id: account.account_id, email: account.email, is_active: account.is_active },
    });
  } catch (err) { next(err); }
};

export const updateLguAdmin = async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const { email, full_name, municipality_id } = req.body;

    if (!email && !full_name && !municipality_id) {
      res.status(400);
      throw new Error('At least one field (email, full_name, municipality_id) is required.');
    }

    const account = await Account.findOne({ account_id: accountId, role: 'lgu_admin' });
    if (!account) {
      res.status(404);
      throw new Error('LGU admin not found');
    }

    if (email && email !== account.email) {
      const duplicate = await Account.findOne({ email, account_id: { $ne: accountId } });
      if (duplicate) {
        res.status(409);
        throw new Error('Email already in use');
      }
      account.email = email;
    }

    const profile = await AdminStaffProfile.findOne({
      account_id: accountId,
      position: 'LGU Admin',
    });
    if (!profile) {
      res.status(404);
      throw new Error('LGU admin profile not found');
    }

    if (municipality_id) {
      const muni = await Municipality.findOne({ municipality_id });
      if (!muni) {
        res.status(404);
        throw new Error('Municipality not found');
      }
      profile.municipality_id = municipality_id;
    }

    if (full_name) {
      profile.full_name = full_name;
    }

    await account.save();
    await profile.save();

    res.json({
      message: 'LGU admin updated.',
      account: {
        account_id: account.account_id,
        email: account.email,
        role: account.role,
        is_active: account.is_active,
      },
      profile,
    });
  } catch (err) {
    next(err);
  }
};


//'/lgu/establishments/:estId/endorse
export const endorseEstablishmentToAdmin = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) {
      res.status(401);
      throw new Error('Unauthorized');
    }

    const staffProfile = await AdminStaffProfile.findOne({
      account_id,
      position: 'LGU Staff',
    });
    if (!staffProfile) {
      res.status(403);
      throw new Error('Only LGU staff can endorse submissions');
    }

    const { estId } = req.params;

    const est = await BusinessEstablishment.findOne({
      businessEstablishment_id: estId,
    });
    if (!est) {
      res.status(404);
      throw new Error('Establishment not found');
    }

    if (est.municipality_id !== staffProfile.municipality_id) {
      res.status(403);
      throw new Error('You can only endorse establishments in your municipality');
    }

    if (est.status !== 'pending') {
      res.status(409);
      throw new Error('Only pending submissions can be endorsed');
    }

    est.status = 'needs_admin_review';
    est.lastEndorsedBy = staffProfile.admin_staff_profile_id; // optional helper field
    est.endorseNotes = req.body.notes || '';
    est.endorsedAt = new Date();
    await est.save();

    await EstablishmentApproval.create({
      businessEstablishment_id: est.businessEstablishment_id,
      action: 'endorsed',
      approval_status: 'needs_admin_review',
      remarks: req.body.notes || '',
      action_date: new Date(),
      admin_staff_profile_id: staffProfile.admin_staff_profile_id,
      is_latest: true,
    });

    res.json({
      message: 'Submission endorsed to LGU admin',
      establishment: est,
    });
  } catch (err) {
    next(err);
  }
};


// GET /api/admin/lgu/establishments/:estId/approvals
export const listApprovalHistory = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    const admin = await AdminStaffProfile.findOne({
      account_id,
      position: { $in: ["LGU Admin", "LGU Staff"] }
    });
    if (!admin) { res.status(403); throw new Error("Only LGU Admin or Staff can view approval history"); }

    const { estId } = req.params;
    const est = await BusinessEstablishment.findOne({ businessEstablishment_id: estId });
    if (!est) { res.status(404); throw new Error("Establishment not found"); }
    if (est.municipality_id !== admin.municipality_id) {
      res.status(403); throw new Error("Outside your municipality");
    }

    const history = await EstablishmentApproval.find({ businessEstablishment_id: est.businessEstablishment_id })
      .sort({ action_date: -1 });

    res.json({ establishment: est.businessEstablishment_id, history });
  } catch (e) { next(e); }
};

export const listMunicipalFeedbackForEstablishment = async (req, res, next) => {
  try {
    const accountId = req.user?.account_id;
    if (!accountId) { res.status(401); throw new Error('Unauthorized'); }

    const adminProfile = await AdminStaffProfile.findOne({
      account_id: accountId,
      position: { $in: ['LGU Admin', 'LGU Staff'] },
    });
    if (!adminProfile) {
      res.status(403);
      throw new Error('Only LGU Admin/Staff can access municipal feedback');
    }

    const { estId } = req.params;
    const est = await BusinessEstablishment.findOne({ businessEstablishment_id: estId }).lean();
    if (!est) { res.status(404); throw new Error('Establishment not found'); }

    if (est.municipality_id !== adminProfile.municipality_id) {
      res.status(403);
      throw new Error('Cannot access feedback outside your municipality');
    }

    return listFeedbackForEstablishment(req, res, next);
  } catch (err) {
    next(err);
  }
};

export const listOwnerFeedbackForEstablishment = async (req, res, next) => {
  try {
    const accountId = req.user?.account_id;
    if (!accountId) { res.status(401); throw new Error('Unauthorized'); }

    // find owner profile
    const ownerProfile = await BusinessEstablishmentProfile.findOne({ account_id: accountId });
    if (!ownerProfile) {
      res.status(403);
      throw new Error('Only establishment owners can view their feedback');
    }

    const { estId } = req.params;
    const est = await BusinessEstablishment.findOne({ businessEstablishment_id: estId }).lean();
    if (!est) { res.status(404); throw new Error('Establishment not found'); }

    if (est.business_establishment_profile_id !== ownerProfile.business_establishment_profile_id) {
      res.status(403);
      throw new Error('You can only view feedback for your own establishments');
    }

    return listFeedbackForEstablishment(req, res, next);
  } catch (err) {
    next(err);
  }
};


// PATCH /api/admin/lgu/accounts/:accountId
// body: { email?, full_name?, contact_no? }
export const updateLguManagedAccount = async (req, res, next) => {
  try {
    const adminAccountId = req.user?.account_id;
    if (!adminAccountId) { res.status(401); throw new Error('Unauthorized'); }

    const adminProfile = await AdminStaffProfile.findOne({
      account_id: adminAccountId,
      position: 'LGU Admin',
    }).lean();
    if (!adminProfile) { res.status(403); throw new Error('Only LGU admins can manage these accounts'); }

    const { accountId } = req.params;
    const { email, full_name, contact_no } = req.body;
    if (!email && !full_name && !contact_no) {
      res.status(400);
      throw new Error('At least one field (email, full_name, contact_no) is required.');
    }

    const account = await Account.findOne({
      account_id: accountId,
      role: { $in: ['lgu_staff', 'business_establishment'] },
    });
    if (!account) { res.status(404); throw new Error('Account not found'); }

    let ownerProfile = null;
    let staffProfile = null;

    if (account.role === 'lgu_staff') {
      staffProfile = await AdminStaffProfile.findOne({
        account_id: accountId,
        position: 'LGU Staff',
      });
      if (!staffProfile || staffProfile.municipality_id !== adminProfile.municipality_id) {
        res.status(403);
        throw new Error('You can only manage staff within your municipality');
      }
    } else {
      ownerProfile = await BusinessEstablishmentProfile.findOne({ account_id: accountId });
      if (!ownerProfile || ownerProfile.municipality_id !== adminProfile.municipality_id) {
        res.status(403);
        throw new Error('You can only manage owners from your municipality');
      }
    }

    if (email && email !== account.email) {
      const duplicate = await Account.findOne({ email, account_id: { $ne: accountId } });
      if (duplicate) { res.status(409); throw new Error('Email already in use'); }
      account.email = email;
    }

    if (account.role === 'lgu_staff' && full_name) {
      staffProfile.full_name = full_name;
      await staffProfile.save();
    }

    if (account.role === 'business_establishment') {
      if (full_name) {
        ownerProfile.full_name = full_name;
      }
      if (contact_no !== undefined) {
        ownerProfile.contact_no = contact_no;
      }
      await ownerProfile.save();
    }

    await account.save();

    res.json({
      message: 'Account updated.',
      account: {
        account_id: account.account_id,
        email: account.email,
        role: account.role,
        is_active: account.is_active,
      },
      profile: staffProfile || ownerProfile || null,
    });
  } catch (err) { next(err); }
};


