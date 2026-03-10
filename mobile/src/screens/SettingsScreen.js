import React, {useEffect, useMemo, useState} from 'react';
import {
  DeviceEventEmitter,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Button from '../components/Button';
import Screen from '../components/Screen';
import {clearToken, getToken, setPreferredCurrency} from '../storage';
import {
  getAvailableCurrencies,
  getMe,
  setCurrencyPreference,
  setLanguagePreference,
} from '../api';
import {getLanguage, setLanguage, t} from '../i18n';
import {getThemeMode, setThemeMode, useAppTheme} from '../theme';

function ToggleRow({styles, title, value, onPress}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </Pressable>
  );
}

export default function SettingsScreen({navigation}) {
  const [language, setLanguageState] = useState('ru');
  const [currency, setCurrency] = useState('RUB');
  const [themeMode, setThemeModeState] = useState('dark');
  const [availableCurrencies, setAvailableCurrencies] = useState([
    'RUB',
    'USD',
    'EUR',
    'KZT',
  ]);
  const {palette} = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  useEffect(() => {
    getLanguage().then(setLanguageState);
    getThemeMode().then(setThemeModeState);
  }, []);

  useEffect(() => {
    async function load() {
      const token = await getToken();
      if (!token) {
        return;
      }
      const me = await getMe(token);
      if (me?.preferredCurrency || me?.currency) {
        const selectedCurrency = me.preferredCurrency || me.currency;
        setCurrency(selectedCurrency);
        await setPreferredCurrency(selectedCurrency);
      }
      if (me?.preferredLanguage || me?.language) {
        setLanguageState(me.preferredLanguage || me.language);
      }
      const list = await getAvailableCurrencies().catch(() => null);
      if (list?.currencies?.length) {
        setAvailableCurrencies(list.currencies);
      }
    }
    load();
  }, []);

  async function handleLogout() {
    await clearToken();
    navigation.reset({index: 0, routes: [{name: 'Login'}]});
  }

  async function toggleLanguage() {
    const token = await getToken();
    if (!token) {
      return;
    }
    const next = language === 'ru' ? 'en' : 'ru';
    setLanguageState(next);
    await setLanguage(next);
    await setLanguagePreference(next, token);
  }

  async function toggleTheme() {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeModeState(next);
    await setThemeMode(next);
  }

  async function cycleCurrency() {
    const token = await getToken();
    if (!token || !availableCurrencies.length) {
      return;
    }
    const currentIndex = availableCurrencies.findIndex(
      code => String(code).toUpperCase() === String(currency).toUpperCase(),
    );
    const nextIndex =
      currentIndex < 0 ? 0 : (currentIndex + 1) % availableCurrencies.length;
    const next = String(availableCurrencies[nextIndex]).toUpperCase();

    setCurrency(next);
    await setPreferredCurrency(next);
    await setCurrencyPreference(next, token);
    DeviceEventEmitter.emit('currencyChanged', next);
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>{t(language, 'settings')}</Text>

        <View style={styles.card}>
          <ToggleRow
            styles={styles}
            title={t(language, 'language')}
            value={language.toUpperCase()}
            onPress={toggleLanguage}
          />
          <ToggleRow
            styles={styles}
            title={t(language, 'settingsTheme')}
            value={
              themeMode === 'light'
                ? t(language, 'themeLight')
                : t(language, 'themeDark')
            }
            onPress={toggleTheme}
          />
          <ToggleRow
            styles={styles}
            title={t(language, 'currency')}
            value={currency}
            onPress={cycleCurrency}
          />
        </View>

        <View style={styles.logoutWrap}>
          <Button
            title={t(language, 'logout')}
            onPress={handleLogout}
            variant="secondary"
          />
        </View>
      </View>
    </Screen>
  );
}

function createStyles(palette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      paddingBottom: 96,
      gap: 12,
    },
    title: {
      color: palette.colors.text,
      fontSize: 28,
      fontWeight: '800',
    },
    card: {
      backgroundColor: palette.colors.card,
      borderRadius: palette.radius.lg,
      borderWidth: 1,
      borderColor: palette.colors.border,
      padding: 14,
      gap: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: palette.radius.md,
      borderWidth: 1,
      borderColor: palette.colors.border,
      backgroundColor: palette.colors.bgElevated,
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 12,
    },
    rowTitle: {
      color: palette.colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
    rowValue: {
      color: palette.colors.primary,
      fontSize: 18,
      fontWeight: '800',
    },
    logoutWrap: {
      marginTop: 'auto',
      marginBottom: 4,
    },
  });
}
