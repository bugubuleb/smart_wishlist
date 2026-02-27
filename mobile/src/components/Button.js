import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";

export default function Button({ title, onPress, variant = "primary", disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === "secondary" && styles.secondary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.label, variant === "secondary" && styles.labelSecondary]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3f6df6",
  },
  secondary: {
    backgroundColor: "#1b2236",
    borderWidth: 1,
    borderColor: "#2b3552",
  },
  label: {
    color: "#ffffff",
    fontWeight: "700",
  },
  labelSecondary: {
    color: "#e6ecff",
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
