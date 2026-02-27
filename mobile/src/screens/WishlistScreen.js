import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Image } from "react-native";
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
  autofillByUrl,
} from "../api";
import { connectWishlistSocket } from "../realtime";
import { getLanguage, t } from "../i18n";

export default function WishlistScreen({ route, navigation }) {
  const { slug } = route.params;
  const [wishlist, setWishlist] = useState(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [autofill, setAutofill] = useState(true);
  const [isAutofillLoading, setIsAutofillLoading] = useState(false);
  const [contributions, setContributions] = useState({});
  const [lang, setLang] = useState("ru");

  useEffect(() => {
    getLanguage().then(setLang);
  }, []);

  async function load() {
    const token = await getToken();
    if (!token) return;
    const data = await getWishlist(slug, token);
    setWishlist(data);
  }

  useEffect(() => {
    load();
  }, [slug]);

  useEffect(() => {
    const socket = connectWishlistSocket(slug, () => {
      load();
    });
    return () => socket.close();
  }, [slug]);

  useEffect(() => {
    if (!autofill || !url) return;
    let active = true;
    const timer = setTimeout(async () => {
      setIsAutofillLoading(true);
      try {
        const targetCurrency = wishlist?.currency || "RUB";
        const data = await autofillByUrl(url, targetCurrency);
        if (!active || !data) return;
        if (data.title) setTitle(data.title);
        if (data.price != null) setPrice(String(data.price));
        if (data.image) setImageUrl(data.image);
      } finally {
        if (active) setIsAutofillLoading(false);
      }
    }, 600);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [url, autofill, wishlist?.currency]);

  async function handleAddItem() {
    const token = await getToken();
    if (!token || !title.trim()) return;
    await createItem(
      slug,
      {
        title: title.trim(),
        price: Number(price) || 0,
        url: url.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
      },
      token,
    );
    setTitle("");
    setPrice("");
    setUrl("");
    setImageUrl("");
    await load();
  }

  async function handleContribute(itemId) {
    const token = await getToken();
    const amount = Number(contributions[itemId] || 0);
    if (!token || !amount) return;
    await contributeToItem(itemId, amount, token);
    setContributions((prev) => ({ ...prev, [itemId]: "" }));
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
    await removeItem(itemId, t(lang, "remove"), token);
    await load();
  }

  return (
    <View style={styles.container}>
      <Button title={t(lang, "back")} onPress={() => navigation.goBack()} variant="secondary" />
      <Text style={styles.title}>{wishlist?.title || "Wishlist"}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t(lang, "addItem")}</Text>
        <Input label={t(lang, "productUrl")} value={url} onChangeText={setUrl} placeholder="https://" />
        <Input label={t(lang, "title")} value={title} onChangeText={setTitle} placeholder={t(lang, "title")} />
        <Input label={t(lang, "imageUrl")} value={imageUrl} onChangeText={setImageUrl} placeholder="https://" />
        <Input label={t(lang, "price")} value={price} onChangeText={setPrice} placeholder="0" keyboardType="numeric" />
        {autofill ? <Text style={styles.muted}>{isAutofillLoading ? t(lang, "autofillRunning") : t(lang, "autofill")}</Text> : null}
        <Button title="Save" onPress={handleAddItem} />
      </View>

      <FlatList
        data={wishlist?.items || []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={[styles.item, item.is_fully_funded ? styles.itemFunded : null]}>
            {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.image} /> : null}
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemMeta}>Price: {item.price} {wishlist?.currency || "RUB"}</Text>
            {!item.is_fully_funded ? (
              <>
                <Input
                  label={t(lang, "contribution")}
                  value={String(contributions[item.id] || "")}
                  onChangeText={(value) => setContributions((prev) => ({ ...prev, [item.id]: value }))}
                  placeholder="0"
                  keyboardType="numeric"
                />
                <View style={styles.row}>
                  <Button title={t(lang, "contribute")} onPress={() => handleContribute(item.id)} />
                  <Button title={item.is_reserved ? t(lang, "unreserve") : t(lang, "reserve")} onPress={() => handleReserve(item.id, item.is_reserved)} variant="secondary" />
                </View>
              </>
            ) : null}
            <View style={styles.row}>
              <Button
                title={item.is_responsible ? t(lang, "removeResponsibility") : t(lang, "beResponsible")}
                onPress={() => handleResponsible(item.id, item.is_responsible)}
                variant="secondary"
              />
              <Button title={t(lang, "remove")} onPress={() => handleRemove(item.id)} variant="secondary" />
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
  itemFunded: {
    backgroundColor: "#1f3a2b",
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
  image: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    backgroundColor: "#0f1626",
  },
  empty: {
    color: "#9aa4bf",
    marginTop: 12,
  },
  muted: {
    color: "#9aa4bf",
  },
});
