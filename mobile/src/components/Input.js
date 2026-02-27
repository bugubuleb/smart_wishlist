import React from "react";
import { TextInput, StyleSheet, View, Text } from "react-native";

export default function Input({ label, style, ...props }) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#9aa4bf"
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    color: "#aebadb",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#161e32",
    borderWidth: 1,
    borderColor: "#2a3552",
    color: "#ffffff",
    paddingHorizontal: 12,
  },
});
