import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import Button from "../components/Button";
import Input from "../components/Input";
import { getFriends, sendFriendRequest, acceptFriendRequest, rejectFriendRequest } from "../api";
import { getToken } from "../storage";
import { getLanguage, t } from "../i18n";

export default function FriendsScreen() {
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [username, setUsername] = useState("");
  const [lang, setLang] = useState("ru");

  useEffect(() => {
    getLanguage().then(setLang);
  }, []);

  async function load() {
    const token = await getToken();
    if (!token) return;
    const data = await getFriends(token);
    setFriends(data.friends || []);
    setIncoming(data.incoming || []);
    setOutgoing(data.outgoing || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSend() {
    const token = await getToken();
    if (!token || !username.trim()) return;
    await sendFriendRequest(username.trim(), [], token);
    setUsername("");
    await load();
  }

  async function handleAccept(requestId) {
    const token = await getToken();
    if (!token) return;
    await acceptFriendRequest(requestId, [], token);
    await load();
  }

  async function handleReject(requestId) {
    const token = await getToken();
    if (!token) return;
    await rejectFriendRequest(requestId, token);
    await load();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t(lang, "friends")}</Text>
      <View style={styles.card}>
        <Input label={t(lang, "addFriend")} value={username} onChangeText={setUsername} placeholder={t(lang, "username")} />
        <Button title={t(lang, "sendRequest")} onPress={handleSend} />
      </View>

      <Text style={styles.sectionTitle}>{t(lang, "incoming")}</Text>
      <FlatList
        data={incoming}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.itemText}>@{item.from_username}</Text>
            <View style={styles.rowButtons}>
              <Button title={t(lang, "accept")} onPress={() => handleAccept(item.id)} />
              <Button title={t(lang, "reject")} onPress={() => handleReject(item.id)} variant="secondary" />
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t(lang, "noIncoming")}</Text>}
      />

      <Text style={styles.sectionTitle}>{t(lang, "outgoing")}</Text>
      <FlatList
        data={outgoing}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Text style={styles.itemText}>@{item.to_username}</Text>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t(lang, "noOutgoing")}</Text>}
      />

      <Text style={styles.sectionTitle}>{t(lang, "friends")}</Text>
      <FlatList
        data={friends}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Text style={styles.itemText}>@{item.username} ({item.display_name})</Text>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t(lang, "noFriends")}</Text>}
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
  sectionTitle: {
    color: "#aebadb",
    marginTop: 8,
    fontWeight: "700",
  },
  row: {
    paddingVertical: 8,
    gap: 8,
  },
  rowButtons: {
    flexDirection: "row",
    gap: 8,
  },
  itemText: {
    color: "#e6ecff",
  },
  empty: {
    color: "#9aa4bf",
  },
});
