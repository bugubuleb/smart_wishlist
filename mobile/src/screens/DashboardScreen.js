import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput } from "react-native";
import Button from "../components/Button";
import { clearToken, getToken } from "../storage";
import { createWishlist, getMyWishlists, getSharedWishlists } from "../api";

export default function DashboardScreen({ navigation }) {
  const [myLists, setMyLists] = useState([]);
  const [sharedLists, setSharedLists] = useState([]);
  const [title, setTitle] = useState("");
  const [minContribution, setMinContribution] = useState("100");

  async function loadData() {
    const token = await getToken();
    if (!token) return;
    const [mine, shared] = await Promise.all([
      getMyWishlists(token),
      getSharedWishlists(token),
    ]);
    setMyLists(mine.wishlists || []);
    setSharedLists(shared.wishlists || []);
  }

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadData);
    return unsubscribe;
  }, [navigation]);

  async function handleCreate() {
    const token = await getToken();
    if (!token || !title.trim()) return;
    await createWishlist({ title: title.trim(), minContribution: Number(minContribution) || 100, recipientMode: "self" }, token);
    setTitle("");
    await loadData();
  }

  async function handleLogout() {
    await clearToken();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My wishlists</Text>
        <Button title="Logout" onPress={handleLogout} variant="secondary" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create wishlist</Text>
        <TextInput
          placeholder="Title"
          placeholderTextColor="#9aa4bf"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />
        <TextInput
          placeholder="Min contribution"
          placeholderTextColor="#9aa4bf"
          value={minContribution}
          onChangeText={setMinContribution}
          keyboardType="numeric"
          style={styles.input}
        />
        <Button title="Create" onPress={handleCreate} />
      </View>

      <Text style={styles.sectionTitle}>Your lists</Text>
      <FlatList
        data={myLists}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Text style={styles.listItem} onPress={() => navigation.navigate("Wishlist", { slug: item.slug })}>
            {item.title}
          </Text>
        )}
      />

      <Text style={styles.sectionTitle}>Shared with you</Text>
      <FlatList
        data={sharedLists}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Text style={styles.listItem} onPress={() => navigation.navigate("Wishlist", { slug: item.slug })}>
            {item.title}
          </Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d111d",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
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
    marginBottom: 16,
    gap: 10,
  },
  cardTitle: {
    color: "#ffffff",
    fontWeight: "700",
  },
  input: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#0f1626",
    borderWidth: 1,
    borderColor: "#263351",
    color: "#ffffff",
    paddingHorizontal: 12,
  },
  sectionTitle: {
    color: "#aebadb",
    marginTop: 12,
    marginBottom: 8,
    fontWeight: "700",
  },
  listItem: {
    color: "#e6ecff",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2b44",
  },
});
