import React, {useEffect, useMemo, useState} from 'react';
import {View, Text, StyleSheet, FlatList} from 'react-native';
import Button from '../components/Button';
import Input from '../components/Input';
import Screen from '../components/Screen';
import SectionCard from '../components/SectionCard';
import {
  getFriends,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
} from '../api';
import {getToken} from '../storage';
import {getLanguage, t} from '../i18n';
import {useAppTheme} from '../theme';

export default function FriendsScreen() {
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [username, setUsername] = useState('');
  const [lang, setLang] = useState('ru');
  const {palette} = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  useEffect(() => {
    getLanguage().then(setLang);
  }, []);

  async function load() {
    const token = await getToken();
    if (!token) {
      return;
    }
    const data = await getFriends(token);
    setFriends(data.friends || []);
    setIncoming(data.incoming || []);
    setOutgoing(data.outgoing || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSend() {
    const token = await getToken();
    if (!token || !username.trim()) {
      return;
    }
    await sendFriendRequest(username.trim(), [], token);
    setUsername('');
    await load();
  }

  async function handleAccept(requestId) {
    const token = await getToken();
    if (!token) {
      return;
    }
    await acceptFriendRequest(requestId, [], token);
    await load();
  }

  async function handleReject(requestId) {
    const token = await getToken();
    if (!token) {
      return;
    }
    await rejectFriendRequest(requestId, token);
    await load();
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>{t(lang, 'friends')}</Text>
        <SectionCard>
          <Input
            label={t(lang, 'addFriend')}
            value={username}
            onChangeText={setUsername}
            placeholder={t(lang, 'username')}
          />
          <Button title={t(lang, 'sendRequest')} onPress={handleSend} />
        </SectionCard>

        <Text style={styles.sectionTitle}>{t(lang, 'incoming')}</Text>
        <FlatList
          data={incoming}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => (
            <View style={styles.rowItem}>
              <Text style={styles.itemText}>@{item.from_username}</Text>
              <View style={styles.rowButtons}>
                <Button
                  title={t(lang, 'accept')}
                  onPress={() => handleAccept(item.id)}
                />
                <Button
                  title={t(lang, 'reject')}
                  onPress={() => handleReject(item.id)}
                  variant="secondary"
                />
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>{t(lang, 'noIncoming')}</Text>
          }
        />

        <Text style={styles.sectionTitle}>{t(lang, 'outgoing')}</Text>
        <FlatList
          data={outgoing}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => (
            <Text style={styles.simpleItem}>@{item.to_username}</Text>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>{t(lang, 'noOutgoing')}</Text>
          }
        />

        <Text style={styles.sectionTitle}>{t(lang, 'friends')}</Text>
        <FlatList
          data={friends}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => (
            <Text style={styles.simpleItem}>
              @{item.username} ({item.display_name})
            </Text>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>{t(lang, 'noFriends')}</Text>
          }
        />
      </View>
    </Screen>
  );
}

function createStyles(palette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      gap: 12,
    },
    title: {
      color: palette.colors.text,
      fontSize: 28,
      fontWeight: '800',
    },
    sectionTitle: {
      color: palette.colors.muted,
      marginTop: 8,
      fontWeight: '700',
      fontSize: 12,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    rowItem: {
      backgroundColor: palette.colors.bgElevated,
      borderRadius: palette.radius.md,
      borderWidth: 1,
      borderColor: palette.colors.border,
      padding: 12,
      gap: 8,
    },
    rowButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    itemText: {
      color: palette.colors.text,
      fontWeight: '700',
    },
    simpleItem: {
      color: palette.colors.text,
      backgroundColor: palette.colors.bgElevated,
      borderRadius: palette.radius.md,
      borderWidth: 1,
      borderColor: palette.colors.border,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    empty: {
      color: palette.colors.muted,
      paddingVertical: 8,
    },
  });
}
