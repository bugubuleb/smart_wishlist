import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import Button from "../components/Button";
import Input from "../components/Input";
import { getToken } from "../storage";
import {
  getWishlist,
  createItem,
  contributeToItem,
  reserveItem,
  unreserveItem,
  setItemResponsible,
  unsetItemResponsible,
  removeItem,
  setItemPriority,
} from "../api";

export default function WishlistScreen({ route, navigation }) {
  const { slug } = route.params;
  const [wishlist, setWishlist] = useState(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [contribution, setContribution] = useState("");

  async function load() {
    const token = await getToken();
    if (!token) return;
    const data = await getWishlist(slug, token);
    setWishlist(data);
  }

  useEffect(() => {
    load();
  }, [slug]);

  async function handleAddItem() {
    const token = await getToken();
    if (!token || !title.trim()) return;
    await createItem(slug, { title: title.trim(), price: Number(price) || 0 }, token);
    setTitle("");
    setPrice("");
    await load();
  }

  async function handleContribute(itemId) {
    const token = await getToken();
    if (!token || !contribution) return;
    await contributeToItem(itemId, Number(contribution), token);
    setContribution("");
    await load();
  }

  async function handleReserve(itemId, reserved) {
    const token = await getToken();
    if (!token) return;
    if (reserved) {
      await unreserveItem(itemId, token);
    } else {
      await reserveItem(itemId, token);
    }
    await load();
  }

  async function handleResponsible(itemId, responsible) {
    const token = await getToken();
    if (!token) return;
    if (responsible) {
      await unsetItemResponsible(itemId, token);
    } else {
      await setItemResponsible(itemId, token);
    }
    await load();
  }

  async function handlePriority(itemId, priority) {
    const token = await getToken();
    if (!token) return;
    await setItemPriority(itemId, priority, token);
    await load();
  }

  async function handleRemove(itemId) {
    const token = await getToken();
    if (!token) return;
    await removeItem(itemId, "It will be removed", token);
    await load();
  }

  return (
    <View style={styles.container}>
      <Button title="Back" onPress={() => navigation.goBack()} variant="secondary" />
      <Text style={styles.title}>{wishlist?.title || "Wishlist"}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add item</Text>
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="Gift title" />
        <Input label="Price" value={price} onChangeText={setPrice} placeholder="0" keyboardType="numeric" />
        <Button title="Save" onPress={handleAddItem} />
      </View>

      <FlatList
        data={wishlist?.items || []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemMeta}>Price: {item.price} {wishlist?.currency || "RUB"}</Text>
            <Input
              label="Contribution"
              value={contribution}
              onChangeText={setContribution}
              placeholder="0"
              keyboardType="numeric"
            />
            <View style={styles.row}>
              <Button title="Contribute" onPress={() => handleContribute(item.id)} />
              <Button title={item.is_reserved ? "Unreserve" : "Reserve"} onPress={() => handleReserve(item.id, item.is_reserved)} variant="secondary" />
            </View>
            <View style={styles.row}>
              <Button
                title={item.is_responsible ? "Remove responsibility" : "Be responsible"}
                onPress={() => handleResponsible(item.id, item.is_responsible)}
                variant="secondary"
              />
              <Button title="Remove" onPress={() => handleRemove(item.id)} variant="secondary" />
            </View>
            <View style={styles.row}>
              <Button title="Low" onPress={() => handlePriority(item.id, "low")} variant="secondary" />
              <Button title="Medium" onPress={() => handlePriority(item.id, "medium")} variant="secondary" />
              <Button title="High" onPress={() => handlePriority(item.id, "high")} variant="secondary" />
            </View>
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
  item: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#161e32",
    marginBottom: 10,
    gap: 8,
  },
  itemTitle: {
    color: "#ffffff",
    fontWeight: "700",
  },
  itemMeta: {
    color: "#9aa4bf",
  },
  row: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  empty: {
    color: "#9aa4bf",
    marginTop: 12,
  },
});
