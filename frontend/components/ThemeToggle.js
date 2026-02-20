"use client";

import { useEffect, useState } from "react";

import { useLanguage } from "@/components/LanguageProvider";

const THEME_KEY = "sw_theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-icon" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M12 2V5M12 19V22M4.93 4.93L7.05 7.05M16.95 16.95L19.07 19.07M2 12H5M19 12H22M4.93 19.07L7.05 16.95M16.95 7.05L19.07 4.93" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-icon" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 1 0 20 14.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState("dark");
  const { t } = useLanguage();

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    const nextTheme = savedTheme || "dark";

    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_KEY, nextTheme);
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? t("switchToLight") : t("switchToDark")}
      title={theme === "dark" ? t("switchToLight") : t("switchToDark")}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
