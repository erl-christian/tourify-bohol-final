import jwt from "jsonwebtoken"
import Account from "../models/Account.js"

const resolveAuth = async req => {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return null;

  const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret_change_me");
  const acc = await Account.findById(payload.sub);
  if (!acc) {
    throw new Error("Invalid token: account not found");
  }

  return {
    _id: acc._id,
    role: acc.role,
    account_id: acc.account_id,
    email: acc.email,
  };
};

export const auth = async (req, res, next) => {
  try {
    const user = await resolveAuth(req);
    if (!user) {
      res.status(401);
      throw new Error("Missing token");
    }

    req.user = user;
    next(); // move to the next middleware or controller
  } catch (err) {
    next(err);
  }
};

export const optionalAuth = async (req, _res, next) => {
  try {
    req.user = await resolveAuth(req);
    next();
  } catch (_err) {
    // Keep endpoint public even when token is invalid/missing.
    req.user = null;
    next();
  }
};

//restict specific roles
export const requireRoles = (...allowed) => {
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      res.status(403);
      return next(new Error("Forbidden: you don’t have permission"));
    }
    next();
  };
};
