"use client";

import { useState } from "react";

import { useLanguage } from "@/components/LanguageProvider";
import { login, register } from "@/lib/api";
import { setToken } from "@/lib/session";

export default function AuthForm({ onAuth, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = mode === "register" ? { displayName, username, email, password } : { email, password };
      const result = mode === "register" ? await register(payload) : await login(payload);
      setToken(result.accessToken);
      onAuth(result.user);
    } catch (err) {
      setError(err.message || "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="card"
      onSubmit={handleSubmit}
      style={{ padding: 20, display: "grid", gap: 10, width: "min(460px, 100%)", marginInline: "auto" }}
    >
      <h2 style={{ margin: 0 }}>{mode === "register" ? t("register") : t("login")}</h2>
      {mode === "register" ? (
        <>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("displayName")}
            style={{ padding: 12, borderRadius: 10, border: "1px solid var(--line)" }}
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ padding: 12, borderRadius: 10, border: "1px solid var(--line)" }}
          />
        </>
      ) : null}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("email")}
        style={{ padding: 12, borderRadius: 10, border: "1px solid var(--line)" }}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t("password")}
        style={{ padding: 12, borderRadius: 10, border: "1px solid var(--line)" }}
      />
      {error ? <small style={{ color: "#af2f1f" }}>{error}</small> : null}
      <button type="submit" disabled={loading} style={{ padding: 12, border: 0, borderRadius: 10, background: "var(--accent)", color: "white" }}>
        {loading ? t("wait") : mode === "register" ? t("createAccount") : t("signIn")}
      </button>
      <button
        type="button"
        onClick={() => setMode((prev) => (prev === "register" ? "login" : "register"))}
        style={{ border: 0, background: "transparent", color: "var(--muted)", textAlign: "left", padding: 0 }}
      >
        {mode === "register" ? t("haveAccount") : t("noAccount")}
      </button>
    </form>
  );
}
