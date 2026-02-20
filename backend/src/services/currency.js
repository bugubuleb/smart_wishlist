const SUPPORTED_CURRENCIES = [
  "RUB",
  "USD",
  "EUR",
  "KZT",
  "GBP",
  "CNY",
  "JPY",
  "TRY",
  "INR",
  "AED",
  "BYN",
  "UAH",
  "PLN",
  "CZK",
  "CHF",
  "SEK",
  "NOK",
  "CAD",
  "AUD",
  "BRL",
  "HKD",
  "SGD",
];

const FALLBACK_RATES_FROM_USD = {
  RUB: 92,
  USD: 1,
  EUR: 0.92,
  KZT: 490,
  GBP: 0.79,
  CNY: 7.2,
  JPY: 150,
  TRY: 31,
  INR: 83,
  AED: 3.67,
  BYN: 3.3,
  UAH: 39,
  PLN: 4.0,
  CZK: 23,
  CHF: 0.88,
  SEK: 10.5,
  NOK: 10.7,
  CAD: 1.36,
  AUD: 1.52,
  BRL: 5.0,
  HKD: 7.8,
  SGD: 1.34,
};

let cache = {
  timestamp: 0,
  ratesFromUsd: FALLBACK_RATES_FROM_USD,
};

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

export function isSupportedCurrency(currency) {
  return SUPPORTED_CURRENCIES.includes(String(currency || "").toUpperCase());
}

export function getSupportedCurrencies() {
  return [...SUPPORTED_CURRENCIES];
}

async function fetchRatesFromUsd() {
  const response = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!response.ok) throw new Error("Rate provider unavailable");
  const payload = await response.json();
  if (!payload?.rates || typeof payload.rates !== "object") {
    throw new Error("Invalid rate payload");
  }
  return payload.rates;
}

async function getRatesFromUsd() {
  const now = Date.now();
  if (now - cache.timestamp < 60 * 60 * 1000) {
    return cache.ratesFromUsd;
  }

  try {
    const rates = await fetchRatesFromUsd();
    cache = { timestamp: now, ratesFromUsd: rates };
    return rates;
  } catch {
    return cache.ratesFromUsd;
  }
}

export async function convertCurrency(amount, fromCurrency, toCurrency) {
  const source = String(fromCurrency || "").toUpperCase();
  const target = String(toCurrency || "").toUpperCase();
  if (!Number.isFinite(Number(amount))) return null;
  if (!isSupportedCurrency(source) || !isSupportedCurrency(target)) return null;
  if (source === target) return roundMoney(amount);

  const rates = await getRatesFromUsd();
  const fromRate = Number(rates[source]);
  const toRate = Number(rates[target]);
  if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || fromRate <= 0 || toRate <= 0) return null;

  const amountInUsd = Number(amount) / fromRate;
  return roundMoney(amountInUsd * toRate);
}
