import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function SectionCard({ title, children }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#141d30",
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  title: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
