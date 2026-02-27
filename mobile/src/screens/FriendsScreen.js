import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import Button from "../components/Button";
import Input from "../components/Input";
import { getFriends, sendFriendRequest, acceptFriendRequest, rejectFriendRequest } from "../api";
import { getToken } from "../storage";

export default function FriendsScreen() {
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [username, setUsername] = useState("");

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
      <Text style={styles.title}>Friends</Text>
      <View style={styles.card}>
        <Input label="Add friend" value={username} onChangeText={setUsername} placeholder="Username" />
        <Button title="Send request" onPress={handleSend} />
      </View>

      <Text style={styles.sectionTitle}>Incoming requests</Text>
      <FlatList
        data={incoming}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.itemText}>@{item.from_username}</Text>
            <View style={styles.rowButtons}>
              <Button title="Accept" onPress={() => handleAccept(item.id)} />
              <Button title="Reject" onPress={() => handleReject(item.id)} variant="secondary" />
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No incoming requests.</Text>}
      />

      <Text style={styles.sectionTitle}>Outgoing requests</Text>
      <FlatList
        data={outgoing}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Text style={styles.itemText}>@{item.to_username}</Text>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No outgoing requests.</Text>}
      />

      <Text style={styles.sectionTitle}>Friends list</Text>
      <FlatList
        data={friends}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Text style={styles.itemText}>@{item.username} ({item.display_name})</Text>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No friends yet.</Text>}
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
