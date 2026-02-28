import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import {DeviceEventEmitter} from 'react-native';

const THEME_KEY = 'smartwishlist_theme';

export const palettes = {
  dark: {
    colors: {
      bg: '#0d111d',
      bgElevated: '#151d31',
      card: '#182034',
      border: '#324463',
      text: '#e9eefb',
      muted: '#aebadb',
      primary: '#7c9dff',
      primaryPressed: '#6588ef',
      successCard: '#183c31',
      danger: '#ff7684',
      bgA: '#1d2140',
      bgB: '#16314f',
      bgC: '#2a1d45',
      dot: 'rgba(233, 238, 251, 0.8)',
    },
    radius: {
      md: 12,
      lg: 16,
    },
  },
  light: {
    colors: {
      bg: '#f5f7fb',
      bgElevated: '#ffffff',
      card: '#ffffff',
      border: '#b7c7e7',
      text: '#1d2433',
      muted: '#5f6f89',
      primary: '#4f7cff',
      primaryPressed: '#446de1',
      successCard: '#e6f0ff',
      danger: '#c94a57',
      bgA: '#e4edff',
      bgB: '#e7f3ff',
      bgC: '#efe6ff',
      dot: 'rgba(29, 36, 51, 0.45)',
    },
    radius: {
      md: 12,
      lg: 16,
    },
  },
};

export const theme = palettes.dark;

export function resolveThemeMode(mode) {
  return mode === 'light' ? 'light' : 'dark';
}

export function getPalette(mode) {
  return palettes[resolveThemeMode(mode)];
}

export async function getThemeMode() {
  const value = await AsyncStorage.getItem(THEME_KEY);
  return resolveThemeMode(value);
}

export async function setThemeMode(mode) {
  const resolved = resolveThemeMode(mode);
  await AsyncStorage.setItem(THEME_KEY, resolved);
  DeviceEventEmitter.emit('themeChanged', resolved);
}

export function useAppTheme() {
  const [mode, setMode] = React.useState('dark');

  React.useEffect(() => {
    getThemeMode().then(setMode);
    const sub = DeviceEventEmitter.addListener('themeChanged', setMode);
    return () => sub.remove();
  }, []);

  return {
    mode,
    palette: getPalette(mode),
  };
}
