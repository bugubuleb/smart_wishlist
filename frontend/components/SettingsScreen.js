"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import CurrencySwitcher from "@/components/CurrencySwitcher";
import GlobalLogoutButton from "@/components/GlobalLogoutButton";
import { useLanguage } from "@/components/LanguageProvider";
import ThemeToggle from "@/components/ThemeToggle";
import {
  getNotificationPreferences,
  getVapidPublicKey,
  setNotificationPreferences,
  subscribePush,
  unsubscribePush,
} from "@/lib/api";
import { getToken } from "@/lib/session";

function toUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export default function SettingsScreen() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const [section, setSection] = useState("root");
  const [isAuthed, setIsAuthed] = useState(false);
  const [prefs, setPrefs] = useState(null);
  const token = useMemo(() => getToken(), []);

  useEffect(() => {
    setIsAuthed(Boolean(token));
  }, [token]);

  useEffect(() => {
    if (!token || section !== "notifications") return;
    getNotificationPreferences(token).then(setPrefs).catch(() => setPrefs(null));
  }, [token, section]);

  function closeSettings() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }

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

  return (
    <main className="container settings-page-mobile">
      <section className="card settings-mobile-card">
        <header className="settings-mobile-head">
          {section !== "root" ? (
            <button type="button" className="settings-nav-btn" onClick={() => setSection("root")} aria-label="Back">
              &lt;
            </button>
          ) : <span style={{ width: 42 }} />}

          <h2 style={{ margin: 0 }}>{t("settingsTab")}</h2>

          <button type="button" className="settings-nav-btn" onClick={closeSettings} aria-label="Close">
            ✕
          </button>
        </header>

        {section === "root" ? (
          <div className="settings-mobile-root">
            <button type="button" onClick={() => setSection("general")}>{t("settingsTab")}</button>
            <button type="button" onClick={() => setSection("notifications")}>{t("notificationsTab")}</button>
          </div>
        ) : null}

        {section === "general" ? (
          <div className="settings-mobile-grid">
            <div className="global-settings-row">
              <span>Language</span>
              <button
                type="button"
                className="lang-btn lang-btn-single"
                onClick={() => {
                  setLanguage(language === "ru" ? "en" : "ru");
                }}
              >
                {language === "ru" ? t("langEn") : t("langRu")}
              </button>
            </div>
            <div className="global-settings-row">
              <span>Theme</span>
              <ThemeToggle />
            </div>
            {isAuthed ? (
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
          </div>
        ) : null}

        {section === "notifications" ? (
          <div className="settings-mobile-grid">
            {!isAuthed ? (
              <p style={{ margin: 0, color: "var(--muted)" }}>{t("loginToViewNotifications")}</p>
            ) : prefs ? (
              <div className="notify-prefs">
                <label><input type="checkbox" checked={prefs.inAppEnabled} onChange={(e) => togglePref({ inAppEnabled: e.target.checked })} /> {t("notificationsInApp")}</label>
                <label><input type="checkbox" checked={prefs.pushEnabled} onChange={async (e) => { await togglePref({ pushEnabled: e.target.checked }); await togglePush(e.target.checked); }} /> {t("notificationsPush")}</label>
                <label><input type="checkbox" checked={prefs.wishlistSharedEnabled} onChange={(e) => togglePref({ wishlistSharedEnabled: e.target.checked })} /> {t("notificationsWishlist")}</label>
                <label><input type="checkbox" checked={prefs.reservationEnabled} onChange={(e) => togglePref({ reservationEnabled: e.target.checked })} /> {t("notificationsReservations")}</label>
                <label><input type="checkbox" checked={prefs.fundedEnabled} onChange={(e) => togglePref({ fundedEnabled: e.target.checked })} /> {t("notificationsFunding")}</label>
                <label><input type="checkbox" checked={prefs.friendRequestsEnabled} onChange={(e) => togglePref({ friendRequestsEnabled: e.target.checked })} /> {t("notificationsFriends")}</label>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
