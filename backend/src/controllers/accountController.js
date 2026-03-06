import jwt from 'jsonwebtoken';
import Account from '../models/Account.js';
import AdminStaffProfile from '../models/adminModels/AdminStaffProfile.js';
import BusinessEstablishmentProfile from '../models/businessEstablishmentModels/BusinessEstablishmentProfile.js';
import { sendMail } from '../services/mailer.js';

const APP_BASE = process.env.APP_BASE_URL || 'http://192.168.1.7:8081'; // unused in OTP flow, kept for reference
const AUTH_EXPIRY = '7d';

const VERIFY_PURPOSE = 'email_verify';
const VERIFY_EXPIRY = '30m';

const RESET_PURPOSE = 'password_reset';
const RESET_EXPIRY = '15m';

const signAuthToken = acc =>
  jwt.sign(
    { sub: acc._id.toString(), role: acc.role, account_id: acc.account_id },
    process.env.JWT_SECRET || 'dev_secret_change_me',
    { expiresIn: AUTH_EXPIRY }
  );

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const signVerifyToken = (acc, otp) =>
  jwt.sign(
    { sub: acc._id.toString(), purpose: VERIFY_PURPOSE, otp },
    process.env.JWT_SECRET || 'dev_secret_change_me',
    { expiresIn: VERIFY_EXPIRY }
  );

const signResetOtpToken = (acc, otp) =>
  jwt.sign(
    { sub: acc._id.toString(), purpose: RESET_PURPOSE, otp },
    process.env.JWT_SECRET || 'dev_secret_change_me',
    { expiresIn: RESET_EXPIRY }
  );

const buildVerifyHtml = otp => `
<!doctype html>
<html>
  <head><meta name="color-scheme" content="light" /></head>
  <body style="margin:0;padding:0;background:#f4f6ff;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6ff;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid rgba(108,92,231,0.15);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#6c5ce7,#5a4ad2);padding:20px 24px;color:#fff;font-size:20px;font-weight:700;">
              Tourify Bohol
            </td>
          </tr>
          <tr>
            <td style="padding:24px;color:#0f172a;">
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;">Verify your email</h1>
              <p style="margin:0 0 16px;font-size:15px;color:#475569;">Use the code below to verify your email. This code expires in 30 minutes.</p>
              <div style="text-align:center;margin:24px 0;">
                <div style="display:inline-block;padding:14px 20px;border-radius:12px;background:rgba(108,92,231,0.08);border:1px dashed rgba(108,92,231,0.35);font-size:24px;letter-spacing:4px;font-weight:700;color:#5a4ad2;">
                  ${otp}
                </div>
              </div>
              <p style="margin:0;font-size:14px;color:#475569;line-height:1.5;">If you didnâ€™t request this, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid rgba(108,92,231,0.12);font-size:12px;color:#94a3b8;text-align:center;">
              Tourify Bohol Â· This is an automated messageâ€”please do not reply.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
`;

const buildResetOtpHtml = otp => `
<!doctype html>
<html>
  <head><meta name="color-scheme" content="light" /></head>
  <body style="margin:0;padding:0;background:#f4f6ff;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6ff;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid rgba(108,92,231,0.15);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#6c5ce7,#5a4ad2);padding:20px 24px;color:#fff;font-size:20px;font-weight:700;">
              Tourify Bohol
            </td>
          </tr>
          <tr>
            <td style="padding:24px;color:#0f172a;">
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;">Reset your password</h1>
              <p style="margin:0 0 16px;font-size:15px;color:#475569;">Use this code to reset your password. It expires in 15 minutes.</p>
              <div style="text-align:center;margin:24px 0;">
                <div style="display:inline-block;padding:14px 20px;border-radius:12px;background:rgba(108,92,231,0.08);border:1px dashed rgba(108,92,231,0.35);font-size:24px;letter-spacing:4px;font-weight:700;color:#5a4ad2;">
                  ${otp}
                </div>
              </div>
              <p style="margin:0;font-size:14px;color:#475569;line-height:1.5;">If you didnâ€™t request this, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid rgba(108,92,231,0.12);font-size:12px;color:#94a3b8;text-align:center;">
              Tourify Bohol Â· This is an automated messageâ€”please do not reply.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
`;

const USERNAME_REGEX = /^[a-z0-9._@-]{4,64}$/;
const SELF_MANAGE_ROLES = new Set([
  'bto_admin',
  'bto_staff',
  'lgu_admin',
  'lgu_staff',
  'business_establishment',
]);

const BTO_ROLES = new Set(['bto_admin', 'bto_staff']);

const defaultPositionByRole = role => {
  if (role === 'bto_admin') return 'BTO Admin';
  if (role === 'bto_staff') return 'BTO Staff';
  if (role === 'lgu_admin') return 'LGU Admin';
  if (role === 'lgu_staff') return 'LGU Staff';
  if (role === 'business_establishment') return 'Owner';
  return '';
};

const toPlain = doc =>
  doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;

async function findOrCreateAdminProfileForSelf(acc, overrides = {}) {
  let profile = await AdminStaffProfile.findOne({ account_id: acc.account_id });
  if (profile) return profile;

  if (!BTO_ROLES.has(acc.role)) return null;

  const seededName =
    String(overrides.full_name ?? '').trim() ||
    String(acc.username ?? '').trim() ||
    String(acc.email ?? '').trim() ||
    defaultPositionByRole(acc.role);

  profile = await AdminStaffProfile.create({
    account_id: acc.account_id,
    municipality_id: 'Bohol',
    full_name: seededName,
    position: defaultPositionByRole(acc.role),
    contact_no:
      overrides.contact_no !== undefined
        ? String(overrides.contact_no ?? '').trim()
        : undefined,
  });

  return profile;
}


// GET /api/accounts/me
export const getMyAccount = async (req, res, next) => {
  try {
    const accountObjectId = req.user?._id;
    if (!accountObjectId) {
      res.status(401);
      throw new Error('Unauthorized');
    }

    const acc = await Account.findById(accountObjectId)
      .select('account_id email username role is_active must_change_password')
      .lean();

    if (!acc) {
      res.status(404);
      throw new Error('Account not found');
    }

    if (!SELF_MANAGE_ROLES.has(acc.role)) {
      res.status(403);
      throw new Error('Role is not allowed for this account settings endpoint');
    }

    let profile = null;

    if (['bto_admin', 'bto_staff', 'lgu_admin', 'lgu_staff'].includes(acc.role)) {
      const adminProfile = await findOrCreateAdminProfileForSelf(acc);
      if (!adminProfile && ['lgu_admin', 'lgu_staff'].includes(acc.role)) {
        res.status(404);
        throw new Error('Admin/staff profile not found');
      }
      profile = toPlain(adminProfile);
    } else if (acc.role === 'business_establishment') {
      profile = await BusinessEstablishmentProfile.findOne({ account_id: acc.account_id })
        .select('full_name contact_no municipality_id role')
        .lean();
    }

    const municipality =
      BTO_ROLES.has(acc.role) ? 'Bohol' : profile?.municipality_id ?? '';

    const position =
      profile?.position ?? profile?.role ?? defaultPositionByRole(acc.role);

    res.json({
      account: {
        account_id: acc.account_id,
        role: acc.role,
        username: acc.username ?? '',
        email: acc.email,
        is_active: acc.is_active,
        must_change_password: acc.must_change_password,
      },
      profile: {
        full_name: profile?.full_name ?? '',
        contact_no: profile?.contact_no ?? '',
        municipality_id: municipality,
        position,
      },
      editable_fields: ['username', 'full_name', 'contact_no', 'password'],
      locked_fields: ['municipality_id', 'position'],
    });
  } catch (err) {
    next(err);
  }
};


// PATCH /api/accounts/me
// body: { username?, full_name?, contact_no? }
// locked: municipality_id, position
export const updateMyAccount = async (req, res, next) => {
  try {
    const accountObjectId = req.user?._id;
    if (!accountObjectId) {
      res.status(401);
      throw new Error('Unauthorized');
    }

    const { username, full_name, contact_no, municipality_id, position } = req.body;

    if (municipality_id !== undefined || position !== undefined) {
      res.status(400);
      throw new Error('municipality_id and position are not editable by account owner');
    }

    const hasAnyUpdatable =
      username !== undefined || full_name !== undefined || contact_no !== undefined;

    if (!hasAnyUpdatable) {
      res.status(400);
      throw new Error('Provide at least one editable field: username, full_name, contact_no');
    }

    const acc = await Account.findById(accountObjectId);
    if (!acc) {
      res.status(404);
      throw new Error('Account not found');
    }

    if (!SELF_MANAGE_ROLES.has(acc.role)) {
      res.status(403);
      throw new Error('Role is not allowed to self-update on this endpoint');
    }

    if (username !== undefined) {
      const normalizedUsername = String(username).trim().toLowerCase();
      const currentUsername = String(acc.username ?? '').trim().toLowerCase();

      if (!normalizedUsername) {
        res.status(400);
        throw new Error('username cannot be empty');
      }

      const isChangingUsername = normalizedUsername !== currentUsername;

      if (isChangingUsername && !USERNAME_REGEX.test(normalizedUsername)) {
        res.status(400);
        throw new Error('Invalid username format');
      }

      if (isChangingUsername) {
        const duplicate = await Account.findOne({
          username: normalizedUsername,
          account_id: { $ne: acc.account_id },
        });

        if (duplicate) {
          res.status(409);
          throw new Error('Username already in use');
        }

        acc.username = normalizedUsername;
      }
    }

    let profile = null;

    if (['bto_admin', 'bto_staff', 'lgu_admin', 'lgu_staff'].includes(acc.role)) {
      let adminProfile = await findOrCreateAdminProfileForSelf(acc, { full_name, contact_no });

      if (!adminProfile) {
        res.status(404);
        throw new Error('Admin/staff profile not found');
      }

      if (BTO_ROLES.has(acc.role)) {
        adminProfile.municipality_id = 'Bohol';
        adminProfile.position = defaultPositionByRole(acc.role);
      }

      if (full_name !== undefined) {
        const value = String(full_name).trim();
        if (!value) {
          res.status(400);
          throw new Error('full_name cannot be empty');
        }
        adminProfile.full_name = value;
      }

      if (contact_no !== undefined) {
        adminProfile.contact_no = String(contact_no ?? '').trim();
      }

      await adminProfile.save();
      profile = toPlain(adminProfile);
    } else if (acc.role === 'business_establishment') {
      const ownerProfile = await BusinessEstablishmentProfile.findOne({ account_id: acc.account_id });
      if (!ownerProfile) {
        res.status(404);
        throw new Error('Owner profile not found');
      }

      if (full_name !== undefined) {
        const value = String(full_name).trim();
        if (!value) {
          res.status(400);
          throw new Error('full_name cannot be empty');
        }
        ownerProfile.full_name = value;
      }

      if (contact_no !== undefined) {
        ownerProfile.contact_no = String(contact_no ?? '').trim();
      }

      await ownerProfile.save();
      profile = toPlain(ownerProfile);
    }

    await acc.save();

    const municipality =
      BTO_ROLES.has(acc.role) ? 'Bohol' : profile?.municipality_id ?? '';

    const resolvedPosition =
      profile?.position ?? profile?.role ?? defaultPositionByRole(acc.role);

    res.json({
      message: 'Account updated successfully.',
      account: {
        account_id: acc.account_id,
        role: acc.role,
        username: acc.username ?? '',
        email: acc.email,
      },
      profile: {
        full_name: profile?.full_name ?? '',
        contact_no: profile?.contact_no ?? '',
        municipality_id: municipality,
        position: resolvedPosition,
      },
    });
  } catch (err) {
    next(err);
  }
};


// PATCH /api/accounts/me/password
// body: { currentPassword, newPassword, confirmPassword }
export const changeMyPassword = async (req, res, next) => {
  try {
    const accountObjectId = req.user?._id;
    if (!accountObjectId) {
      res.status(401);
      throw new Error('Unauthorized');
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      res.status(400);
      throw new Error('currentPassword, newPassword, and confirmPassword are required');
    }

    if (newPassword.length < 8) {
      res.status(400);
      throw new Error('Password must be at least 8 characters');
    }

    if (newPassword !== confirmPassword) {
      res.status(400);
      throw new Error('Passwords do not match');
    }

    const acc = await Account.findById(accountObjectId);
    if (!acc) {
      res.status(404);
      throw new Error('Account not found');
    }

    if (!SELF_MANAGE_ROLES.has(acc.role)) {
      res.status(403);
      throw new Error('Role is not allowed to change password on this endpoint');
    }

    const matchesCurrent = await acc.comparePassword(currentPassword);
    if (!matchesCurrent) {
      res.status(401);
      throw new Error('Current password is incorrect');
    }

    const sameAsOld = await acc.comparePassword(newPassword);
    if (sameAsOld) {
      res.status(400);
      throw new Error('New password must be different from current password');
    }

    acc.password = newPassword;
    acc.must_change_password = false;
    await acc.save();

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
};


// POST /api/accounts/register
export const registerAccount = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      res.status(400);
      throw new Error('Email and password are required');
    }

    const exists = await Account.findOne({ email });
    if (exists) {
      res.status(409);
      throw new Error('Email already registered');
    }

    const acc = await Account.create({ email, password, role });
    const token = signAuthToken(acc);

    const otp = generateOtp();
    const verifyToken = signVerifyToken(acc, otp);
    const verifyHtml = buildVerifyHtml(otp);

    sendMail({
      to: acc.email,
      subject: 'Your Tourify Bohol verification code',
      html: verifyHtml,
    }).catch(err => console.warn('Email send failed (verify):', err.message));

    res.status(201).json({
      message: 'Account created',
      account: {
        id: acc._id,
        account_id: acc.account_id,
        email: acc.email,
        role: acc.role,
        email_verified: acc.email_verified,
      },
      token,
      verifyToken, // used with OTP
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/accounts/login
export const loginAccount = async (req, res, next) => {
  try {
    const { identifier, username, email, password } = req.body;
    const raw = identifier ?? username ?? email;

    if (!raw || !password) {
      res.status(400);
      throw new Error("Identifier and password are required");
    }

    const normalized = String(raw).trim().toLowerCase();

    const acc = await Account.findOne({
      $or: [{ username: normalized }, { email: normalized }],
    });

    if (!acc) {
      res.status(401);
      throw new Error("Invalid credentials");
    }

    const adminRoles = new Set([
      "bto_admin",
      "bto_staff",
      "lgu_admin",
      "lgu_staff",
      "business_establishment",
    ]);

    if (adminRoles.has(acc.role) && acc.username && acc.username !== normalized) {
      res.status(401);
      throw new Error("Use your username to log in");
    }

    const ok = await acc.comparePassword(password);
    if (!ok) {
      res.status(401);
      throw new Error("Invalid credentials");
    }

    if (acc.is_active === false) {
      res.status(403);
      throw new Error("Account is deactivated. Please contact BTO support.");
    }

    let fullName = null;

    if (['bto_admin', 'bto_staff', 'lgu_admin', 'lgu_staff'].includes(acc.role)) {
      const adminProfile = await AdminStaffProfile.findOne({ account_id: acc.account_id })
        .select('full_name')
        .lean();
      fullName = adminProfile?.full_name || null;
    } else if (acc.role === 'business_establishment') {
      const ownerProfile = await BusinessEstablishmentProfile.findOne({ account_id: acc.account_id })
        .select('full_name')
        .lean();
      fullName = ownerProfile?.full_name || null;
    }


    const token = signAuthToken(acc);
    res.json({
      message: "Logged in",
      account: {
        id: acc._id,
        account_id: acc.account_id,
        email: acc.email,
        username: acc.username ?? null,
        full_name: fullName,
        role: acc.role,
        email_verified: acc.email_verified,
        must_change_password: acc.must_change_password,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
};


export const changePasswordFirstLogin = async (req, res, next) => {
  try {
    const accountObjectId = req.user?._id;
    if (!accountObjectId) {
      res.status(401);
      throw new Error('Unauthorized');
    }

    const { newPassword, confirmPassword } = req.body;
    if (!newPassword || !confirmPassword) {
      res.status(400);
      throw new Error('newPassword and confirmPassword are required');
    }

    if (newPassword.length < 8) {
      res.status(400);
      throw new Error('Password must be at least 8 characters');
    }

    if (newPassword !== confirmPassword) {
      res.status(400);
      throw new Error('Passwords do not match');
    }

    const acc = await Account.findById(accountObjectId);
    if (!acc) {
      res.status(404);
      throw new Error('Account not found');
    }

    if (!acc.must_change_password) {
      res.status(409);
      throw new Error('First-login password change is not required for this account');
    }

    const sameAsOld = await acc.comparePassword(newPassword);
    if (sameAsOld) {
      res.status(400);
      throw new Error('New password must be different from temporary password');
    }

    acc.password = newPassword; // hashed by pre-save hook
    acc.must_change_password = false;
    await acc.save();

    res.json({ message: 'Password updated. You may now continue.' });
  } catch (err) {
    next(err);
  }
};


// GET /api/accounts
export const listAccounts = async (req, res, next) => {
  try {
    const accounts = await Account.find()
      .select('account_id email role email_verified createdAt updatedAt')
      .sort({ createdAt: -1 });
    res.json(accounts);
  } catch (err) {
    next(err);
  }
};

// POST /api/accounts/verify-email/request
export const requestEmailVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400);
      throw new Error('Email is required');
    }

    const acc = await Account.findOne({ email });
    if (!acc) {
      return res.json({ message: 'If that email exists, a verification code was sent.' });
    }
    if (acc.email_verified) {
      return res.json({ message: 'Email already verified.' });
    }

    const otp = generateOtp();
    const verifyToken = signVerifyToken(acc, otp);
    const verifyHtml = buildVerifyHtml(otp);

    sendMail({
      to: acc.email,
      subject: 'Your Tourify Bohol verification code',
      html: verifyHtml,
    }).catch(err => console.warn('Email send failed (verify):', err.message));

    res.json({
      message: 'If that email exists, a verification code was sent.',
      verifyToken, // submit with OTP
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/accounts/verify-email
// body: { otp: string, token: string }
export const verifyEmail = async (req, res, next) => {
  try {
    const { otp, token } = req.body;
    if (!otp || !token) {
      res.status(400);
      throw new Error('OTP and token are required');
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me');
    if (payload.purpose !== VERIFY_PURPOSE) {
      res.status(400);
      throw new Error('Invalid token');
    }
    if (payload.otp !== otp) {
      res.status(400);
      throw new Error('Invalid or expired code');
    }

    const acc = await Account.findById(payload.sub);
    if (!acc) {
      res.status(404);
      throw new Error('Account not found');
    }

    acc.email_verified = true;
    acc.email_verified_at = new Date();
    await acc.save();

    res.json({ message: 'Email verified' });
  } catch (err) {
    next(err);
  }
};

// POST /api/accounts/forgot-password
export const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400);
      throw new Error('Email is required');
    }

    const acc = await Account.findOne({ email });
    if (!acc) {
      return res.json({ message: 'If that email exists, a reset code was sent.' });
    }

    const otp = generateOtp();
    const resetOtpToken = signResetOtpToken(acc, otp);
    const resetHtml = buildResetOtpHtml(otp);

    sendMail({
      to: acc.email,
      subject: 'Your Tourify Bohol reset code',
      html: resetHtml,
    }).catch(err => console.warn('Email send failed (reset):', err.message));

    res.json({
      message: 'If that email exists, a reset code was sent.',
      resetToken: resetOtpToken, // submit with OTP + new password
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/accounts/reset-password
// body: { otp, token, newPassword }
export const resetPassword = async (req, res, next) => {
  try {
    const { otp, token, newPassword } = req.body;
    if (!otp || !token || !newPassword) {
      res.status(400);
      throw new Error('OTP, token, and newPassword are required');
    }
    if (newPassword.length < 8) {
      res.status(400);
      throw new Error('Password must be at least 8 characters');
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me');
    if (payload.purpose !== RESET_PURPOSE) {
      res.status(400);
      throw new Error('Invalid reset token');
    }
    if (payload.otp !== otp) {
      res.status(400);
      throw new Error('Invalid or expired code');
    }

    const acc = await Account.findById(payload.sub);
    if (!acc) {
      res.status(404);
      throw new Error('Account not found');
    }

    acc.password = newPassword; // hashed by pre-save hook
    await acc.save();

    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
};

