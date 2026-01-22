export function getMongoUri() {
  const source = (process.env.DB_SOURCE || "").toLowerCase();
  if (source === "local") return process.env.MONGO_URI_LOCAL || process.env.MONGO_URI;
  if (source === "atlas") return process.env.MONGO_URI;
  return process.env.MONGO_URI;
}
