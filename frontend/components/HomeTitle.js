"use client";

import { useLanguage } from "@/components/LanguageProvider";

export default function HomeTitle() {
  const { t } = useLanguage();
  return <h1 style={{ marginBottom: 8 }}>{t("appTitle")}</h1>;
}
