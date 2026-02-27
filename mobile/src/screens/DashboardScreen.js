import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import Button from "../components/Button";
import Input from "../components/Input";
import { getToken } from "../storage";
import {
  createWishlist,
  getMyWishlists,
  getSharedWishlists,
  getFriends,
  lookupUserByUsername,
} from "../api";
import { getLanguage, t } from "../i18n";

export default function DashboardScreen({ navigation }) {
  const [myLists, setMyLists] = useState([]);
  const [sharedLists, setSharedLists] = useState([]);
  const [title, setTitle] = useState("");
  const [minContribution, setMinContribution] = useState("100");
  const [recipientMode, setRecipientMode] = useState("self");
  const [recipientInput, setRecipientInput] = useState("");
  const [foundUser, setFoundUser] = useState(null);
  const [hideFromFoundUser, setHideFromFoundUser] = useState(true);
  const [friends, setFriends] = useState([]);
  const [hiddenUserIds, setHiddenUserIds] = useState([]);
  const [step, setStep] = useState(1);
  const [lang, setLang] = useState("ru");

  useEffect(() => {
    getLanguage().then(setLang);
  }, []);

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

  useEffect(() => {
    async function loadFriends() {
      const token = await getToken();
      if (!token) return;
      const data = await getFriends(token);
      setFriends(data.friends || []);
    }
    if (step === 2) loadFriends();
  }, [step]);

  useEffect(() => {
    setFoundUser(null);
    setHideFromFoundUser(true);
    if (recipientMode !== "friend") return;
    const candidate = recipientInput.trim();
    if (!candidate) return;
    let isActive = true;
    const timer = setTimeout(async () => {
      const token = await getToken();
      if (!token) return;
      const result = await lookupUserByUsername(candidate, token).catch(() => null);
      if (!isActive) return;
      if (result?.found) setFoundUser(result.user);
      else setFoundUser(null);
    }, 250);
    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [recipientInput, recipientMode]);

  async function handleCreate() {
    const token = await getToken();
    if (!token || !title.trim()) return;
    await createWishlist(
      {
        title: title.trim(),
        minContribution: Number(minContribution) || 100,
        recipientMode,
        recipientInput: recipientInput.trim() || undefined,
        hideFromRecipient: Boolean(foundUser && hideFromFoundUser),
        hiddenUserIds,
      },
      token,
    );
    setTitle("");
    setRecipientInput("");
    setHiddenUserIds([]);
    setFoundUser(null);
    setStep(1);
    await loadData();
  }

  const visibleFriends = useMemo(
    () => friends.filter((friend) => !foundUser || friend.id !== foundUser.id),
    [friends, foundUser],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t(lang, "appTitle")}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t(lang, "createWishlist")}</Text>
        <Input label={t(lang, "title")} value={title} onChangeText={setTitle} placeholder={t(lang, "title")} />

        {step === 1 ? (
          <>
            <View style={styles.row}>
              <Button
                title={t(lang, "recipientSelf")}
                onPress={() => setRecipientMode("self")}
                variant={recipientMode === "self" ? "primary" : "secondary"}
              />
              <Button
                title={t(lang, "recipientFriend")}
                onPress={() => setRecipientMode("friend")}
                variant={recipientMode === "friend" ? "primary" : "secondary"}
              />
            </View>
            {recipientMode === "friend" ? (
              <Input
                label={t(lang, "recipientInput")}
                value={recipientInput}
                onChangeText={setRecipientInput}
                placeholder={t(lang, "recipientInput")}
              />
            ) : null}
            <Input
              label={t(lang, "minContribution")}
              value={minContribution}
              onChangeText={setMinContribution}
              keyboardType="numeric"
              placeholder="100"
            />
            <Button title={t(lang, "next")} onPress={() => setStep(2)} />
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>{t(lang, "privacyTitle")}</Text>
            {foundUser ? (
              <View style={styles.row}>
                <Button
                  title={`${t(lang, "hideFromFound")} @${foundUser.username}`}
                  onPress={() => setHideFromFoundUser((prev) => !prev)}
                  variant={hideFromFoundUser ? "primary" : "secondary"}
                />
              </View>
            ) : null}
            {visibleFriends.length > 0 ? (
              <View style={styles.listBlock}>
                <Text style={styles.muted}>{t(lang, "hideFromUsers")}</Text>
                {visibleFriends.map((friend) => (
                  <Button
                    key={friend.id}
                    title={`@${friend.username}`}
                    onPress={() => {
                      setHiddenUserIds((prev) =>
                        prev.includes(friend.id) ? prev.filter((id) => id !== friend.id) : [...prev, friend.id],
                      );
                    }}
                    variant={hiddenUserIds.includes(friend.id) ? "primary" : "secondary"}
                  />
                ))}
              </View>
            ) : null}
            <View style={styles.row}>
              <Button title={t(lang, "prev")} onPress={() => setStep(1)} variant="secondary" />
              <Button title={t(lang, "createWishlist")} onPress={handleCreate} />
            </View>
          </>
        )}
      </View>

      <Text style={styles.sectionTitle}>{t(lang, "yourLists")}</Text>
      <FlatList
        data={myLists}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Text style={styles.listItem} onPress={() => navigation.navigate("Wishlist", { slug: item.slug })}>
            {item.title}
          </Text>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t(lang, "noWishlists")}</Text>}
      />

      <Text style={styles.sectionTitle}>{t(lang, "sharedWithYou")}</Text>
      <FlatList
        data={sharedLists}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Text style={styles.listItem} onPress={() => navigation.navigate("Wishlist", { slug: item.slug })}>
            {item.title}
          </Text>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t(lang, "noShared")}</Text>}
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
  row: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  listBlock: {
    gap: 8,
  },
  muted: {
    color: "#9aa4bf",
  },
});
