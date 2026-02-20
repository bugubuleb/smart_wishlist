import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { hashPassword, signAccessToken, verifyPassword } from "../services/auth.js";
import { getSupportedCurrencies, isSupportedCurrency } from "../services/currency.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(80),
  username: z.string().trim().min(3).max(60).regex(/^[a-zA-Z0-9_]+$/),
});

const languageSchema = z.object({
  language: z.enum(["ru", "en"]),
});

const currencySchema = z.object({
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(255).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8),
}).refine((value) => Boolean(value.identifier || value.email), {
  message: "Identifier is required",
});

const lookupUsernameSchema = z.object({
  username: z.string().trim().min(3).max(60).regex(/^[a-zA-Z0-9_]+$/),
});

export const authRouter = Router();

authRouter.post("/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  const { email, password, displayName, username } = parsed.data;
  const normalizedUsername = username.toLowerCase();

  const exists = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (exists.rowCount) return res.status(409).json({ message: "Email already exists" });

  const usernameExists = await pool.query("SELECT id FROM users WHERE LOWER(username) = $1", [normalizedUsername]);
  if (usernameExists.rowCount) return res.status(409).json({ message: "Username already exists" });

  const passwordHash = await hashPassword(password);
  const created = await pool.query(
    `INSERT INTO users (email, password_hash, display_name, username)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, display_name, username, preferred_language, preferred_currency`,
    [email, passwordHash, displayName, normalizedUsername],
  );

  const user = created.rows[0];
  const accessToken = signAccessToken({ userId: user.id, email: user.email, username: user.username });

  res.status(201).json({
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      username: user.username,
      preferredLanguage: user.preferred_language,
      preferredCurrency: user.preferred_currency,
    },
  });
});

authRouter.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  const loginIdentifier = String(parsed.data.identifier || parsed.data.email || "").trim().toLowerCase();
  const { password } = parsed.data;
  const result = await pool.query(
    `SELECT id, email, password_hash, display_name, username, preferred_language, preferred_currency
     FROM users
     WHERE LOWER(email) = $1 OR LOWER(username) = $1
     LIMIT 1`,
    [loginIdentifier],
  );

  if (!result.rowCount) return res.status(401).json({ message: "Invalid credentials" });

  const user = result.rows[0];
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const accessToken = signAccessToken({ userId: user.id, email: user.email, username: user.username });

  res.json({
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      username: user.username,
      preferredLanguage: user.preferred_language,
      preferredCurrency: user.preferred_currency,
    },
  });
});

authRouter.get("/auth/me", requireAuth, async (req, res) => {
  const userResult = await pool.query(
    "SELECT id, email, display_name, username, preferred_language, preferred_currency FROM users WHERE id = $1",
    [req.user.userId],
  );

  if (!userResult.rowCount) return res.status(404).json({ message: "User not found" });

  const user = userResult.rows[0];
  return res.json({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    username: user.username,
    preferredLanguage: user.preferred_language,
    preferredCurrency: user.preferred_currency,
  });
});

authRouter.patch("/auth/language", requireAuth, async (req, res) => {
  const parsed = languageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid language" });

  const updated = await pool.query(
    `UPDATE users
     SET preferred_language = $2
     WHERE id = $1
     RETURNING id, preferred_language`,
    [req.user.userId, parsed.data.language],
  );

  if (!updated.rowCount) return res.status(404).json({ message: "User not found" });

  return res.json({
    id: updated.rows[0].id,
    preferredLanguage: updated.rows[0].preferred_language,
  });
});

authRouter.patch("/auth/currency", requireAuth, async (req, res) => {
  const parsed = currencySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid currency" });
  if (!isSupportedCurrency(parsed.data.currency)) {
    return res.status(400).json({ message: "Unsupported currency" });
  }

  const updated = await pool.query(
    `UPDATE users
     SET preferred_currency = $2
     WHERE id = $1
     RETURNING id, preferred_currency`,
    [req.user.userId, parsed.data.currency],
  );

  if (!updated.rowCount) return res.status(404).json({ message: "User not found" });
  return res.json({
    id: updated.rows[0].id,
    preferredCurrency: updated.rows[0].preferred_currency,
  });
});

authRouter.get("/auth/currencies", (_req, res) => {
  return res.json({ currencies: getSupportedCurrencies() });
});

authRouter.get("/auth/lookup-user", requireAuth, async (req, res) => {
  const parsed = lookupUsernameSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Invalid username" });

  const lookup = await pool.query(
    "SELECT id, username, display_name FROM users WHERE LOWER(username) = $1 LIMIT 1",
    [parsed.data.username.toLowerCase()],
  );

  if (!lookup.rowCount) return res.json({ found: false });

  const user = lookup.rows[0];
  return res.json({
    found: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
    },
  });
});
