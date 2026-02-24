"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import CurrencySwitcher from "@/components/CurrencySwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import GlobalLogoutButton from "@/components/GlobalLogoutButton";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
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

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-icon settings-icon" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10.33 3.89a1 1 0 0 1 .94-.7h1.46a1 1 0 0 1 .94.7l.4 1.24a7.6 7.6 0 0 1 1.32.55l1.2-.58a1 1 0 0 1 1.14.2l1.04 1.03a1 1 0 0 1 .2 1.16l-.58 1.19c.2.42.38.87.52 1.32l1.27.41a1 1 0 0 1 .68.95v1.46a1 1 0 0 1-.68.95l-1.27.4a7.3 7.3 0 0 1-.53 1.32l.58 1.2a1 1 0 0 1-.2 1.15l-1.04 1.03a1 1 0 0 1-1.14.2l-1.2-.58c-.42.22-.86.4-1.32.54l-.4 1.27a1 1 0 0 1-.94.69h-1.46a1 1 0 0 1-.94-.7l-.4-1.26a7.4 7.4 0 0 1-1.32-.55l-1.2.58a1 1 0 0 1-1.14-.2l-1.04-1.03a1 1 0 0 1-.2-1.15l.58-1.2a7.3 7.3 0 0 1-.53-1.32l-1.27-.4a1 1 0 0 1-.68-.95v-1.46a1 1 0 0 1 .68-.95l1.27-.41c.14-.45.32-.9.53-1.32l-.58-1.19a1 1 0 0 1 .2-1.16l1.04-1.03a1 1 0 0 1 1.14-.2l1.2.58c.42-.22.86-.4 1.32-.55l.4-1.24Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.9" stroke="currentColor" strokeWidth="1.8" />
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
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
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

  useEffect(() => {
    function onNotificationsReadAll() {
      setUnreadCount(0);
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    }
    function onNotificationReadOne() {
      setUnreadCount((prev) => Math.max(prev - 1, 0));
    }

    window.addEventListener("notifications:read-all", onNotificationsReadAll);
    window.addEventListener("notifications:read-one", onNotificationReadOne);
    return () => {
      window.removeEventListener("notifications:read-all", onNotificationsReadAll);
      window.removeEventListener("notifications:read-one", onNotificationReadOne);
    };
  }, []);

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const showCurrency = isAuthed && !isAuthPage;

  const pushSupported = useMemo(
    () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window,
    [],
  );

  useEffect(() => {
    if (!isAuthed || !prefs?.pushEnabled || !pushSupported) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    togglePushSubscription(true).catch(() => {});
  }, [isAuthed, prefs?.pushEnabled, pushSupported]);

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

  async function openNotification(item) {
    const token = getToken();
    if (!token || !item?.id) return;
    await markNotificationRead(item.id, token).catch(() => {});
    setNotifications((prev) => prev.filter((entry) => Number(entry.id) !== Number(item.id)));
    setUnreadCount((prev) => Math.max(prev - 1, 0));
    window.dispatchEvent(new Event("notifications:read-one"));
    if (window.location.pathname !== item.link_url && item.link_url) {
      router.push(item.link_url);
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    if (!pathname?.startsWith("/wishlist/")) return;

    const related = notifications.filter((item) => !item.is_read && item.link_url === pathname);
    if (!related.length) return;

    related.forEach((item) => {
      markNotificationRead(item.id, token).catch(() => {});
    });
    setNotifications((prev) => prev.filter((item) => !(item.link_url === pathname && !item.is_read)));
    setUnreadCount((prev) => Math.max(prev - related.length, 0));
  }, [pathname, notifications]);

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
              if (window.matchMedia("(max-width: 960px)").matches) {
                router.push("/notifications");
              } else {
                setMobileOpen((prev) => !prev);
                setActiveTab("notifications");
              }
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
          className="global-notify-trigger"
          aria-label="Notifications"
          title="Notifications"
          onClick={() => {
            router.push("/notifications");
          }}
        >
          <BellIcon />
          {unreadCount > 0 ? <span className="notify-badge">{Math.min(unreadCount, 99)}</span> : null}
        </button>

        <button
          type="button"
          className="global-settings-trigger"
          aria-label="Settings"
          title="Settings"
          onClick={() => {
            if (window.matchMedia("(max-width: 960px)").matches) {
              router.push("/settings");
            } else {
              setMobileOpen((prev) => !prev);
              setActiveTab("general");
            }
          }}
        >
          <SettingsIcon />
        </button>
      </div>

      {showCurrency ? (
        <div className="currency-dock">
          <CurrencySwitcher />
        </div>
      ) : null}

      {mobileOpen ? (
        <div className="global-settings-panel card">
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
              <h4 style={{ margin: 0 }}>{t("notificationsTab")} {unreadCount > 0 ? `(${Math.min(unreadCount, 99)})` : ""}</h4>
              {isAuthed && prefs ? (
                <div className="notify-prefs">
                  <label><input type="checkbox" checked={prefs.inAppEnabled} onChange={(e) => togglePref({ inAppEnabled: e.target.checked })} /> {t("notificationsInApp")}</label>
                  <label><input type="checkbox" checked={prefs.pushEnabled} onChange={async (e) => { await togglePref({ pushEnabled: e.target.checked }); await togglePushSubscription(e.target.checked); }} /> {t("notificationsPush")}</label>
                  <label><input type="checkbox" checked={prefs.wishlistSharedEnabled} onChange={(e) => togglePref({ wishlistSharedEnabled: e.target.checked })} /> {t("notificationsWishlist")}</label>
                  <label><input type="checkbox" checked={prefs.reservationEnabled} onChange={(e) => togglePref({ reservationEnabled: e.target.checked })} /> {t("notificationsReservations")}</label>
                  <label><input type="checkbox" checked={prefs.fundedEnabled} onChange={(e) => togglePref({ fundedEnabled: e.target.checked })} /> {t("notificationsFunding")}</label>
                  <label><input type="checkbox" checked={prefs.friendRequestsEnabled} onChange={(e) => togglePref({ friendRequestsEnabled: e.target.checked })} /> {t("notificationsFriends")}</label>
                </div>
              ) : (
                <p style={{ margin: 0, color: "var(--muted)" }}>{t("loginToViewNotifications")}</p>
              )}
              {isAuthed ? (
                <>
                  <button
                    type="button"
                    className="notify-mark-read"
                    onClick={async () => {
                      const token = getToken();
                      if (!token) return;
                      await markAllNotificationsRead(token);
                      setUnreadCount(0);
                      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
                    }}
                  >
                    {t("markAllRead")}
                  </button>
                  <button type="button" className="notify-close-btn" onClick={() => setMobileOpen(false)}>×</button>
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
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {toast ? (
        <a
          className="notify-toast card"
          href={toast.link_url || "/"}
          onClick={async (event) => {
            event.preventDefault();
            await openNotification(toast);
            setToast(null);
          }}
        >
          <strong>{toast.title}</strong>
          <span>{toast.body}</span>
        </a>
      ) : null}
    </>
  );
}
