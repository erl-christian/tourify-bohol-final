import jwt from "jsonwebtoken"
import Account from "../models/Account.js"

export const auth = async (req, res, next) => {
  try {
    // Get "Authorization" header
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;

    if (!token) {
      res.status(401);
      throw new Error("Missing token");
    }

    // Verify the token using the secret key
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev_secret_change_me");

    // Find the account from token's payload
    const acc = await Account.findById(payload.sub);
    if (!acc) {
      res.status(401);
      throw new Error("Invalid token: account not found");
    }

    // Attach account data to the request for next functions
    req.user = {
      _id: acc._id,
      role: acc.role,
      account_id: acc.account_id,
      email: acc.email
    };

    next(); // move to the next middleware or controller
  } catch (err) {
    next(err);
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