"use client";

import { useEffect, useRef, useState } from "react";

import { useCurrency } from "@/components/CurrencyProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { autofillByUrl, createItem } from "@/lib/api";

export default function AddItemForm({ slug, token, onCreated }) {
  const [productUrl, setProductUrl] = useState("");
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [priority, setPriority] = useState("medium");
  const [busy, setBusy] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [autofillEnabled, setAutofillEnabled] = useState(true);
  const [error, setError] = useState("");
  const [currencyInfo, setCurrencyInfo] = useState("");
  const lastAutofilledUrlRef = useRef("");
  const activeRequestIdRef = useRef(0);
  const imageInputRef = useRef(null);
  const { t } = useLanguage();
  const { currency } = useCurrency();

  function handleImageFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(t("imageReadError"));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(t("imageTooLarge"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      if (!value.startsWith("data:image/")) {
        setError(t("imageReadError"));
        return;
      }
      setImageUrl(value);
      setError("");
    };
    reader.onerror = () => {
      setError(t("imageReadError"));
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    const url = productUrl.trim();
    if (!autofillEnabled) {
      setIsAutofilling(false);
      return undefined;
    }
    if (!url) {
      setIsAutofilling(false);
      return undefined;
    }

    let parsedUrl = null;
    try {
      parsedUrl = new URL(url);
    } catch {
      return undefined;
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) return undefined;
    if (lastAutofilledUrlRef.current === url) return undefined;
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;

    (async () => {
      setIsAutofilling(true);
      setError("");
      try {
        const preview = await autofillByUrl(url, currency);
        if (activeRequestIdRef.current !== requestId) return;

        if (preview.title) setTitle(preview.title);
        if (preview.imageUrl) setImageUrl(preview.imageUrl);
        if (preview.convertedPrice != null) setTargetPrice(String(preview.convertedPrice));
        if (preview.sourceCurrency && preview.convertedCurrency && preview.sourceCurrency !== preview.convertedCurrency) {
          setCurrencyInfo(`${preview.sourceCurrency} -> ${preview.convertedCurrency}`);
        } else {
          setCurrencyInfo(currency);
        }
        lastAutofilledUrlRef.current = url;
      } catch (err) {
        if (activeRequestIdRef.current !== requestId) return;
        setError(err.message || "Failed to fetch product data");
      } finally {
        if (activeRequestIdRef.current === requestId) {
          setIsAutofilling(false);
        }
      }
    })();

    return undefined;
  }, [productUrl, currency, autofillEnabled]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!title.trim() || !productUrl.trim()) return;

    setBusy(true);
    setError("");
    try {
      await createItem(
        slug,
        {
          title: title.trim(),
          productUrl: productUrl.trim(),
          imageUrl: imageUrl.trim() || null,
          targetPrice: Number(targetPrice || 0),
          priority,
        },
        token,
      );

      setTitle("");
      setProductUrl("");
      setImageUrl("");
      setTargetPrice("");
      setPriority("medium");
      setCurrencyInfo("");
      lastAutofilledUrlRef.current = "";
      onCreated();
    } catch (err) {
      setError(err.message || "Failed to add item");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ padding: 14, display: "grid", gap: 8 }}>
      <h3 style={{ margin: 0 }}>{t("addItem")}</h3>
      <input value={productUrl} onChange={(e) => setProductUrl(e.target.value)} placeholder={t("productUrl")} style={{ padding: 10, borderRadius: 8, border: "1px solid var(--line)" }} />
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 13 }}>
        <input
          type="checkbox"
          checked={autofillEnabled}
          onChange={(e) => setAutofillEnabled(e.target.checked)}
        />
        {t("autofillToggle")}
      </label>
      {isAutofilling ? <small style={{ color: "var(--muted)" }}>{t("autofillInProgress")}</small> : null}
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("itemTitle")} style={{ padding: 10, borderRadius: 8, border: "1px solid var(--line)" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder={t("imageUrl")} style={{ padding: 10, borderRadius: 8, border: "1px solid var(--line)" }} />
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--field-bg)",
            color: "var(--text)",
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {t("uploadImage")}
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageFile}
          style={{ display: "none" }}
        />
      </div>
      <input value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} placeholder={`${t("targetPrice")} (${currency})`} style={{ padding: 10, borderRadius: 8, border: "1px solid var(--line)" }} />
      {currencyInfo ? <small style={{ color: "var(--muted)" }}>{t("currencyConverted")}: {currencyInfo}</small> : null}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 12 }}>
        <span style={{ color: "var(--text)", fontSize: 18, fontWeight: 800, letterSpacing: "0.01em" }}>{t("itemPriority")}</span>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--field-bg)", color: "var(--text)", minWidth: 190 }}>
          <option value="high">{t("priorityHigh")}</option>
          <option value="medium">{t("priorityMedium")}</option>
          <option value="low">{t("priorityLow")}</option>
        </select>
      </div>
      <button type="submit" disabled={busy} style={{ padding: 10, borderRadius: 8, border: 0, background: "var(--accent)", color: "white" }}>
        {t("saveItem")}
      </button>
      {error ? <small style={{ color: "#af2f1f" }}>{error}</small> : null}
    </form>
  );
}
