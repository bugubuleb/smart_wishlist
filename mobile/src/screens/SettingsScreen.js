import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Button from "../components/Button";
import { clearToken, getToken } from "../storage";
import { setCurrencyPreference, setLanguagePreference, getMe, getAvailableCurrencies } from "../api";
import { getLanguage, setLanguage, t } from "../i18n";

export default function SettingsScreen({ navigation }) {
  const [language, setLanguageState] = useState("ru");
  const [currency, setCurrency] = useState("RUB");
  const [availableCurrencies, setAvailableCurrencies] = useState(["RUB", "USD", "EUR", "KZT"]);

  useEffect(() => {
    getLanguage().then(setLanguageState);
  }, []);

  useEffect(() => {
    async function load() {
      const token = await getToken();
      if (!token) return;
      const me = await getMe(token);
      if (me?.currency) setCurrency(me.currency);
      const list = await getAvailableCurrencies().catch(() => null);
      if (list?.currencies) setAvailableCurrencies(list.currencies);
    }
    load();
  }, []);

  async function handleLogout() {
    await clearToken();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  }

  async function updateLanguage(next) {
    const token = await getToken();
    if (!token) return;
    setLanguageState(next);
    await setLanguage(next);
    await setLanguagePreference(next, token);
  }

  async function updateCurrency(next) {
    const token = await getToken();
    if (!token) return;
    setCurrency(next);
    await setCurrencyPreference(next, token);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t(language, "settings")}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>{t(language, "language")}</Text>
        <View style={styles.row}>
          <Button title="RU" onPress={() => updateLanguage("ru")} variant={language === "ru" ? "primary" : "secondary"} />
          <Button title="EN" onPress={() => updateLanguage("en")} variant={language === "en" ? "primary" : "secondary"} />
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>{t(language, "currency")}</Text>
        <View style={styles.row}>
          {availableCurrencies.map((code) => (
            <Button key={code} title={code} onPress={() => updateCurrency(code)} variant={currency === code ? "primary" : "secondary"} />
          ))}
        </View>
      </View>
      <Button title={t(language, "logout")} onPress={handleLogout} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d111d",
    padding: 20,
    gap: 12,
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  card: {
    backgroundColor: "#141d30",
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  label: {
    color: "#aebadb",
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
});
