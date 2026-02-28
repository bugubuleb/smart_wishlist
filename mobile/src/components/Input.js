import React from 'react';
import {TextInput, StyleSheet, View, Text} from 'react-native';
import {useAppTheme} from '../theme';

export default function Input({label, style, ...props}) {
  const {palette, mode} = useAppTheme();
  const styles = React.useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={mode === 'light' ? '#7a8292' : '#9aa4bf'}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

function createStyles(palette) {
  return StyleSheet.create({
    wrapper: {
      gap: 8,
    },
    label: {
      color: palette.colors.muted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    input: {
      minHeight: 50,
      borderRadius: palette.radius.md,
      backgroundColor: palette.colors.bgElevated,
      borderWidth: 1,
      borderColor: palette.colors.border,
      color: palette.colors.text,
      paddingHorizontal: 14,
      fontSize: 15,
    },
  });
}
