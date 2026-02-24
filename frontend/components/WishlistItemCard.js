"use client";

import { useState } from "react";

import { useCurrency } from "@/components/CurrencyProvider";
import { useLanguage } from "@/components/LanguageProvider";

export default function WishlistItemCard({ item, viewerRole, minContribution, showReservationActions = true, canContribute = true, onContribute, onReserve, onUnreserve, onSetResponsible, onUnsetResponsible, onSetPriority, onRemove }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [contributionInfo, setContributionInfo] = useState("");
  const { t } = useLanguage();
  const { currency } = useCurrency();

  const progressMax = item.target_price > 0 ? item.target_price : 1;
  const progressValue = Math.min(item.collected || 0, progressMax);
  const isUnavailable = item.item_status !== "active";
  const faded = isUnavailable;
  const fundedStyle = item.is_fully_funded
    ? {
      background: "rgba(16, 185, 129, 0.18)",
      borderColor: "rgba(16, 185, 129, 0.55)",
    }
    : {};
  const priorityColors = {
    high: "#ef4444",
    medium: "#f59e0b",
    low: "#64748b",
  };

  async function handleContribute() {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;
    setBusy(true);
    setError("");
    setContributionInfo("");
    try {
      const result = await onContribute(item.id, numericAmount);
      setAmount("");
      if (result?.acceptedAmount > 0) {
        let info = `${t("contributionAccepted")} ${result.acceptedAmount} ${currency}`;
        if (result.transferredAmount > 0) {
          info += ` • ${t("contributionTransferred")} ${result.transferredAmount} ${currency}`;
        }
        if (result.refundedAmount > 0) {
          info += ` • ${t("contributionRefunded")} ${result.refundedAmount} ${currency}`;
        }
        if (result.creditUsedAmount > 0) {
          info += ` • ${t("creditUsed")} ${result.creditUsedAmount} ${currency}`;
        }
        if (result.chargedAmount >= 0) {
          info += ` • ${t("chargedNow")} ${result.chargedAmount} ${currency}`;
        }
        if (result.droppedCreditAmount > 0) {
          info += ` • ${t("creditDropped")} ${result.droppedCreditAmount} ${currency}`;
        }
        setContributionInfo(info);
      }
    } catch (err) {
      setError(err.message || "Contribution failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    const reason = window.prompt(t("removeReasonPrompt"), t("removeReasonDefault"));
    if (!reason) return;

    setBusy(true);
    setError("");
    try {
      await onRemove(item.id, reason);
    } catch (err) {
      setError(err.message || "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card" style={{ padding: 14, display: "grid", gap: 8, opacity: faded ? 0.78 : 1, ...fundedStyle }}>
      <div style={{ aspectRatio: "16/10", borderRadius: 12, background: "var(--field-bg)", overflow: "hidden" }}>
        {item.image_url ? <img src={item.image_url} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      </div>
      <a href={item.product_url} target="_blank" rel="noreferrer" style={{ color: "var(--text)", fontWeight: 700, textDecoration: "none" }}>
        {item.title}
      </a>
      <small style={{ color: priorityColors[item.priority] || "var(--muted)", fontWeight: 600 }}>
        {t("itemPriority")}: {item.priority === "high" ? t("priorityHigh") : item.priority === "low" ? t("priorityLow") : t("priorityMedium")}
      </small>
      <a href={item.product_url} target="_blank" rel="noreferrer" style={{ color: "var(--muted)", fontSize: 13 }}>
        {t("openProduct")}
      </a>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
        <span>{t("goal")} {item.target_price || 0} {currency}</span>
        <span>{t("collected")} {item.collected || 0} {currency}</span>
      </div>

      <progress value={progressValue} max={progressMax} style={{ width: "100%", height: 10 }} />

      <small style={{ color: "var(--muted)" }}>
        {isUnavailable ? `${t("removedPrefix")} ${item.removed_reason || "unavailable"}` : item.is_reserved ? t("giftReserved") : t("giftFree")}
        {item.is_reserved_me ? ` • ${t("reservedByYou")}` : ""}
        {item.is_responsible_me ? ` • ${t("youResponsible")}` : ""}
        {item.is_fully_funded ? " • done" : ""}
      </small>

      {viewerRole === "owner" ? (
        <div style={{ display: "grid", gap: 8 }}>
          <select
            value={item.priority || "medium"}
            disabled={busy}
            onChange={async (e) => {
              setBusy(true);
              setError("");
              try {
                await onSetPriority(item.id, e.target.value);
              } catch (err) {
                setError(err.message || "Failed to update priority");
              } finally {
                setBusy(false);
              }
            }}
            style={{ padding: 10, borderRadius: 8, border: "1px solid var(--line)", background: "var(--field-bg)", color: "var(--text)" }}
          >
            <option value="high">{t("priorityHigh")}</option>
            <option value="medium">{t("priorityMedium")}</option>
            <option value="low">{t("priorityLow")}</option>
          </select>
          <button
            type="button"
            disabled={busy || isUnavailable || item.is_fully_funded}
            onClick={handleRemove}
            style={{ padding: 10, border: 0, borderRadius: 8, background: "#334155", color: "white" }}
          >
            {t("removeItem")}
          </button>
          {item.is_fully_funded ? <small style={{ color: "var(--muted)" }}>{t("fullyFundedLocked")}</small> : null}
        </div>
      ) : null}

      {viewerRole === "guest" ? (
        <div style={{ display: "grid", gap: 8 }}>
          {showReservationActions && canContribute ? (
            <button
              type="button"
              disabled={busy || isUnavailable || (item.is_reserved && !item.is_reserved_me)}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  if (item.is_reserved_me) {
                    await onUnreserve(item.id);
                  } else {
                    await onReserve(item.id);
                  }
                } catch (err) {
                  setError(err.message || "Failed to update reservation");
                } finally {
                  setBusy(false);
                }
              }}
              style={{ padding: 10, border: 0, borderRadius: 8, background: item.is_reserved_me ? "#0b7a3e" : "#334155", color: "white" }}
            >
              {item.is_reserved_me ? t("unreserve") : t("reserve")}
            </button>
          ) : null}
          {canContribute ? (
            <button
              type="button"
              disabled={busy || isUnavailable}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  if (item.is_responsible_me) {
                    await onUnsetResponsible(item.id);
                  } else {
                    await onSetResponsible(item.id);
                  }
                } catch (err) {
                  setError(err.message || "Failed to set responsible");
                } finally {
                  setBusy(false);
                }
              }}
              style={{ padding: 10, border: 0, borderRadius: 8, background: item.is_responsible_me ? "#0b7a3e" : "#334155", color: "white" }}
            >
              {item.is_responsible_me ? t("unsetResponsible") : t("beResponsible")}
            </button>
          ) : null}
          {!item.is_fully_funded && canContribute ? (
            <>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={currency}
                style={{ width: "100%", padding: 10, border: "1px solid var(--line)", borderRadius: 8 }}
              />
              <small style={{ color: "var(--muted)" }}>{t("minContribution")} {minContribution} {currency}</small>
            </>
          ) : null}
          {!item.is_fully_funded && canContribute ? (
            <button
              type="button"
              disabled={busy || isUnavailable}
              onClick={handleContribute}
              style={{ padding: 10, border: 0, borderRadius: 8, background: "#0ea5e9", color: "white" }}
            >
              {t("contribute")}
            </button>
          ) : null}
          {!canContribute ? <small style={{ color: "var(--muted)" }}>{t("recipientCannotContribute")}</small> : null}
        </div>
      ) : null}

      {error ? <small style={{ color: "#af2f1f" }}>{error}</small> : null}
      {contributionInfo ? <small style={{ color: "var(--muted)" }}>{contributionInfo}</small> : null}
    </article>
  );
}
