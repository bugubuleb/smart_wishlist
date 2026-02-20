const LOCALE_TO_CURRENCY = {
  ru: "RUB",
  en: "USD",
  de: "EUR",
  fr: "EUR",
  es: "EUR",
  it: "EUR",
  nl: "EUR",
  pl: "PLN",
  cs: "CZK",
  uk: "UAH",
  be: "BYN",
  kk: "KZT",
  tr: "TRY",
  ja: "JPY",
  zh: "CNY",
  hi: "INR",
  ar: "AED",
  sv: "SEK",
  no: "NOK",
};

export function resolveCurrencyFromBrowser() {
  if (typeof window === "undefined") return "USD";

  const locales = [
    ...(window.navigator.languages || []),
    window.navigator.language || "",
  ]
    .map((value) => String(value).toLowerCase())
    .filter(Boolean);

  for (const locale of locales) {
    const prefix = locale.split("-")[0];
    if (LOCALE_TO_CURRENCY[prefix]) {
      return LOCALE_TO_CURRENCY[prefix];
    }
  }

  return "USD";
}
