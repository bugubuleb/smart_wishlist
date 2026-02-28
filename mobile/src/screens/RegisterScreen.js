import React, {useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Button from '../components/Button';
import Input from '../components/Input';
import Screen from '../components/Screen';
import {register} from '../api';
import {t, getLanguage} from '../i18n';
import {setPreferredCurrency, setToken} from '../storage';
import {useAppTheme} from '../theme';

export default function RegisterScreen({navigation}) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('ru');
  const {palette} = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  React.useEffect(() => {
    getLanguage().then(setLang);
  }, []);

  async function handleRegister() {
    if (!email || !username || !displayName || !password) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await register({email, username, displayName, password});
      await setToken(data.accessToken || data.token);
      await setPreferredCurrency(
        data?.user?.preferredCurrency || data?.user?.currency || 'RUB',
      );
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>{t(lang, 'register')}</Text>
        <View style={styles.card}>
          <Input
            label="Email"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <Input
            label={t(lang, 'username')}
            placeholder={t(lang, 'username')}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <Input
            label={t(lang, 'displayName')}
            placeholder={t(lang, 'displayName')}
            value={displayName}
            onChangeText={setDisplayName}
          />
          <Input
            label={t(lang, 'password')}
            placeholder={t(lang, 'password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={loading ? t(lang, 'loading') : t(lang, 'register')}
            onPress={handleRegister}
            disabled={loading}
          />
          <Button
            title={t(lang, 'backToLogin')}
            onPress={() => navigation.goBack()}
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
      fontSize: 34,
      fontWeight: '800',
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
