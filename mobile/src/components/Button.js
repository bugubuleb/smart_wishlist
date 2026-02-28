import React from 'react';
import {Pressable, Text, StyleSheet} from 'react-native';
import {useAppTheme} from '../theme';

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
}) {
  const {palette, mode} = useAppTheme();
  const styles = React.useMemo(
    () => createStyles(palette, mode),
    [palette, mode],
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({pressed}) => [
        styles.base,
        variant === 'secondary' && styles.secondary,
        disabled && styles.disabled,
        pressed &&
          !disabled &&
          (variant === 'secondary' ? styles.pressedSecondary : styles.pressed),
      ]}>
      <Text
        style={[
          styles.label,
          variant === 'secondary' && styles.labelSecondary,
        ]}>
        {title}
      </Text>
    </Pressable>
  );
}

function createStyles(palette, mode) {
  return StyleSheet.create({
    base: {
      minHeight: 48,
      paddingHorizontal: 16,
      borderRadius: palette.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.colors.primary,
    },
    secondary: {
      backgroundColor: palette.colors.bgElevated,
      borderWidth: 1,
      borderColor: palette.colors.border,
    },
    label: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '700',
    },
    labelSecondary: {
      color: palette.colors.text,
    },
    disabled: {
      opacity: 0.55,
    },
    pressed: {
      transform: [{scale: 0.985}],
      backgroundColor: palette.colors.primaryPressed,
    },
    pressedSecondary: {
      transform: [{scale: 0.985}],
      backgroundColor: mode === 'light' ? '#eef1f6' : '#16213b',
    },
  });
}
