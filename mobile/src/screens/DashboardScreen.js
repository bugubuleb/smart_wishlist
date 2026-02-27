import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import Button from "../components/Button";
import Input from "../components/Input";
import { getToken } from "../storage";
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Smart Wishlist</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create wishlist</Text>
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="Wishlist title" />
        <Input label="Min contribution" value={minContribution} onChangeText={setMinContribution} placeholder="100" keyboardType="numeric" />
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
        ListEmptyComponent={<Text style={styles.empty}>No wishlists yet.</Text>}
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
        ListEmptyComponent={<Text style={styles.empty}>No shared lists.</Text>}
      />
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
    fontSize: 24,
    fontWeight: "800",
  },
  card: {
    backgroundColor: "#141d30",
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    color: "#ffffff",
    fontWeight: "700",
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
  empty: {
    color: "#9aa4bf",
  },
});
