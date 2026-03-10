import React, {useEffect, useMemo, useState} from 'react';
import {View, Text, StyleSheet, FlatList, Pressable} from 'react-native';
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
  const [tab, setTab] = useState('friends');
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

  const listData =
    tab === 'incoming' ? incoming : tab === 'outgoing' ? outgoing : friends;

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

        <View style={styles.segmented}>
          <Pressable
            style={[
              styles.segmentBtn,
              tab === 'friends' && styles.segmentActive,
            ]}
            onPress={() => setTab('friends')}>
            <Text
              style={[
                styles.segmentText,
                tab === 'friends' && styles.segmentTextActive,
              ]}>
              {t(lang, 'friends')}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segmentBtn,
              tab === 'incoming' && styles.segmentActive,
            ]}
            onPress={() => setTab('incoming')}>
            <Text
              style={[
                styles.segmentText,
                tab === 'incoming' && styles.segmentTextActive,
              ]}>
              {t(lang, 'incoming')}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segmentBtn,
              tab === 'outgoing' && styles.segmentActive,
            ]}
            onPress={() => setTab('outgoing')}>
            <Text
              style={[
                styles.segmentText,
                tab === 'outgoing' && styles.segmentTextActive,
              ]}>
              {t(lang, 'outgoing')}
            </Text>
          </Pressable>
        </View>

        <FlatList
          data={listData}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => {
            if (tab === 'incoming') {
              return (
                <View style={styles.rowItem}>
                  <Text style={styles.itemText}>@{item.from_username}</Text>
                  <View style={styles.compactActions}>
                    <Pressable
                      style={[styles.actionChip, styles.actionChipPrimary]}
                      onPress={() => handleAccept(item.id)}>
                      <Text style={styles.actionChipPrimaryText}>
                        {t(lang, 'accept')}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionChip}
                      onPress={() => handleReject(item.id)}>
                      <Text style={styles.actionChipText}>
                        {t(lang, 'reject')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            }

            if (tab === 'outgoing') {
              return <Text style={styles.simpleItem}>@{item.to_username}</Text>;
            }

            return (
              <Text style={styles.simpleItem}>
                @{item.username} ({item.display_name})
              </Text>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {tab === 'incoming'
                ? t(lang, 'noIncoming')
                : tab === 'outgoing'
                ? t(lang, 'noOutgoing')
                : t(lang, 'noFriends')}
            </Text>
          }
          contentContainerStyle={styles.listGap}
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
    segmented: {
      flexDirection: 'row',
      borderRadius: palette.radius.md,
      borderWidth: 1,
      borderColor: palette.colors.border,
      backgroundColor: palette.colors.bgElevated,
      padding: 4,
      gap: 4,
    },
    segmentBtn: {
      flex: 1,
      minHeight: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentActive: {
      backgroundColor: palette.colors.primary,
    },
    segmentText: {
      color: palette.colors.muted,
      fontWeight: '700',
      fontSize: 12,
    },
    segmentTextActive: {
      color: '#fff',
    },
    rowItem: {
      backgroundColor: palette.colors.bgElevated,
      borderRadius: palette.radius.md,
      borderWidth: 1,
      borderColor: palette.colors.border,
      padding: 12,
      gap: 10,
    },
    compactActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionChip: {
      minHeight: 30,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.colors.card,
    },
    actionChipPrimary: {
      backgroundColor: palette.colors.primary,
      borderColor: palette.colors.primary,
    },
    actionChipText: {
      color: palette.colors.text,
      fontWeight: '700',
      fontSize: 12,
    },
    actionChipPrimaryText: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 12,
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
    listGap: {
      gap: 8,
    },
    empty: {
      color: palette.colors.muted,
      paddingVertical: 8,
    },
  });
}
