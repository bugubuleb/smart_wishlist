import { Router } from "express";
import { z } from "zod";

import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { createNotificationLocalized, getPushDiagnostics } from "../services/notifications.js";

const preferencesSchema = z.object({
  inAppEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  wishlistSharedEnabled: z.boolean().optional(),
  reservationEnabled: z.boolean().optional(),
  fundedEnabled: z.boolean().optional(),
  friendRequestsEnabled: z.boolean().optional(),
});

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const notificationRouter = Router();

async function ensurePreferences(userId) {
  await pool.query(
    `INSERT INTO notification_preferences (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

notificationRouter.get("/notifications/vapid-public-key", requireAuth, async (_req, res) => {
  if (!env.vapidPublicKey) return res.json({ vapidPublicKey: null });
  return res.json({ vapidPublicKey: env.vapidPublicKey });
});

notificationRouter.get("/notifications/preferences", requireAuth, async (req, res) => {
  await ensurePreferences(req.user.userId);
  const prefs = await pool.query(
    `SELECT in_app_enabled, push_enabled, wishlist_shared_enabled, reservation_enabled, funded_enabled, friend_requests_enabled
     FROM notification_preferences
     WHERE user_id = $1`,
    [req.user.userId],
  );
  return res.json({
    inAppEnabled: prefs.rows[0].in_app_enabled,
    pushEnabled: prefs.rows[0].push_enabled,
    wishlistSharedEnabled: prefs.rows[0].wishlist_shared_enabled,
    reservationEnabled: prefs.rows[0].reservation_enabled,
    fundedEnabled: prefs.rows[0].funded_enabled,
    friendRequestsEnabled: prefs.rows[0].friend_requests_enabled,
  });
});

notificationRouter.patch("/notifications/preferences", requireAuth, async (req, res) => {
  const parsed = preferencesSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
  await ensurePreferences(req.user.userId);

  const current = await pool.query(
    `SELECT in_app_enabled, push_enabled, wishlist_shared_enabled, reservation_enabled, funded_enabled, friend_requests_enabled
     FROM notification_preferences
     WHERE user_id = $1`,
    [req.user.userId],
  );
  const row = current.rows[0];
  const next = {
    inAppEnabled: parsed.data.inAppEnabled ?? row.in_app_enabled,
    pushEnabled: parsed.data.pushEnabled ?? row.push_enabled,
    wishlistSharedEnabled: parsed.data.wishlistSharedEnabled ?? row.wishlist_shared_enabled,
    reservationEnabled: parsed.data.reservationEnabled ?? row.reservation_enabled,
    fundedEnabled: parsed.data.fundedEnabled ?? row.funded_enabled,
    friendRequestsEnabled: parsed.data.friendRequestsEnabled ?? row.friend_requests_enabled,
  };

  await pool.query(
    `UPDATE notification_preferences
     SET in_app_enabled = $2,
         push_enabled = $3,
         wishlist_shared_enabled = $4,
         reservation_enabled = $5,
         funded_enabled = $6,
         friend_requests_enabled = $7,
         updated_at = NOW()
     WHERE user_id = $1`,
    [
      req.user.userId,
      next.inAppEnabled,
      next.pushEnabled,
      next.wishlistSharedEnabled,
      next.reservationEnabled,
      next.fundedEnabled,
      next.friendRequestsEnabled,
    ],
  );

  return res.json(next);
});

notificationRouter.post("/notifications/subscribe", requireAuth, async (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid subscription" });
  await ensurePreferences(req.user.userId);

  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id, endpoint) DO UPDATE
     SET p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         updated_at = NOW()`,
    [req.user.userId, parsed.data.endpoint, parsed.data.keys.p256dh, parsed.data.keys.auth],
  );

  return res.status(201).json({ ok: true });
});

notificationRouter.post("/notifications/unsubscribe", requireAuth, async (req, res) => {
  const parsed = z.object({ endpoint: z.string().url() }).safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  await pool.query(
    `DELETE FROM push_subscriptions
     WHERE user_id = $1 AND endpoint = $2`,
    [req.user.userId, parsed.data.endpoint],
  );
  return res.json({ ok: true });
});

notificationRouter.get("/notifications", requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT id, type, title, body, link_url, data_json, is_read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [req.user.userId],
  );
  const unread = await pool.query(
    `SELECT COUNT(*)::int AS unread_count
     FROM notifications
     WHERE user_id = $1 AND is_read = false`,
    [req.user.userId],
  );
  return res.json({
    notifications: result.rows,
    unreadCount: Number(unread.rows[0].unread_count || 0),
  });
});

notificationRouter.post("/notifications/read-all", requireAuth, async (req, res) => {
  await pool.query(
    `UPDATE notifications
     SET is_read = true
     WHERE user_id = $1 AND is_read = false`,
    [req.user.userId],
  );
  return res.json({ ok: true });
});

notificationRouter.post("/notifications/:id/read", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Invalid notification id" });
  }

  await pool.query(
    `UPDATE notifications
     SET is_read = true
     WHERE id = $1 AND user_id = $2`,
    [id, req.user.userId],
  );
  return res.json({ ok: true });
});

notificationRouter.get("/notifications/push-status", requireAuth, async (req, res) => {
  const status = await getPushDiagnostics(req.user.userId);
  return res.json(status);
});

notificationRouter.post("/notifications/test-push", requireAuth, async (req, res) => {
  await createNotificationLocalized({
    userId: req.user.userId,
    preferenceColumn: "true",
    type: "push.test",
    link: "/notifications",
    data: { source: "test" },
    texts: {
      ru: {
        title: "Тест push-уведомления",
        body: "Если ты видишь это, push работает корректно.",
      },
      en: {
        title: "Push test notification",
        body: "If you see this, push is working correctly.",
      },
    },
  });
  const status = await getPushDiagnostics(req.user.userId);
  return res.json({ ok: true, status });
});
