import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Button from "../components/Button";
import Input from "../components/Input";
import { login } from "../api";
import { setToken } from "../storage";
import { t, getLanguage } from "../i18n";

export default function LoginScreen({ navigation }) {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState("ru");

  React.useEffect(() => {
    getLanguage().then(setLang);
  }, []);

  async function handleLogin() {
    if (!emailOrUsername || !password) return;
    setLoading(true);
    setError("");
    try {
      const data = await login({ emailOrUsername, password });
      await setToken(data.accessToken || data.token);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t(lang, "appTitle")}</Text>
      <Input
        value={emailOrUsername}
        onChangeText={setEmailOrUsername}
        placeholder={t(lang, "emailOrUsername")}
        autoCapitalize="none"
      />
      <Input
        value={password}
        onChangeText={setPassword}
        placeholder={t(lang, "password")}
        secureTextEntry
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={loading ? t(lang, "loading") : t(lang, "login")} onPress={handleLogin} disabled={loading} />
      <Button title={t(lang, "register")} onPress={() => navigation.navigate("Register")} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d111d",
    padding: 24,
    gap: 12,
    justifyContent: "center",
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  error: {
    color: "#ff6b6b",
  },
});
