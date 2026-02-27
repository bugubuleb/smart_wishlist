import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import Button from "../components/Button";
import { login } from "../api";
import { setToken } from "../storage";

export default function LoginScreen({ navigation }) {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!emailOrUsername || !password) return;
    setLoading(true);
    setError("");
    try {
      const data = await login({ emailOrUsername, password });
      await setToken(data.token);
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Smart Wishlist</Text>
      <TextInput
        placeholder="Email or username"
        placeholderTextColor="#9aa4bf"
        value={emailOrUsername}
        onChangeText={setEmailOrUsername}
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        placeholderTextColor="#9aa4bf"
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        secureTextEntry
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={loading ? "Please wait..." : "Sign in"} onPress={handleLogin} disabled={loading} />
      <Button title="Create account" onPress={() => navigation.navigate("Register")} variant="secondary" />
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
  input: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#161e32",
    borderWidth: 1,
    borderColor: "#2a3552",
    color: "#ffffff",
    paddingHorizontal: 12,
  },
  error: {
    color: "#ff6b6b",
  },
});
