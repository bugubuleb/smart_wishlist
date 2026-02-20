"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getMe, setLanguagePreference } from "@/lib/api";
import { resolveLanguageFromBrowser, t as translate } from "@/lib/i18n";
import { getToken } from "@/lib/session";

const LANGUAGE_KEY = "sw_lang";

const LanguageContext = createContext({
  language: "en",
  setLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState("en");

  useEffect(() => {
    const local = window.localStorage.getItem(LANGUAGE_KEY);
    const detected = local || resolveLanguageFromBrowser();

    setLanguageState(detected);
    document.documentElement.lang = detected;

    const token = getToken();
    if (!token) return;

    getMe(token)
      .then((me) => {
        if (me.preferredLanguage === "ru" || me.preferredLanguage === "en") {
          setLanguageState(me.preferredLanguage);
          window.localStorage.setItem(LANGUAGE_KEY, me.preferredLanguage);
          document.documentElement.lang = me.preferredLanguage;
        } else {
          setLanguagePreference(detected, token).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  function setLanguage(nextLanguage) {
    if (nextLanguage !== "ru" && nextLanguage !== "en") return;

    setLanguageState(nextLanguage);
    window.localStorage.setItem(LANGUAGE_KEY, nextLanguage);
    document.documentElement.lang = nextLanguage;

    const token = getToken();
    if (token) {
      setLanguagePreference(nextLanguage, token).catch(() => {});
    }
  }

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key) => translate(language, key),
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
