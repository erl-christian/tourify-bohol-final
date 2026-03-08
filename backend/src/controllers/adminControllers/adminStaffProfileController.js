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
import { sendMail } from '../../services/mailer.js';
import crypto from "crypto";

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildLguAdminInviteHtml = ({
  fullName,
  email,
  password,
  municipalityName,
  loginUrl,
}) => `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #dbe3ef;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:24px;background:linear-gradient(135deg,#0f766e,#155e75);color:#ffffff;">
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.8px;text-transform:uppercase;opacity:0.9;">Tourify Bohol</p>
                <h1 style="margin:0;font-size:22px;line-height:1.3;">LGU Admin Account Invitation</h1>
              </td>
            </tr>

            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
                  Hello <strong>${escapeHtml(fullName)}</strong>,
                </p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
                  Your LGU Admin account for <strong>${escapeHtml(municipalityName || 'your municipality')}</strong>
                  has been created successfully.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbe3ef;border-radius:10px;background:#f8fafc;margin:0 0 18px;">
                  <tr>
                    <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">Username</td>
                    <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;">${escapeHtml(email)}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px;font-size:13px;color:#64748b;">Temporary Password</td>
                    <td style="padding:14px 16px;font-size:14px;color:#0f172a;">${escapeHtml(password)}</td>
                  </tr>
                </table>

                <p style="margin:0 0 10px;font-size:14px;color:#334155;">Sign in using the button below:</p>
                <p style="margin:0 0 18px;">
                  <a
                    href="${escapeHtml(loginUrl)}"
                    style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:10px 16px;border-radius:8px;"
                  >Open Tourify Admin Login</a>
                </p>

                <p style="margin:0 0 10px;font-size:13px;color:#64748b;">
                  If the button does not work, copy and paste this link:
                </p>
                <p style="margin:0 0 16px;font-size:13px;word-break:break-all;">
                  <a href="${escapeHtml(loginUrl)}" style="color:#0f766e;">${escapeHtml(loginUrl)}</a>
                </p>

                <p style="margin:0;padding:12px 14px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa;font-size:13px;color:#9a3412;">
                  Security reminder: change your password immediately after your first login.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;">
                Tourify Bohol - Automated message, please do not reply.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

const USERNAME_REGEX = /^[a-z0-9._-]{4,32}$/;

const generateTempPassword = (length = 12) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  return Array.from({ length }, () => chars[crypto.randomInt(0, chars.length)]).join("");
};


const getAdminLoginUrl = () => {
  const frontendBase = (
    process.env.FRONTEND_ADMIN_URL ||
    process.env.APP_BASE_URL ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
  return `${frontendBase}/login`;
};

const buildUsernamePart = (value, maxLen = 10) => {
  const text = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .trim();

  if (!text) return "acct";

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, maxLen);
  }

  const combined = words
    .slice(0, 3)
    .map((word) => word.slice(0, 4))
    .join("");

  return combined.slice(0, maxLen);
};

const buildEstablishmentUsernameBase = ({ establishmentName, municipalityName, ownerName }) => {
  const estPart = buildUsernamePart(establishmentName, 10);
  const municipalityPart = buildUsernamePart(municipalityName, 10);
  const ownerPart = buildUsernamePart(ownerName, 10);
  return `${estPart}.${municipalityPart}.${ownerPart}`.replace(/\.+/g, ".");
};

const generateUniqueUsername = async (baseUsername) => {
  const normalizedBase = String(baseUsername || "acct.local.owner")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  const safeBase = normalizedBase.slice(0, 28) || "acct.local.owner";
  let candidate = safeBase;
  let suffix = 2;

  while (await Account.exists({ username: candidate })) {
    const suffixText = `.${suffix}`;
    candidate = `${safeBase.slice(0, Math.max(1, 32 - suffixText.length))}${suffixText}`;
    suffix += 1;
  }

  return candidate;
};

const resolveOwnerEstablishmentScope = async ({ accountId, estId = null }) => {
  const ownerProfile = await BusinessEstablishmentProfile.findOne({ account_id: accountId }).lean();
  if (ownerProfile) {
    if (!estId) {
      return {
        scope: "owner",
        ownerProfile,
        filter: {
          business_establishment_profile_id: ownerProfile.business_establishment_profile_id,
        },
      };
    }

    const establishment = await BusinessEstablishment.findOne({
      businessEstablishment_id: estId,
      business_establishment_profile_id: ownerProfile.business_establishment_profile_id,
    });

    if (!establishment) {
      const error = new Error("Establishment not found");
      error.statusCode = 404;
      throw error;
    }

    return {
      scope: "owner",
      ownerProfile,
      establishment,
      filter: {
        business_establishment_profile_id: ownerProfile.business_establishment_profile_id,
      },
    };
  }

  const filter = estId
    ? { businessEstablishment_id: estId, establishment_account_id: accountId }
    : { establishment_account_id: accountId };

  const establishment = estId ? await BusinessEstablishment.findOne(filter) : null;
  if (estId && !establishment) {
    const error = new Error("Establishment not found");
    error.statusCode = 404;
    throw error;
  }

  const hasAssignedEstablishment =
    Boolean(establishment) ||
    (await BusinessEstablishment.exists({ establishment_account_id: accountId }));

  if (!hasAssignedEstablishment) {
    const error = new Error("Owner profile not found");
    error.statusCode = 403;
    throw error;
  }

  return {
    scope: "establishment",
    ownerProfile: null,
    establishment,
    filter: { establishment_account_id: accountId },
  };
};

const buildLguManagedInviteHtml = ({
  heading,
  fullName,
  email,
  password,
  municipalityName,
  loginUrl,
  createdByName,
}) => `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #dbe3ef;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:24px;background:linear-gradient(135deg,#0f766e,#155e75);color:#ffffff;">
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.8px;text-transform:uppercase;opacity:0.9;">Tourify Bohol</p>
                <h1 style="margin:0;font-size:22px;line-height:1.3;">${escapeHtml(heading)}</h1>
              </td>
            </tr>

            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
                  Hello <strong>${escapeHtml(fullName)}</strong>,
                </p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
                  Your account for <strong>${escapeHtml(municipalityName || 'your municipality')}</strong>
                  was created by <strong>${escapeHtml(createdByName || 'LGU Admin')}</strong>.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbe3ef;border-radius:10px;background:#f8fafc;margin:0 0 18px;">
                  <tr>
                    <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">Username</td>
                    <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;">${escapeHtml(email)}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px;font-size:13px;color:#64748b;">Temporary Password</td>
                    <td style="padding:14px 16px;font-size:14px;color:#0f172a;">${escapeHtml(password)}</td>
                  </tr>
                </table>

                <p style="margin:0 0 10px;font-size:14px;color:#334155;">Sign in using the button below:</p>
                <p style="margin:0 0 18px;">
                  <a
                    href="${escapeHtml(loginUrl)}"
                    style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:10px 16px;border-radius:8px;"
                  >Open Tourify Admin Login</a>
                </p>

                <p style="margin:0 0 10px;font-size:13px;color:#64748b;">If the button does not work, use this link:</p>
                <p style="margin:0 0 16px;font-size:13px;word-break:break-all;">
                  <a href="${escapeHtml(loginUrl)}" style="color:#0f766e;">${escapeHtml(loginUrl)}</a>
                </p>

                <p style="margin:0;padding:12px 14px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa;font-size:13px;color:#9a3412;">
                  Security reminder: you must change your password on first login.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;">
                Tourify Bohol - Automated message, please do not reply.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;



//post /api/admin/bto/create-lgu-admin
//post /api/admin/bto/create-lgu-admin
export const createLGUAdmin = async (req, res, next) => {
  try {
    const { email, username, full_name, municipality_id } = req.body;
    if (!email || !username || !full_name || !municipality_id) {
      res.status(400);
      throw new Error("email, username, full_name, municipality_id are required");
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedUsername = String(username).trim().toLowerCase();

    if (!USERNAME_REGEX.test(normalizedUsername)) {
      res.status(400);
      throw new Error("Invalid username format");
    }

    const muni = await Municipality.findOne({ municipality_id });
    if (!muni) {
      res.status(404);
      throw new Error("Municipality not found");
    }

    const exists = await Account.findOne({ username: normalizedUsername });
    if (exists) {
      res.status(409);
      throw new Error("Username already in use");
    }

    const tempPassword = generateTempPassword();

    const acc = await Account.create({
      email: normalizedEmail,
      username: normalizedUsername,
      password: tempPassword,
      role: "lgu_admin",
      must_change_password: true,
    });

    const profile = await AdminStaffProfile.create({
      account: acc._id,
      account_id: acc.account_id,
      municipality_id,
      full_name,
      position: "LGU Admin",
    });

    const loginUrl = getAdminLoginUrl();

    let inviteEmailSent = false;
    try {
      const mailResult = await sendMail({
        to: acc.email,
        subject: "Your Tourify Bohol LGU Admin account",
        html: buildLguAdminInviteHtml({
          fullName: full_name,
          email: acc.username,
          password: tempPassword,
          municipalityName: muni.name,
          loginUrl,
        }),
      });

      inviteEmailSent = Boolean(mailResult);
    } catch (mailErr) {
      console.warn("[createLGUAdmin] invite email send failed:", mailErr.message);
    }

    res.status(201).json({
      message: inviteEmailSent
        ? "LGU Admin created and invite email sent"
        : "LGU Admin created (invite email not sent)",
      account: {
        id: acc._id,
        account_id: acc.account_id,
        email: acc.email,
        username: acc.username,
        role: acc.role,
      },
      profile,
      inviteEmailSent,
    });
  } catch (err) {
    next(err);
  }
};

//post api/admin/bto/create-bto-staff
export const createBTOStaff = async (req, res, next) => {
  try {
    const { email, username, full_name } = req.body;
    if (!email || !username || !full_name) {
      res.status(400);
      throw new Error("email, username, full_name are required");
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedUsername = String(username).trim().toLowerCase();

    if (!USERNAME_REGEX.test(normalizedUsername)) {
      res.status(400);
      throw new Error("Invalid username format");
    }

    const exists = await Account.findOne({ username: normalizedUsername });
    if (exists) {
      res.status(409);
      throw new Error("Username already in use");
    }

    const tempPassword = generateTempPassword();

    const acc = await Account.create({
      email: normalizedEmail,
      username: normalizedUsername,
      password: tempPassword,
      role: "bto_staff",
      must_change_password: true,
    });

    const profile = await AdminStaffProfile.create({
      account: acc._id,
      account_id: acc.account_id,
      municipality_id: "BTO",
      full_name,
      position: "BTO Staff",
    });

    const loginUrl = getAdminLoginUrl();

    let inviteEmailSent = false;
    try {
      const mailResult = await sendMail({
        to: acc.email,
        subject: "Your Tourify Bohol BTO Staff account",
        html: buildLguManagedInviteHtml({
          heading: "BTO Staff Account Invitation",
          fullName: full_name,
          email: acc.username,
          password: tempPassword,
          municipalityName: "Bohol Province",
          loginUrl,
          createdByName: "BTO Admin",
        }),
      });
      inviteEmailSent = Boolean(mailResult);
    } catch (mailErr) {
      console.warn("[createBTOStaff] invite email send failed:", mailErr.message);
    }

    res.status(201).json({
      message: inviteEmailSent
        ? "BTO Staff created and invite email sent"
        : "BTO Staff created (invite email not sent)",
      account: {
        id: acc._id,
        account_id: acc.account_id,
        email: acc.email,
        username: acc.username,
        role: acc.role,
      },
      profile,
      inviteEmailSent,
    });
  } catch (err) {
    next(err);
  }
};



//post api/admin/lgu/create-lgu-staff
export const createLGUStaff = async (req, res, next) => {
  try {
    const creatorAccId = req.user?.account_id;
    if (!creatorAccId) {
      res.status(401);
      throw new Error("Unauthorized");
    }

    const creatorProfile = await AdminStaffProfile.findOne({
      account_id: creatorAccId,
      position: "LGU Admin",
    });

    if (!creatorProfile) {
      res.status(403);
      throw new Error("Only LGU Admins with a profile can create staff");
    }

    const { email, username, full_name } = req.body;
    if (!email || !username || !full_name) {
      res.status(400);
      throw new Error("email, username, full_name are required");
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedUsername = String(username).trim().toLowerCase();

    if (!USERNAME_REGEX.test(normalizedUsername)) {
      res.status(400);
      throw new Error("Invalid username format");
    }

    const exists = await Account.findOne({ username: normalizedUsername });
    if (exists) {
      res.status(409);
      throw new Error("Username already in use");
    }

    const tempPassword = generateTempPassword();

    const acc = await Account.create({
      email: normalizedEmail, // contact only
      username: normalizedUsername, // login ID
      password: tempPassword,
      role: "lgu_staff",
      must_change_password: true,
    });

    const profile = await AdminStaffProfile.create({
      account: acc._id,
      account_id: acc.account_id,
      municipality_id: creatorProfile.municipality_id,
      full_name,
      position: "LGU Staff",
    });

    const muni = await Municipality.findOne({
      municipality_id: creatorProfile.municipality_id,
    }).lean();

    const loginUrl = getAdminLoginUrl();

    let inviteEmailSent = false;
    try {
      const mailResult = await sendMail({
        to: acc.email,
        subject: "Your Tourify Bohol LGU Staff account",
        html: buildLguManagedInviteHtml({
          heading: "LGU Staff Account Invitation",
          fullName: full_name,
          email: acc.username, // displayed as username
          password: tempPassword,
          municipalityName: muni?.name || creatorProfile.municipality_id,
          loginUrl,
          createdByName: creatorProfile.full_name || "LGU Admin",
        }),
      });
      inviteEmailSent = Boolean(mailResult);
    } catch (mailErr) {
      console.warn("[createLGUStaff] invite email send failed:", mailErr.message);
    }

    res.status(201).json({
      message: inviteEmailSent
        ? "LGU Staff created and invite email sent"
        : "LGU Staff created (invite email not sent)",
      account: {
        id: acc._id,
        account_id: acc.account_id,
        email: acc.email,
        username: acc.username,
        role: acc.role,
      },
      profile,
      inviteEmailSent,
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

    const profileIds = items
      .map((item) => item.business_establishment_profile_id)
      .filter(Boolean);

    const ownerProfiles = await BusinessEstablishmentProfile.find({
      business_establishment_profile_id: { $in: profileIds },
    })
      .select("business_establishment_profile_id account_id full_name contact_no role municipality_id")
      .lean();

    const ownerAccountIds = ownerProfiles.map((profile) => profile.account_id);
    const establishmentAccountIds = items.map((item) => item.establishment_account_id).filter(Boolean);
    const accountIds = [...new Set([...ownerAccountIds, ...establishmentAccountIds])];

    const ownerAccounts = await Account.find({
      account_id: { $in: accountIds },
      role: "business_establishment",
    })
      .select("account_id username email is_active")
      .lean();

    const profileById = ownerProfiles.reduce((acc, profile) => {
      acc[profile.business_establishment_profile_id] = profile;
      return acc;
    }, {});

    const accountById = ownerAccounts.reduce((acc, account) => {
      acc[account.account_id] = account;
      return acc;
    }, {});

    const loginUrl = getAdminLoginUrl();

    const decoratedItems = items.map((item) => {
      const profile = profileById[item.business_establishment_profile_id];
      const ownerAccount = profile ? accountById[profile.account_id] : null;
      const establishmentAccount = item.establishment_account_id
        ? accountById[item.establishment_account_id] || null
        : null;
      return {
        ...item,
        owner_profile: profile || null,
        owner_account: ownerAccount,
        establishment_account: establishmentAccount,
        account_login_url: loginUrl,
      };
    });

    res.json({ page: Number(page), limit: Number(limit), total, items: decoratedItems });
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
      role: { $in: ["lgu_admin", "lgu_staff", "bto_staff", "business_establishment"] },
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

export const listMunicipalOwners = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) {
      res.status(401);
      throw new Error("Unauthorized");
    }

    const actor = await AdminStaffProfile.findOne({
      account_id,
      position: { $in: ["LGU Admin", "LGU Staff"] },
    }).lean();

    if (!actor) {
      res.status(403);
      throw new Error("Only LGU Admin/Staff can list owners");
    }

    const ownerProfiles = await BusinessEstablishmentProfile.find({
      municipality_id: actor.municipality_id,
    })
      .select("business_establishment_profile_id account_id full_name contact_no role municipality_id")
      .sort({ full_name: 1 })
      .lean();

    const accountIds = ownerProfiles.map((profile) => profile.account_id);
    const ownerAccounts = await Account.find({
      account_id: { $in: accountIds },
      role: "business_establishment",
    })
      .select("account_id username email is_active must_change_password")
      .lean();

    const accountById = ownerAccounts.reduce((acc, account) => {
      acc[account.account_id] = account;
      return acc;
    }, {});

    const items = ownerProfiles.map((profile) => ({
      profile,
      account: accountById[profile.account_id] || null,
    }));

    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const lguCreateEstablishmentForOwner = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) {
      res.status(401);
      throw new Error("Unauthorized");
    }

    const actor = await AdminStaffProfile.findOne({
      account_id,
      position: { $in: ["LGU Admin", "LGU Staff"] },
    });
    if (!actor) {
      res.status(403);
      throw new Error("Only LGU Admin/Staff can create establishments");
    }

    const {
      owner_account_id,
      official_name,
      type,
      ownership_type = "private",
      address,
      contact_info,
      accreditation_no,
      latitude,
      longitude,
      description,
    } = req.body;

    if (!owner_account_id || !official_name || !type) {
      res.status(400);
      throw new Error("owner_account_id, official_name, and type are required");
    }

    const ownerProfile = await BusinessEstablishmentProfile.findOne({
      account_id: owner_account_id,
      municipality_id: actor.municipality_id,
    });
    if (!ownerProfile) {
      res.status(404);
      throw new Error("Owner profile not found in your municipality");
    }

    const ownerAccount = await Account.findOne({
      account_id: owner_account_id,
      role: "business_establishment",
    }).lean();
    if (!ownerAccount) {
      res.status(404);
      throw new Error("Owner account not found");
    }

    const municipality = await Municipality.findOne({
      municipality_id: actor.municipality_id,
    })
      .select("municipality_id name")
      .lean();

    const generatedUsernameBase = buildEstablishmentUsernameBase({
      establishmentName: official_name,
      municipalityName: municipality?.name || actor.municipality_id,
      ownerName: ownerProfile.full_name || ownerAccount.username || ownerAccount.email,
    });
    const generatedUsername = await generateUniqueUsername(generatedUsernameBase);
    const tempPassword = generateTempPassword();

    const establishmentAccount = await Account.create({
      email: `${generatedUsername}@est.local`,
      username: generatedUsername,
      password: tempPassword,
      role: "business_establishment",
      must_change_password: true,
    });

    const est = await BusinessEstablishment.create({
      municipality_id: actor.municipality_id,
      business_establishment_profile_id: ownerProfile.business_establishment_profile_id,
      establishment_account_id: establishmentAccount.account_id,
      created_by_adminStaffProfile_id: actor.admin_staff_profile_id,
      name: String(official_name).trim(),
      official_name_locked: true,
      created_via: "lgu_seeded",
      type: String(type).trim(),
      ownership_type,
      address,
      description,
      contact_info,
      accreditation_no,
      latitude,
      longitude,
      status: "approved",
    });

    const { publicUrl } = await generateEstablishmentQr(est.businessEstablishment_id);
    est.qr_code = publicUrl;
    await est.save();

    res.status(201).json({
      message: "Establishment created, auto-approved, and linked to owner account",
      establishment: est,
      owner: {
        account_id: ownerAccount.account_id,
        username: ownerAccount.username,
        email: ownerAccount.email,
      },
      establishment_account: {
        account_id: establishmentAccount.account_id,
        username: establishmentAccount.username,
        temp_password: tempPassword,
        must_change_password: establishmentAccount.must_change_password,
        account_login_url: getAdminLoginUrl(),
      },
    });
  } catch (err) {
    next(err);
  }
};


// POST /api/owners/establishments
// body: { name, type, address?, description?, contact_info?, accreditation_no?, latitude?, longitude? }
export const ownerCreateEstablishment = async (req, res, next) => {
  try {
    res.status(403);
    throw new Error(
      "Establishments are now created by LGU. Please contact your LGU to register your establishment first."
    );
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
    const callerAccId = req.user?.account_id;
    if (!callerAccId) {
      res.status(401);
      throw new Error("Unauthorized");
    }

    const lguAdmin = await AdminStaffProfile.findOne({
      account_id: callerAccId,
      position: "LGU Admin",
    });
    if (!lguAdmin) {
      res.status(403);
      throw new Error("Only LGU Admins can create owners");
    }

    const { email, username, full_name, contact_no, role = "Owner" } = req.body;
    if (!email || !username || !full_name) {
      res.status(400);
      throw new Error("email, username, full_name are required");
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedUsername = String(username).trim().toLowerCase();

    if (!USERNAME_REGEX.test(normalizedUsername)) {
      res.status(400);
      throw new Error("Invalid username format");
    }

    const exists = await Account.findOne({ username: normalizedUsername });
    if (exists) {
      res.status(409);
      throw new Error("Username already in use");
    }

    const tempPassword = generateTempPassword();

    const acc = await Account.create({
      email: normalizedEmail, // contact only
      username: normalizedUsername, // login ID
      password: tempPassword,
      role: "business_establishment",
      must_change_password: true,
    });

    const profile = await BusinessEstablishmentProfile.create({
      account_id: acc.account_id,
      municipality_id: lguAdmin.municipality_id,
      full_name,
      contact_no,
      role,
    });

    const muni = await Municipality.findOne({
      municipality_id: lguAdmin.municipality_id,
    }).lean();

    const loginUrl = getAdminLoginUrl();

    let inviteEmailSent = false;
    try {
      const mailResult = await sendMail({
        to: acc.email,
        subject: "Your Tourify Bohol Establishment Owner account",
        html: buildLguManagedInviteHtml({
          heading: "Establishment Owner Account Invitation",
          fullName: full_name,
          email: acc.username, // displayed as username
          password: tempPassword,
          municipalityName: muni?.name || lguAdmin.municipality_id,
          loginUrl,
          createdByName: lguAdmin.full_name || "LGU Admin",
        }),
      });
      inviteEmailSent = Boolean(mailResult);
    } catch (mailErr) {
      console.warn("[lguCreateOwnerProfile] invite email send failed:", mailErr.message);
    }

    res.status(201).json({
      message: inviteEmailSent
        ? "Owner profile created and invite email sent"
        : "Owner profile created (invite email not sent)",
      account: {
        id: acc._id,
        account_id: acc.account_id,
        email: acc.email,
        username: acc.username,
        role: acc.role,
      },
      profile,
      inviteEmailSent,
    });
  } catch (e) {
    next(e);
  }
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

    let scope;
    try {
      scope = await resolveOwnerEstablishmentScope({ accountId: account_id });
    } catch (scopeErr) {
      if (scopeErr?.statusCode) res.status(scopeErr.statusCode);
      throw scopeErr;
    }

    const { page = 1, limit = 50, status, q } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = { ...scope.filter };
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

    const profileIds = items.map((item) => item.business_establishment_profile_id).filter(Boolean);
    const ownerProfiles = await BusinessEstablishmentProfile.find({
      business_establishment_profile_id: { $in: profileIds },
    })
      .select("business_establishment_profile_id account_id full_name contact_no role municipality_id")
      .lean();

    const profileById = ownerProfiles.reduce((acc, profile) => {
      acc[profile.business_establishment_profile_id] = profile;
      return acc;
    }, {});

    const ownerAccountIds = ownerProfiles.map((profile) => profile.account_id);
    const establishmentAccountIds = items.map((item) => item.establishment_account_id).filter(Boolean);
    const accountIds = [...new Set([...ownerAccountIds, ...establishmentAccountIds])];

    const accounts = await Account.find({
      account_id: { $in: accountIds },
      role: "business_establishment",
    })
      .select("account_id username email role is_active must_change_password")
      .lean();

    const accountById = accounts.reduce((acc, account) => {
      acc[account.account_id] = account;
      return acc;
    }, {});

    const loginUrl = getAdminLoginUrl();

    const decoratedItems = items.map((item) => ({
      ...(typeof item.toObject === "function" ? item.toObject() : item),
      owner_profile: profileById[item.business_establishment_profile_id] || null,
      owner_account: profileById[item.business_establishment_profile_id]
        ? accountById[profileById[item.business_establishment_profile_id].account_id] || null
        : null,
      establishment_account: item.establishment_account_id
        ? accountById[item.establishment_account_id] || null
        : null,
      account_login_url: loginUrl,
      permissions: {
        can_edit_name: false,
      },
      access_scope: scope.scope,
    }));

    res.json({
      page: Number(page),
      limit: Number(limit),
      total,
      items: decoratedItems
    });
  } catch (e) { next(e); }
};

export const getEstablishmentDetails = async (req, res, next) => {
  try {
    const { estId } = req.params;

    const est = await BusinessEstablishment.findOne({ businessEstablishment_id: estId });
    if (!est) { res.status(404); throw new Error("Establishment not found"); }

    let ownerProfile = null;
    if (est.business_establishment_profile_id) {
      ownerProfile = await BusinessEstablishmentProfile.findOne(
        { business_establishment_profile_id: est.business_establishment_profile_id },
        {
          _id: 0,
          business_establishment_profile_id: 1,
          full_name: 1,
          contact_no: 1,
          account_id: 1,
          role: 1,
          municipality_id: 1,
        }
      );
    }

    let ownerAccount = null;
    if (ownerProfile?.account_id) {
      ownerAccount = await Account.findOne({ account_id: ownerProfile.account_id })
        .select("account_id username email role is_active")
        .lean();
    }

    let establishmentAccount = null;
    if (est.establishment_account_id) {
      establishmentAccount = await Account.findOne({ account_id: est.establishment_account_id })
        .select("account_id username email role is_active must_change_password createdAt")
        .lean();
    }

    const latestApproval = await EstablishmentApproval.findOne(
      {
        businessEstablishment_id: est.businessEstablishment_id,
        is_latest: true,
      },
      {
        _id: 0,
        establishment_approval_id: 1,
        approval_status: 1,
        action: 1,
        remarks: 1,
        action_date: 1,
        admin_staff_profile_id: 1,
      }
    );

    let latestApprovalActor = null;
    if (latestApproval?.admin_staff_profile_id) {
      latestApprovalActor = await AdminStaffProfile.findOne(
        { admin_staff_profile_id: latestApproval.admin_staff_profile_id },
        {
          _id: 0,
          admin_staff_profile_id: 1,
          account_id: 1,
          full_name: 1,
          position: 1, // "LGU Admin" or "LGU Staff"
          municipality_id: 1,
        }
      );
    }

    res.json({
      establishment: est,
      ownerProfile,
      ownerAccount,
      establishmentAccount,
      accountLoginUrl: getAdminLoginUrl(),
      latestApproval,
      latestApprovalActor,
    });
  } catch (e) { next(e); }
};

// PATCH /api/owners/establishments/:estId
// body: { name?, type?, address?, description?, contact_info?, accreditation_no?, latitude?, longitude? }
export const ownerUpdatePendingEstablishment = async (req, res, next) => {
  try {
    const account_id = req.user?.account_id;
    if (!account_id) { res.status(401); throw new Error("Unauthorized"); }

    const { estId } = req.params;
    let access;
    try {
      access = await resolveOwnerEstablishmentScope({ accountId: account_id, estId });
    } catch (scopeErr) {
      if (scopeErr?.statusCode) res.status(scopeErr.statusCode);
      throw scopeErr;
    }
    const est = access.establishment;
    if (!est) { res.status(404); throw new Error("Establishment not found"); }

    if (req.body.name !== undefined) {
      res.status(400);
      throw new Error("Official establishment name is managed by LGU and cannot be edited by owner.");
    }

    if (req.body.budget_min !== undefined) {
    const parsedMin = req.body.budget_min === '' || req.body.budget_min == null
      ? null
      : Number(req.body.budget_min);

    if (parsedMin !== null && (!Number.isFinite(parsedMin) || parsedMin < 0)) {
      res.status(400);
      throw new Error('budget_min must be a non-negative number');
    }
    req.body.budget_min = parsedMin;
    }

    if (req.body.budget_max !== undefined) {
      const parsedMax = req.body.budget_max === '' || req.body.budget_max == null
        ? null
        : Number(req.body.budget_max);

      if (parsedMax !== null && (!Number.isFinite(parsedMax) || parsedMax < 0)) {
        res.status(400);
        throw new Error('budget_max must be a non-negative number');
      }
      req.body.budget_max = parsedMax;
    }

    const nextBudgetMin =
      req.body.budget_min !== undefined ? req.body.budget_min : est.budget_min;
    const nextBudgetMax =
      req.body.budget_max !== undefined ? req.body.budget_max : est.budget_max;

    if (nextBudgetMin != null && nextBudgetMax != null && nextBudgetMin > nextBudgetMax) {
      res.status(400);
      throw new Error('budget_min must be less than or equal to budget_max');
    }


    const updatable = [
      "type",
      "ownership_type",
      "address",
      "description",
      "contact_info",
      "accreditation_no",
      "latitude",
      "longitude",
      "budget_min",
      "budget_max",
    ];
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

  await est.save();
  res.json({
    message: "Establishment updated.",
    establishment: est,
  });
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

    if (!is_active) {
      const targetProfile = await AdminStaffProfile.findOne({
        account_id: accountId,
        position: "LGU Admin",
      }).lean();

      if (targetProfile?.municipality_id) {
        const sameMunicipalityAdminIds = await AdminStaffProfile.distinct("account_id", {
          position: "LGU Admin",
          municipality_id: targetProfile.municipality_id,
        });

        const remainingActiveInMunicipality = await Account.countDocuments({
          role: "lgu_admin",
          is_active: true,
          account_id: { $ne: accountId, $in: sameMunicipalityAdminIds },
        });

        if (remainingActiveInMunicipality < 1) {
          res.status(400);
          throw new Error(
            "Cannot deactivate this LGU admin. Each municipality must have at least one active LGU admin."
          );
        }
      } else {
        const remainingActiveLguAdmins = await Account.countDocuments({
          role: "lgu_admin",
          is_active: true,
          account_id: { $ne: accountId },
        });

        if (remainingActiveLguAdmins < 1) {
          res.status(400);
          throw new Error("Cannot deactivate the last active LGU admin account.");
        }
      }
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

    const { estId } = req.params;
    try {
      await resolveOwnerEstablishmentScope({ accountId, estId });
    } catch (scopeErr) {
      if (scopeErr?.statusCode) res.status(scopeErr.statusCode);
      throw scopeErr;
    }

    return listFeedbackForEstablishment(req, res, next);
  } catch (err) {
    next(err);
  }
};

export const getOwnerEstablishmentActivity = async (req, res, next) => {
  try {
    const accountId = req.user?.account_id;
    if (!accountId) {
      res.status(401);
      throw new Error("Unauthorized");
    }

    const { estId } = req.params;
    let access;
    try {
      access = await resolveOwnerEstablishmentScope({ accountId, estId });
    } catch (scopeErr) {
      if (scopeErr?.statusCode) res.status(scopeErr.statusCode);
      throw scopeErr;
    }
    const est = access.establishment;
    if (!est) {
      res.status(404);
      throw new Error("Establishment not found");
    }

    let ownerProfile = access.ownerProfile || null;
    if (!ownerProfile && est.business_establishment_profile_id) {
      ownerProfile = await BusinessEstablishmentProfile.findOne({
        business_establishment_profile_id: est.business_establishment_profile_id,
      })
        .select("business_establishment_profile_id account_id full_name contact_no role municipality_id")
        .lean();
    }

    const accountIds = [
      ownerProfile?.account_id,
      est.establishment_account_id,
    ].filter(Boolean);

    const accounts = await Account.find({
      account_id: { $in: accountIds },
      role: "business_establishment",
    })
      .select("account_id username email is_active must_change_password createdAt")
      .lean();

    const accountById = accounts.reduce((acc, item) => {
      acc[item.account_id] = item;
      return acc;
    }, {});

    const ownerAccount = ownerProfile?.account_id ? accountById[ownerProfile.account_id] || null : null;
    const establishmentAccount = est.establishment_account_id
      ? accountById[est.establishment_account_id] || null
      : null;

    const approvals = await EstablishmentApproval.find({
      businessEstablishment_id: est.businessEstablishment_id,
    })
      .sort({ action_date: -1 })
      .lean();

    const adminProfileIds = approvals.map((item) => item.admin_staff_profile_id).filter(Boolean);
    const adminProfiles = await AdminStaffProfile.find({
      admin_staff_profile_id: { $in: adminProfileIds },
    })
      .select("admin_staff_profile_id full_name position")
      .lean();
    const adminById = adminProfiles.reduce((acc, item) => {
      acc[item.admin_staff_profile_id] = item;
      return acc;
    }, {});

    const activity = [];

    if (establishmentAccount?.createdAt) {
      activity.push({
        type: "account_created",
        title: "Establishment account generated",
        detail: `Username: ${establishmentAccount.username || "-"}`,
        at: establishmentAccount.createdAt,
      });
    }

    if (est.createdAt) {
      activity.push({
        type: "establishment_created",
        title: "Establishment registered by LGU",
        detail: est.name || "-",
        at: est.createdAt,
      });
    }

    approvals.forEach((item) => {
      const actor = item.admin_staff_profile_id ? adminById[item.admin_staff_profile_id] : null;
      activity.push({
        type: "approval_event",
        title: `Status: ${item.approval_status || item.action || "updated"}`,
        detail: item.remarks || "No remarks provided.",
        action: item.action || null,
        approval_status: item.approval_status || null,
        actor_name: actor?.full_name || null,
        actor_position: actor?.position || null,
        at: item.action_date || item.updatedAt || item.createdAt || null,
      });
    });

    activity.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

    const notifications = [];
    if (est.status === "needs_owner_revision") {
      notifications.push({
        level: "warning",
        message: "LGU requested updates. Please review remarks and submit required changes.",
      });
    }
    if (est.status === "approved") {
      notifications.push({
        level: "success",
        message: "Establishment is approved.",
      });
    }
    if (establishmentAccount?.must_change_password) {
      notifications.push({
        level: "info",
        message: "Temporary password is active. Change the password after first login.",
      });
    }

    res.json({
      establishment: {
        businessEstablishment_id: est.businessEstablishment_id,
        name: est.name,
        status: est.status,
        municipality_id: est.municipality_id,
        createdAt: est.createdAt,
        updatedAt: est.updatedAt,
      },
      owner_profile: ownerProfile || null,
      owner_account: ownerAccount,
      establishment_account: establishmentAccount,
      account_login_url: getAdminLoginUrl(),
      notifications,
      activity,
    });
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


