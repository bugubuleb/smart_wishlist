import React, {useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Button from '../components/Button';
import Input from '../components/Input';
import Screen from '../components/Screen';
import {login} from '../api';
import {t, getLanguage} from '../i18n';
import {setPreferredCurrency, setToken} from '../storage';
import {useAppTheme} from '../theme';

export default function LoginScreen({navigation}) {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('ru');
  const {palette} = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  React.useEffect(() => {
    getLanguage().then(setLang);
  }, []);

  async function handleLogin() {
    if (!emailOrUsername || !password) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await login({emailOrUsername, password});
      await setToken(data.accessToken || data.token);
      await setPreferredCurrency(
        data?.user?.preferredCurrency || data?.user?.currency || 'RUB',
      );
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>{t(lang, 'appTitle')}</Text>
        <Text style={styles.subtitle}>
          Social wishlist with realtime updates
        </Text>
        <View style={styles.card}>
          <Input
            label={t(lang, 'emailOrUsername')}
            value={emailOrUsername}
            onChangeText={setEmailOrUsername}
            placeholder={t(lang, 'emailOrUsername')}
            autoCapitalize="none"
          />
          <Input
            label={t(lang, 'password')}
            value={password}
            onChangeText={setPassword}
            placeholder={t(lang, 'password')}
            secureTextEntry
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={loading ? t(lang, 'loading') : t(lang, 'login')}
            onPress={handleLogin}
            disabled={loading}
          />
          <Button
            title={t(lang, 'register')}
            onPress={() => navigation.navigate('Register')}
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
      padding: 24,
      gap: 14,
      justifyContent: 'center',
    },
    title: {
      color: palette.colors.text,
      fontSize: 36,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    subtitle: {
      color: palette.colors.muted,
      fontSize: 14,
      marginBottom: 8,
    },
    error: {
      color: palette.colors.danger,
    },
    card: {
      backgroundColor: palette.colors.card,
      borderRadius: palette.radius.lg,
      borderWidth: 1,
      borderColor: palette.colors.border,
      padding: 16,
      gap: 12,
    },
  });
}
