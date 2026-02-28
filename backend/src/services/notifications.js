import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import { broadcast } from "../realtime/hub.js";

let webpushLib = null;
let webpushInitTried = false;
let webpushInitError = null;

const pushEnabled = Boolean(
  env.vapidPublicKey
  && env.vapidPrivateKey
  && env.vapidSubject,
);

async function ensureWebpushReady() {
  if (!pushEnabled || webpushLib || webpushInitTried) return Boolean(webpushLib);
  webpushInitTried = true;
  try {
    const module = await import("web-push");
    webpushLib = module.default || module;
    webpushLib.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
    webpushInitError = null;
    return true;
  } catch (error) {
    webpushInitError = error?.message || "web-push init failed";
    console.error("Web-push init failed:", webpushInitError);
    return false;
  }
}

export async function getPushDiagnostics(userId) {
  const webpushReady = await ensureWebpushReady();
  const prefs = await pool.query(
    `SELECT push_enabled
     FROM notification_preferences
     WHERE user_id = $1`,
    [userId],
  );
  const subscriptions = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM push_subscriptions
     WHERE user_id = $1`,
    [userId],
  );
  return {
    vapidConfigured: pushEnabled,
    webpushReady,
    webpushInitError,
    pushPreferenceEnabled: prefs.rowCount ? Boolean(prefs.rows[0].push_enabled) : true,
    subscriptionCount: Number(subscriptions.rows[0]?.count || 0),
  };
}

export async function createNotification({
  userId,
  type,
  title,
  body,
  link = "/",
  data = {},
  sendInApp = true,
  sendPush = true,
}) {
  const inserted = await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, link_url, data_json)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, user_id, type, title, body, link_url, data_json, is_read, created_at`,
    [userId, type, title, body, link, JSON.stringify(data || {})],
  );

  const notification = inserted.rows[0];
  if (sendInApp) {
    broadcast(`user:${userId}`, { type: "notification.created", notification });
  }

  const webpushReady = await ensureWebpushReady();
  if (!sendPush || !pushEnabled || !webpushReady) {
    return notification;
  }

  const prefs = await pool.query(
    `SELECT push_enabled
     FROM notification_preferences
     WHERE user_id = $1`,
    [userId],
  );
  const pushAllowed = prefs.rowCount ? Boolean(prefs.rows[0].push_enabled) : true;
  if (!pushAllowed) return notification;

  const payload = JSON.stringify({
    title,
    body,
    link,
    notificationId: notification.id,
    data,
  });
  const subscriptions = await pool.query(
    `SELECT id, endpoint, p256dh, auth
     FROM push_subscriptions
     WHERE user_id = $1`,
    [userId],
  );
  for (const sub of subscriptions.rows) {
    try {
      await webpushLib.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload,
      );
    } catch (error) {
      const code = Number(error?.statusCode || 0);
      if (code === 404 || code === 410) {
        await pool.query("DELETE FROM push_subscriptions WHERE id = $1", [sub.id]);
      } else {
        console.error("Push send failed:", {
          statusCode: error?.statusCode,
          message: error?.message,
          endpoint: String(sub.endpoint || "").slice(0, 120),
        });
      }
    }
  }

  return notification;
}

export async function createNotificationIfEnabled({
  userId,
  preferenceColumn,
  type,
  title,
  body,
  link = "/",
  data = {},
}) {
  await pool.query(
    `INSERT INTO notification_preferences (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
  const pref = await pool.query(
    `SELECT in_app_enabled, push_enabled, ${preferenceColumn || "true"} AS enabled
     FROM notification_preferences
     WHERE user_id = $1`,
    [userId],
  );
  const enabled = pref.rowCount ? Boolean(pref.rows[0].enabled) : true;
  if (!enabled) return null;
  const inAppEnabled = pref.rowCount ? Boolean(pref.rows[0].in_app_enabled) : true;
  const pushAllowed = pref.rowCount ? Boolean(pref.rows[0].push_enabled) : true;

  return createNotification({
    userId,
    type,
    title,
    body,
    link,
    data,
    sendInApp: inAppEnabled,
    sendPush: pushAllowed,
  });
}

export async function createNotificationLocalized({
  userId,
  preferenceColumn,
  type,
  texts,
  link = "/",
  data = {},
}) {
  const languageResult = await pool.query(
    `SELECT preferred_language
     FROM users
     WHERE id = $1`,
    [userId],
  );
  const lang = languageResult.rows[0]?.preferred_language === "ru" ? "ru" : "en";
  const localized = texts?.[lang] || texts?.en || texts?.ru;
  if (!localized?.title || !localized?.body) return null;

  return createNotificationIfEnabled({
    userId,
    preferenceColumn,
    type,
    title: localized.title,
    body: localized.body,
    link,
    data,
  });
}
