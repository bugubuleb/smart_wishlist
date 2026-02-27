import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import Button from "../components/Button";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../api";
import { getToken } from "../storage";
import { getLanguage, t } from "../i18n";

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [lang, setLang] = useState("ru");

  useEffect(() => {
    getLanguage().then(setLang);
  }, []);

  async function loadNotifications() {
    const token = await getToken();
    if (!token) return;
    const data = await getNotifications(token);
    setNotifications(data.notifications || []);
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function handleReadAll() {
    const token = await getToken();
    if (!token) return;
    await markAllNotificationsRead(token);
    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
  }

  async function handleOpen(item) {
    const token = await getToken();
    if (!token) return;
    await markNotificationRead(item.id, token);
    setNotifications((prev) => prev.filter((row) => row.id !== item.id));
  }

  const unread = notifications.filter((item) => !item.is_read);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t(lang, "notifications")}</Text>
      {unread.length > 0 ? <Button title={t(lang, "markAllRead")} onPress={handleReadAll} /> : null}
      <FlatList
        data={unread}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Text style={styles.item} onPress={() => handleOpen(item)}>
            {item.title}
          </Text>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t(lang, "noNotifications")}</Text>}
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
    color: "#e6ecff",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2b44",
  },
  empty: {
    color: "#9aa4bf",
    marginTop: 12,
  },
});
