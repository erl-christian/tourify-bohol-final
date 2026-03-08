import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../src/config/database.js";
import Account from "../src/models/Account.js";

dotenv.config();

const slugify = value =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 48);

const baseFromAccount = account => {
  const fromEmail = slugify(String(account.email || "").split("@")[0]);
  if (fromEmail) return fromEmail;
  const accountTail = String(account.account_id || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  return accountTail ? `tourist.${accountTail}` : "tourist.user";
};

const pickUniqueUsername = (base, usedSet) => {
  let candidate = base || "tourist.user";
  let suffix = 1;
  while (usedSet.has(candidate)) {
    candidate = `${base}.${suffix}`;
    suffix += 1;
  }
  usedSet.add(candidate);
  return candidate;
};

const run = async () => {
  try {
    await connectDB();

    const existing = await Account.find({ username: { $exists: true, $ne: null, $ne: "" } })
      .select("username")
      .lean();
    const used = new Set(existing.map(row => String(row.username).trim().toLowerCase()));

    const tourists = await Account.find({
      role: "tourist",
      $or: [{ username: { $exists: false } }, { username: null }, { username: "" }],
    })
      .select("_id account_id email username")
      .lean();

    let updated = 0;
    for (const account of tourists) {
      const base = baseFromAccount(account);
      const username = pickUniqueUsername(base, used);
      await Account.updateOne({ _id: account._id }, { $set: { username } });
      updated += 1;
    }

    console.log(`Tourist username migration complete. Updated ${updated} account(s).`);
  } catch (error) {
    console.error("Tourist username migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
