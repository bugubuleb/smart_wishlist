"use client";

import { useLanguage } from "@/components/LanguageProvider";

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const nextLanguage = language === "ru" ? "en" : "ru";
  const nextLanguageLabel = nextLanguage === "ru" ? t("langRu") : t("langEn");

  return (
    <button type="button" className="lang-btn lang-btn-single" onClick={() => setLanguage(nextLanguage)} title={nextLanguageLabel}>
      {nextLanguageLabel}
    </button>
  );
}
