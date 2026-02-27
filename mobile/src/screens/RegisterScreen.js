import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import Button from "../components/Button";
import { register } from "../api";
import { setToken } from "../storage";

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!email || !username || !displayName || !password) return;
    setLoading(true);
    setError("");
    try {
      const data = await register({ email, username, displayName, password });
      await setToken(data.token);
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <TextInput
        placeholder="Email"
        placeholderTextColor="#9aa4bf"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Username"
        placeholderTextColor="#9aa4bf"
        value={username}
        onChangeText={setUsername}
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Display name"
        placeholderTextColor="#9aa4bf"
        value={displayName}
        onChangeText={setDisplayName}
        style={styles.input}
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
      <Button title={loading ? "Please wait..." : "Register"} onPress={handleRegister} disabled={loading} />
      <Button title="Back to login" onPress={() => navigation.goBack()} variant="secondary" />
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
