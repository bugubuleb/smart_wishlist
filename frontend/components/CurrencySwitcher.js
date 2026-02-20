"use client";

import { useCurrency } from "@/components/CurrencyProvider";

export default function CurrencySwitcher() {
  const { currency, currencies, setCurrency } = useCurrency();

  return (
    <select
      value={currency}
      onChange={(event) => setCurrency(event.target.value)}
      style={{
        height: 42,
        borderRadius: 999,
        border: "1px solid var(--line)",
        background: "var(--toggle-bg)",
        color: "var(--text)",
        padding: "0 12px",
        fontWeight: 700,
      }}
      aria-label="Currency"
    >
      {currencies.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}
