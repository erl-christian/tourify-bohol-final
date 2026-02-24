import jwt from 'jsonwebtoken';
import Account from '../models/Account.js';
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
              <p style="margin:0;font-size:14px;color:#475569;line-height:1.5;">If you didn’t request this, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid rgba(108,92,231,0.12);font-size:12px;color:#94a3b8;text-align:center;">
              Tourify Bohol · This is an automated message—please do not reply.
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
              <p style="margin:0;font-size:14px;color:#475569;line-height:1.5;">If you didn’t request this, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid rgba(108,92,231,0.12);font-size:12px;color:#94a3b8;text-align:center;">
              Tourify Bohol · This is an automated message—please do not reply.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
`;

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
    const { email, password } = req.body;
    const acc = await Account.findOne({ email });
    if (!acc) {
      res.status(401);
      throw new Error('Invalid credentials');
    }

    const ok = await acc.comparePassword(password);
    if (!ok) {
      res.status(401);
      throw new Error('Invalid credentials');
    }

    if (acc.is_active === false) {
      res.status(403);
      throw new Error('Account is deactivated. Please contact BTO support.');
    }

    const token = signAuthToken(acc);
    res.json({
      message: 'Logged in',
      account: {
        id: acc._id,
        account_id: acc.account_id,
        email: acc.email,
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
