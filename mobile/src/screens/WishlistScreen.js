import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { getWishlist } from "../api";
import { getToken } from "../storage";
import Button from "../components/Button";

export default function WishlistScreen({ route, navigation }) {
  const { slug } = route.params;
  const [wishlist, setWishlist] = useState(null);

  useEffect(() => {
    async function load() {
      const token = await getToken();
      if (!token) return;
      const data = await getWishlist(slug, token);
      setWishlist(data);
    }
    load();
  }, [slug]);

  return (
    <View style={styles.container}>
      <Button title="Back" onPress={() => navigation.goBack()} variant="secondary" />
      <Text style={styles.title}>{wishlist?.title || "Wishlist"}</Text>
      <FlatList
        data={wishlist?.items || []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemMeta}>{item.price} {wishlist?.currency || "RUB"}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No items yet.</Text>}
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
    fontSize: 22,
    fontWeight: "800",
  },
  item: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#161e32",
    marginBottom: 10,
  },
  itemTitle: {
    color: "#ffffff",
    fontWeight: "700",
  },
  itemMeta: {
    color: "#9aa4bf",
    marginTop: 4,
  },
  empty: {
    color: "#9aa4bf",
    marginTop: 12,
  },
});
