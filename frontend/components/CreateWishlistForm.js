"use client";

import { useEffect, useState } from "react";

import { useLanguage } from "@/components/LanguageProvider";
import { createWishlist, getFriends, lookupUserByUsername } from "@/lib/api";

export default function CreateWishlistForm({ token, onCreated }) {
  const [title, setTitle] = useState("");
  const [recipientMode, setRecipientMode] = useState("self");
  const [recipientInput, setRecipientInput] = useState("");
  const [step, setStep] = useState(1);
  const [foundUser, setFoundUser] = useState(null);
  const [hideFromFoundUser, setHideFromFoundUser] = useState(true);
  const [friends, setFriends] = useState([]);
  const [hiddenUserIds, setHiddenUserIds] = useState([]);
  const [minContribution, setMinContribution] = useState("100");
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  });
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    setFoundUser(null);
    setHideFromFoundUser(true);

    if (recipientMode !== "friend") return;
    const candidate = recipientInput.trim();
    if (!/^[a-zA-Z0-9_]{3,60}$/.test(candidate)) return;
    if (!token) return;

    const timeout = setTimeout(() => {
      lookupUserByUsername(candidate, token)
        .then((result) => {
          if (result.found) {
            setFoundUser(result.user);
          } else {
            setFoundUser(null);
          }
        })
        .catch(() => {
          setFoundUser(null);
        });
    }, 250);

    return () => clearTimeout(timeout);
  }, [recipientInput, recipientMode, token]);

  useEffect(() => {
    if (!foundUser) return;
    setHiddenUserIds((prev) => prev.filter((id) => id !== foundUser.id));
  }, [foundUser]);

  useEffect(() => {
    if (!token) return;
    getFriends(token)
      .then((data) => setFriends(data.friends || []))
      .catch(() => setFriends([]));
  }, [token]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!title.trim()) return;
    const normalizedMin = Math.max(1, Number(minContribution) || 100);
    if (recipientMode === "friend" && !recipientInput.trim()) return;

    setIsLoading(true);
    try {
      const wishlist = await createWishlist(
        {
          title: title.trim(),
          minContribution: normalizedMin,
          dueDate,
          recipientMode,
          recipientInput: recipientInput.trim() || undefined,
          hideFromRecipient: Boolean(foundUser && hideFromFoundUser),
          hiddenUserIds,
        },
        token,
      );
      setTitle("");
      setMinContribution(String(normalizedMin));
      setRecipientInput("");
      setFoundUser(null);
      setHideFromFoundUser(true);
      setHiddenUserIds([]);
      setFriends([]);
      setRecipientMode("self");
      setStep(1);
      onCreated(wishlist);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ padding: 20, display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>{t("createWishlist")}</h3>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("wishlistTitlePlaceholder")}
        style={{ padding: 12, borderRadius: 10, border: "1px solid var(--line)" }}
      />
      {step === 1 ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              type="button"
              onClick={() => setRecipientMode("self")}
              style={{
                padding: 10,
                borderRadius: 10,
                background: recipientMode === "self" ? "var(--accent)" : "var(--field-bg)",
                color: recipientMode === "self" ? "white" : "var(--text)",
              }}
            >
              {t("recipientModeSelf")}
            </button>
            <button
              type="button"
              onClick={() => setRecipientMode("friend")}
              style={{
                padding: 10,
                borderRadius: 10,
                background: recipientMode === "friend" ? "var(--accent)" : "var(--field-bg)",
                color: recipientMode === "friend" ? "white" : "var(--text)",
              }}
            >
              {t("recipientModeFriend")}
            </button>
          </div>
          {recipientMode === "friend" ? (
            <input
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              placeholder={t("recipientInput")}
              style={{ padding: 12, borderRadius: 10, border: "1px solid var(--line)" }}
            />
          ) : null}
          <input
            type="number"
            min="1"
            value={minContribution}
            onChange={(e) => setMinContribution(e.target.value)}
            placeholder={t("minContributionInput")}
            style={{ padding: 12, borderRadius: 10, border: "1px solid var(--line)" }}
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{ padding: 12, borderRadius: 10, border: "1px solid var(--line)" }}
          />
          <button
            type="button"
            onClick={() => {
              if (recipientMode === "friend" && !recipientInput.trim()) return;
              setStep(2);
            }}
            style={{ padding: 12, borderRadius: 10, border: 0, background: "var(--accent)", color: "#fff" }}
          >
            {t("nextStep")}
          </button>
        </>
      ) : (
        <>
          <h4 style={{ margin: 0 }}>{t("privacyStepTitle")}</h4>
          {foundUser ? (
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={hideFromFoundUser}
                onChange={(e) => setHideFromFoundUser(e.target.checked)}
              />
              <span>{t("hideFromFoundUser")} {foundUser.displayName}</span>
            </label>
          ) : null}
          {friends.filter((friend) => !foundUser || friend.id !== foundUser.id).length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              <small style={{ color: "var(--muted)" }}>{t("hideFromUsers")}</small>
              <div style={{ display: "grid", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                {friends
                  .filter((friend) => !foundUser || friend.id !== foundUser.id)
                  .map((friend) => (
                  <label key={friend.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={hiddenUserIds.includes(friend.id)}
                      onChange={(e) => {
                        setHiddenUserIds((prev) => {
                          if (e.target.checked) return [...new Set([...prev, friend.id])];
                          return prev.filter((id) => id !== friend.id);
                        });
                      }}
                    />
                    <span>@{friend.username} ({friend.display_name})</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                padding: 12,
                borderRadius: 10,
                border: "1px solid var(--line)",
                background: "var(--field-bg)",
                color: "var(--text)",
              }}
            >
              {t("prevStep")}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              style={{ padding: 12, borderRadius: 10, border: 0, background: "var(--accent)", color: "#fff" }}
            >
              {isLoading ? t("wait") : t("createWishlistBtn")}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
