import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Button from "../components/Button";
import Input from "../components/Input";
import { register } from "../api";
import { setToken } from "../storage";
import { t, getLanguage } from "../i18n";

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState("ru");

  React.useEffect(() => {
    getLanguage().then(setLang);
  }, []);

  async function handleRegister() {
    if (!email || !username || !displayName || !password) return;
    setLoading(true);
    setError("");
    try {
      const data = await register({ email, username, displayName, password });
      await setToken(data.token);
      navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t(lang, "register")}</Text>
      <Input
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <Input
        placeholder={t(lang, "username")}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <Input
        placeholder={t(lang, "displayName")}
        value={displayName}
        onChangeText={setDisplayName}
      />
      <Input
        placeholder={t(lang, "password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={loading ? t(lang, "loading") : t(lang, "register")} onPress={handleRegister} disabled={loading} />
      <Button title={t(lang, "backToLogin")} onPress={() => navigation.goBack()} variant="secondary" />
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
    fontSize: 26,
    fontWeight: "800",
  },
  error: {
    color: "#ff6b6b",
  },
});
