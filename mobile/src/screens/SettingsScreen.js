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
  setCurrencyPreference,
  setLanguagePreference,
  getMe,
  getAvailableCurrencies,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../api';
import {getLanguage, setLanguage, t} from '../i18n';
import {getThemeMode, setThemeMode, useAppTheme} from '../theme';

function SectionRow({styles, title, value, onPress}) {
  return (
    <Pressable style={styles.sectionRow} onPress={onPress}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionValue}>{value}</Text>
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
  const [section, setSection] = useState('root');
  const [notificationPrefs, setNotificationPrefs] = useState({
    inAppEnabled: true,
    pushEnabled: true,
    wishlistSharedEnabled: true,
    reservationEnabled: true,
    fundedEnabled: true,
    friendRequestsEnabled: true,
  });
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
      if (me?.preferredLanguage) {
        setLanguageState(me.preferredLanguage);
      }
      const list = await getAvailableCurrencies().catch(() => null);
      if (list?.currencies) {
        setAvailableCurrencies(list.currencies);
      }
      const prefs = await getNotificationPreferences(token).catch(() => null);
      if (prefs) {
        setNotificationPrefs(prev => ({
          ...prev,
          ...prefs,
        }));
      }
    }
    load();
  }, []);

  async function handleLogout() {
    await clearToken();
    navigation.reset({index: 0, routes: [{name: 'Login'}]});
  }

  async function updateLanguage(next) {
    const token = await getToken();
    if (!token) {
      return;
    }
    setLanguageState(next);
    await setLanguage(next);
    await setLanguagePreference(next, token);
  }

  async function updateCurrency(next) {
    const token = await getToken();
    if (!token) {
      return;
    }
    setCurrency(next);
    await setPreferredCurrency(next);
    await setCurrencyPreference(next, token);
    DeviceEventEmitter.emit('currencyChanged', next);
  }

  async function updateTheme(next) {
    setThemeModeState(next);
    await setThemeMode(next);
  }

  async function updateNotificationPref(key, value) {
    const token = await getToken();
    if (!token) {
      return;
    }
    const next = {...notificationPrefs, [key]: value};
    setNotificationPrefs(next);
    await updateNotificationPreferences({[key]: value}, token);
  }

  const sectionTitle = useMemo(() => {
    if (section === 'language') {
      return t(language, 'language');
    }
    if (section === 'currency') {
      return t(language, 'currency');
    }
    if (section === 'theme') {
      return t(language, 'settingsTheme');
    }
    if (section === 'notifications') {
      return t(language, 'notificationSettings');
    }
    return t(language, 'settings');
  }, [section, language]);

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>{sectionTitle}</Text>

        {section === 'root' ? (
          <View style={styles.card}>
            <SectionRow
              styles={styles}
              title={t(language, 'language')}
              value={language.toUpperCase()}
              onPress={() => setSection('language')}
            />
            <SectionRow
              styles={styles}
              title={t(language, 'currency')}
              value={currency}
              onPress={() => setSection('currency')}
            />
            <SectionRow
              styles={styles}
              title={t(language, 'settingsTheme')}
              value={
                themeMode === 'light'
                  ? t(language, 'themeLight')
                  : t(language, 'themeDark')
              }
              onPress={() => setSection('theme')}
            />
            <SectionRow
              styles={styles}
              title={t(language, 'notificationsBlock')}
              value={
                notificationPrefs.inAppEnabled
                  ? t(language, 'notificationsOn')
                  : t(language, 'notificationsOff')
              }
              onPress={() => setSection('notifications')}
            />
          </View>
        ) : null}

        {section === 'language' ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <Button
                title="RU"
                onPress={() => updateLanguage('ru')}
                variant={language === 'ru' ? 'primary' : 'secondary'}
              />
              <Button
                title="EN"
                onPress={() => updateLanguage('en')}
                variant={language === 'en' ? 'primary' : 'secondary'}
              />
            </View>
            <Button
              title={t(language, 'back')}
              onPress={() => setSection('root')}
              variant="secondary"
            />
          </View>
        ) : null}

        {section === 'currency' ? (
          <View style={styles.card}>
            <View style={styles.row}>
              {availableCurrencies.map(code => (
                <Button
                  key={code}
                  title={code}
                  onPress={() => updateCurrency(code)}
                  variant={currency === code ? 'primary' : 'secondary'}
                />
              ))}
            </View>
            <Button
              title={t(language, 'back')}
              onPress={() => setSection('root')}
              variant="secondary"
            />
          </View>
        ) : null}

        {section === 'theme' ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <Button
                title={t(language, 'themeDark')}
                onPress={() => updateTheme('dark')}
                variant={themeMode === 'dark' ? 'primary' : 'secondary'}
              />
              <Button
                title={t(language, 'themeLight')}
                onPress={() => updateTheme('light')}
                variant={themeMode === 'light' ? 'primary' : 'secondary'}
              />
            </View>
            <Button
              title={t(language, 'back')}
              onPress={() => setSection('root')}
              variant="secondary"
            />
          </View>
        ) : null}

        {section === 'notifications' ? (
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleTitle}>
                {t(language, 'notificationsInApp')}
              </Text>
              <Button
                title={
                  notificationPrefs.inAppEnabled
                    ? t(language, 'notificationsOn')
                    : t(language, 'notificationsOff')
                }
                onPress={() =>
                  updateNotificationPref(
                    'inAppEnabled',
                    !notificationPrefs.inAppEnabled,
                  )
                }
                variant={
                  notificationPrefs.inAppEnabled ? 'primary' : 'secondary'
                }
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleTitle}>
                {t(language, 'notificationsPush')}
              </Text>
              <Button
                title={
                  notificationPrefs.pushEnabled
                    ? t(language, 'notificationsOn')
                    : t(language, 'notificationsOff')
                }
                onPress={() =>
                  updateNotificationPref(
                    'pushEnabled',
                    !notificationPrefs.pushEnabled,
                  )
                }
                variant={
                  notificationPrefs.pushEnabled ? 'primary' : 'secondary'
                }
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleTitle}>
                {t(language, 'notificationsWishlistShared')}
              </Text>
              <Button
                title={
                  notificationPrefs.wishlistSharedEnabled
                    ? t(language, 'notificationsOn')
                    : t(language, 'notificationsOff')
                }
                onPress={() =>
                  updateNotificationPref(
                    'wishlistSharedEnabled',
                    !notificationPrefs.wishlistSharedEnabled,
                  )
                }
                variant={
                  notificationPrefs.wishlistSharedEnabled
                    ? 'primary'
                    : 'secondary'
                }
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleTitle}>
                {t(language, 'notificationsReservation')}
              </Text>
              <Button
                title={
                  notificationPrefs.reservationEnabled
                    ? t(language, 'notificationsOn')
                    : t(language, 'notificationsOff')
                }
                onPress={() =>
                  updateNotificationPref(
                    'reservationEnabled',
                    !notificationPrefs.reservationEnabled,
                  )
                }
                variant={
                  notificationPrefs.reservationEnabled ? 'primary' : 'secondary'
                }
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleTitle}>
                {t(language, 'notificationsFunded')}
              </Text>
              <Button
                title={
                  notificationPrefs.fundedEnabled
                    ? t(language, 'notificationsOn')
                    : t(language, 'notificationsOff')
                }
                onPress={() =>
                  updateNotificationPref(
                    'fundedEnabled',
                    !notificationPrefs.fundedEnabled,
                  )
                }
                variant={
                  notificationPrefs.fundedEnabled ? 'primary' : 'secondary'
                }
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleTitle}>
                {t(language, 'notificationsFriendRequests')}
              </Text>
              <Button
                title={
                  notificationPrefs.friendRequestsEnabled
                    ? t(language, 'notificationsOn')
                    : t(language, 'notificationsOff')
                }
                onPress={() =>
                  updateNotificationPref(
                    'friendRequestsEnabled',
                    !notificationPrefs.friendRequestsEnabled,
                  )
                }
                variant={
                  notificationPrefs.friendRequestsEnabled
                    ? 'primary'
                    : 'secondary'
                }
              />
            </View>
            <Button
              title={t(language, 'back')}
              onPress={() => setSection('root')}
              variant="secondary"
            />
          </View>
        ) : null}

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
    sectionRow: {
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
    sectionTitle: {
      color: palette.colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
    sectionValue: {
      color: palette.colors.primary,
      fontSize: 18,
      fontWeight: '800',
    },
    row: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    toggleTitle: {
      color: palette.colors.text,
      fontSize: 15,
      fontWeight: '700',
      flex: 1,
    },
    logoutWrap: {
      marginTop: 'auto',
      marginBottom: 4,
    },
  });
}
