import dotenv from "dotenv";

dotenv.config();

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function parseCorsOrigins(raw) {
  const input = String(raw || "http://localhost:3000");
  return input
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 8000),
  databaseUrl: process.env.DATABASE_URL || "postgresql://wishlist:wishlist@localhost:5432/wishlist",
  jwtSecret: process.env.JWT_SECRET || "change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN || "http://localhost:3000"),
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || "",
  vapidSubject: process.env.VAPID_SUBJECT || "",
};
