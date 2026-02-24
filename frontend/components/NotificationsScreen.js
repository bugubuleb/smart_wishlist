"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useLanguage } from "@/components/LanguageProvider";
import {
  getNotificationPreferences,
  getNotifications,
  getVapidPublicKey,
  markAllNotificationsRead,
  markNotificationRead,
  setNotificationPreferences,
  subscribePush,
  unsubscribePush,
} from "@/lib/api";
import { connectNotificationSocket } from "@/lib/realtime";
import { getToken } from "@/lib/session";

function toUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [prefs, setPrefs] = useState(null);
  const token = useMemo(() => getToken(), []);
  const { t } = useLanguage();

  useEffect(() => {
    if (!token) return undefined;

    getNotifications(token).then((data) => {
      setNotifications(data.notifications || []);
      const unread = Number(data.unreadCount || 0);
      setUnreadCount(unread);
      if (unread > 0) {
        markAllNotificationsRead(token).then(() => {
          setUnreadCount(0);
          setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
          window.dispatchEvent(new Event("notifications:read-all"));
        }).catch(() => {});
      } else {
        window.dispatchEvent(new Event("notifications:read-all"));
      }
    }).catch(() => {});

    getNotificationPreferences(token).then(setPrefs).catch(() => {});

    const socket = connectNotificationSocket(token, (event) => {
      if (event.type === "notification.created" && event.notification) {
        setNotifications((prev) => [{ ...event.notification, is_read: true }, ...prev].slice(0, 50));
        setUnreadCount(0);
        markAllNotificationsRead(token).catch(() => {});
        window.dispatchEvent(new Event("notifications:read-all"));
      }
    });
    return () => socket.close();
  }, [token]);

  async function togglePref(patch) {
    if (!token || !prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      await setNotificationPreferences(patch, token);
    } catch {
      setPrefs(prefs);
    }
  }

  async function togglePush(enabled) {
    if (!token || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const registration = await navigator.serviceWorker.ready;

    if (!enabled) {
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await unsubscribePush(existing.endpoint, token).catch(() => {});
        await existing.unsubscribe().catch(() => {});
      }
      return;
    }

    const keyResponse = await getVapidPublicKey(token);
    if (!keyResponse?.vapidPublicKey) return;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toUint8Array(keyResponse.vapidPublicKey),
      });
    }
    await subscribePush(subscription.toJSON(), token);
  }

  async function openNotification(item) {
    if (!token || !item?.id) return;
    await markNotificationRead(item.id, token).catch(() => {});
    setNotifications((prev) => prev.filter((entry) => Number(entry.id) !== Number(item.id)));
    setUnreadCount((prev) => Math.max(prev - 1, 0));
    if (item.link_url) router.push(item.link_url);
    window.dispatchEvent(new Event("notifications:read-all"));
  }

  if (!token) {
    return (
      <main className="container">
        <section className="card" style={{ padding: 16, width: "100%" }}>
          <h2 style={{ marginTop: 0 }}>{t("notificationsTitle")}</h2>
          <p style={{ margin: 0, color: "var(--muted)" }}>{t("loginToViewNotifications")}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <section className="card notifications-page" style={{ padding: 16, width: "100%", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0 }}>{t("notificationsTitle")} {unreadCount > 0 ? `(${Math.min(unreadCount, 99)})` : ""}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="notify-mark-read"
              onClick={async () => {
                await markAllNotificationsRead(token);
                setUnreadCount(0);
                setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
                window.dispatchEvent(new Event("notifications:read-all"));
              }}
            >
              {t("markAllRead")}
            </button>
            <button type="button" className="notify-close-btn" onClick={() => router.push("/")}>×</button>
          </div>
        </div>

        {prefs ? (
          <div className="notify-prefs">
            <label><input type="checkbox" checked={prefs.inAppEnabled} onChange={(e) => togglePref({ inAppEnabled: e.target.checked })} /> {t("notificationsInApp")}</label>
            <label><input type="checkbox" checked={prefs.pushEnabled} onChange={async (e) => { await togglePref({ pushEnabled: e.target.checked }); await togglePush(e.target.checked); }} /> {t("notificationsPush")}</label>
            <label><input type="checkbox" checked={prefs.wishlistSharedEnabled} onChange={(e) => togglePref({ wishlistSharedEnabled: e.target.checked })} /> {t("notificationsWishlist")}</label>
            <label><input type="checkbox" checked={prefs.reservationEnabled} onChange={(e) => togglePref({ reservationEnabled: e.target.checked })} /> {t("notificationsReservations")}</label>
            <label><input type="checkbox" checked={prefs.fundedEnabled} onChange={(e) => togglePref({ fundedEnabled: e.target.checked })} /> {t("notificationsFunding")}</label>
            <label><input type="checkbox" checked={prefs.friendRequestsEnabled} onChange={(e) => togglePref({ friendRequestsEnabled: e.target.checked })} /> {t("notificationsFriends")}</label>
          </div>
        ) : null}

        <ul className="notify-list">
          {notifications.filter((item) => !item.is_read).map((item) => (
            <li key={item.id}>
              <a
                href={item.link_url || "/"}
                style={{ fontWeight: 700 }}
                onClick={async (event) => {
                  event.preventDefault();
                  await openNotification(item);
                }}
              >
                {item.title}
              </a>
              <small>{item.body}</small>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
