"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import CurrencySwitcher from "@/components/CurrencySwitcher";
import GlobalLogoutButton from "@/components/GlobalLogoutButton";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import {
  getNotificationPreferences,
  getNotifications,
  getVapidPublicKey,
  markAllNotificationsRead,
  setNotificationPreferences,
  subscribePush,
  unsubscribePush,
} from "@/lib/api";
import { connectNotificationSocket } from "@/lib/realtime";
import { getToken } from "@/lib/session";

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-icon" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="8" cy="7" r="2" fill="currentColor" />
      <circle cx="15" cy="12" r="2" fill="currentColor" />
      <circle cx="11" cy="17" r="2" fill="currentColor" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-icon" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 9a6 6 0 1 1 12 0v4l1.5 2H4.5L6 13V9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function toUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export default function GlobalControls() {
  const pathname = usePathname();
  const [isAuthed, setIsAuthed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [prefs, setPrefs] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    function syncAuth() {
      setIsAuthed(Boolean(getToken()));
    }

    syncAuth();
    window.addEventListener("storage", syncAuth);
    window.addEventListener("sw:auth-changed", syncAuth);

    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("sw:auth-changed", syncAuth);
    };
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      setPrefs(null);
      return undefined;
    }

    getNotifications(token)
      .then((data) => {
        setNotifications(data.notifications || []);
        setUnreadCount(Number(data.unreadCount || 0));
      })
      .catch(() => {});

    getNotificationPreferences(token)
      .then((data) => setPrefs(data))
      .catch(() => {});

    const socket = connectNotificationSocket(token, (event) => {
      if (event.type === "notification.created" && event.notification) {
        setNotifications((prev) => [event.notification, ...prev].slice(0, 50));
        setUnreadCount((prev) => prev + 1);
        setToast(event.notification);
      }
    });
    return () => socket.close();
  }, [isAuthed, pathname]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const showCurrency = isAuthed && !isAuthPage;

  const pushSupported = useMemo(
    () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window,
    [],
  );

  async function togglePref(patch) {
    const token = getToken();
    if (!token || !prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      await setNotificationPreferences(patch, token);
    } catch {
      setPrefs(prefs);
    }
  }

  async function togglePushSubscription(enabled) {
    const token = getToken();
    if (!token || !pushSupported) return;
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

  if (isAuthPage) {
    return (
      <div className="global-actions auth-language-only">
        <LanguageSwitcher />
      </div>
    );
  }

  return (
    <>
      <div className="global-actions">
        <div className="global-actions-desktop">
          <LanguageSwitcher />
          <div className="theme-toggle-wrap">
            <ThemeToggle />
          </div>
          <button
            type="button"
            className="global-notify-btn"
            onClick={() => {
              setMobileOpen((prev) => !prev);
              setActiveTab("notifications");
            }}
            aria-label="Notifications"
            title="Notifications"
          >
            <BellIcon />
            {unreadCount > 0 ? <span className="notify-badge">{Math.min(unreadCount, 99)}</span> : null}
          </button>
          <GlobalLogoutButton />
        </div>

        <button
          type="button"
          className="global-settings-trigger"
          aria-label="Settings"
          title="Settings"
          onClick={() => {
            setMobileOpen((prev) => !prev);
            setActiveTab("general");
          }}
        >
          <SettingsIcon />
          {unreadCount > 0 ? <span className="notify-badge">{Math.min(unreadCount, 99)}</span> : null}
        </button>
      </div>

      {showCurrency ? (
        <div className="currency-dock">
          <CurrencySwitcher />
        </div>
      ) : null}

      {mobileOpen ? (
        <div className="global-settings-panel card">
          <div className="settings-tabs">
            <button type="button" className={activeTab === "general" ? "active" : ""} onClick={() => setActiveTab("general")}>
              Настройки
            </button>
            <button type="button" className={activeTab === "notifications" ? "active" : ""} onClick={() => setActiveTab("notifications")}>
              Уведомления {unreadCount > 0 ? `(${Math.min(unreadCount, 99)})` : ""}
            </button>
          </div>

          {activeTab === "general" ? (
            <>
              <div className="global-settings-row">
                <span>Language</span>
                <LanguageSwitcher />
              </div>
              <div className="global-settings-row">
                <span>Theme</span>
                <ThemeToggle />
              </div>
              {showCurrency ? (
                <div className="global-settings-row">
                  <span>Currency</span>
                  <CurrencySwitcher />
                </div>
              ) : null}
              {isAuthed ? (
                <div className="global-settings-row">
                  <span>Account</span>
                  <GlobalLogoutButton />
                </div>
              ) : null}
            </>
          ) : (
            <>
              {isAuthed && prefs ? (
                <div className="notify-prefs">
                  <label><input type="checkbox" checked={prefs.inAppEnabled} onChange={(e) => togglePref({ inAppEnabled: e.target.checked })} /> In-app</label>
                  <label><input type="checkbox" checked={prefs.pushEnabled} onChange={async (e) => { await togglePref({ pushEnabled: e.target.checked }); await togglePushSubscription(e.target.checked); }} /> Push</label>
                  <label><input type="checkbox" checked={prefs.wishlistSharedEnabled} onChange={(e) => togglePref({ wishlistSharedEnabled: e.target.checked })} /> Новый вишлист</label>
                  <label><input type="checkbox" checked={prefs.reservationEnabled} onChange={(e) => togglePref({ reservationEnabled: e.target.checked })} /> Резервы</label>
                  <label><input type="checkbox" checked={prefs.fundedEnabled} onChange={(e) => togglePref({ fundedEnabled: e.target.checked })} /> Полное финансирование</label>
                  <label><input type="checkbox" checked={prefs.friendRequestsEnabled} onChange={(e) => togglePref({ friendRequestsEnabled: e.target.checked })} /> Друзья</label>
                </div>
              ) : (
                <p style={{ margin: 0, color: "var(--muted)" }}>Войди, чтобы настроить уведомления.</p>
              )}
              {isAuthed ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      const token = getToken();
                      if (!token) return;
                      await markAllNotificationsRead(token);
                      setUnreadCount(0);
                      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
                    }}
                  >
                    Прочитать все
                  </button>
                  <ul className="notify-list">
                    {notifications.map((item) => (
                      <li key={item.id}>
                        <a href={item.link_url || "/"} style={{ fontWeight: item.is_read ? 500 : 700 }}>{item.title}</a>
                        <small>{item.body}</small>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {toast ? (
        <a className="notify-toast card" href={toast.link_url || "/"}>
          <strong>{toast.title}</strong>
          <span>{toast.body}</span>
        </a>
      ) : null}
    </>
  );
}
