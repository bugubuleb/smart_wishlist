"use client";

import { useEffect, useState } from "react";

import AuthForm from "@/components/AuthForm";
import Dashboard from "@/components/Dashboard";
import { useLanguage } from "@/components/LanguageProvider";
import { getMe } from "@/lib/api";
import { clearToken, getToken } from "@/lib/session";

function resolvePreferredLanguage(value) {
  return value === "ru" || value === "en" ? value : null;
}

export default function HomeClient() {
  const [token, setCurrentToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    const existingToken = getToken();
    if (!existingToken) {
      setLoading(false);
      return;
    }

    getMe(existingToken)
      .then((me) => {
        setCurrentToken(existingToken);
        setUser(me);
        const preferredLanguage = resolvePreferredLanguage(me.preferredLanguage);
        setLanguage(preferredLanguage || language);
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p>{t("checkingSession")}</p>;
  }

  if (!token || !user) {
    return (
      <>
        <AuthForm
          onAuth={(nextUser) => {
            const freshToken = getToken();
            setCurrentToken(freshToken);
            setUser(nextUser);
            const preferredLanguage = resolvePreferredLanguage(nextUser.preferredLanguage);
            setLanguage(preferredLanguage || language);
          }}
        />
      </>
    );
  }

  return <Dashboard token={token} user={user} />;
}
