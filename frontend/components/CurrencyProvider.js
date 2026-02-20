"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getAvailableCurrencies, getMe, setCurrencyPreference } from "@/lib/api";
import { resolveCurrencyFromBrowser } from "@/lib/currency";
import { getToken } from "@/lib/session";

const CURRENCY_KEY = "sw_currency";

const CurrencyContext = createContext({
  currency: "RUB",
  currencies: ["RUB"],
  setCurrency: () => {},
});

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState("RUB");
  const [currencies, setCurrencies] = useState(["RUB"]);

  useEffect(() => {
    const localCurrency = window.localStorage.getItem(CURRENCY_KEY);
    const detected = (localCurrency || resolveCurrencyFromBrowser()).toUpperCase();
    setCurrencyState(detected);

    getAvailableCurrencies()
      .then((data) => {
        if (Array.isArray(data.currencies) && data.currencies.length > 0) {
          setCurrencies(data.currencies);
        }
      })
      .catch(() => {});

    const token = getToken();
    if (!token) {
      window.localStorage.setItem(CURRENCY_KEY, detected);
      return;
    }

    getMe(token)
      .then((me) => {
        if (typeof me.preferredCurrency === "string" && me.preferredCurrency.length === 3) {
          const normalized = me.preferredCurrency.toUpperCase();
          setCurrencyState(normalized);
          window.localStorage.setItem(CURRENCY_KEY, normalized);
        } else {
          const fallback = detected;
          setCurrencyState(fallback);
          window.localStorage.setItem(CURRENCY_KEY, fallback);
          setCurrencyPreference(fallback, token).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  function setCurrency(nextCurrency) {
    const next = String(nextCurrency || "").toUpperCase();
    if (!next || !currencies.includes(next)) return;

    setCurrencyState(next);
    window.localStorage.setItem(CURRENCY_KEY, next);

    const token = getToken();
    if (token) {
      setCurrencyPreference(next, token).catch(() => {});
    }
  }

  const value = useMemo(
    () => ({
      currency,
      currencies,
      setCurrency,
    }),
    [currency, currencies],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
