import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  DeviceEventEmitter,
} from 'react-native';
import Button from '../components/Button';
import Input from '../components/Input';
import Screen from '../components/Screen';
import SectionCard from '../components/SectionCard';
import {getToken} from '../storage';
import {
  createWishlist,
  getMyWishlists,
  getSharedWishlists,
  getFriends,
  lookupUserByUsername,
} from '../api';
import {getLanguage, t} from '../i18n';
import {useAppTheme} from '../theme';

export default function DashboardScreen({navigation}) {
  const [myLists, setMyLists] = useState([]);
  const [sharedLists, setSharedLists] = useState([]);
  const [title, setTitle] = useState('');
  const [minContribution, setMinContribution] = useState('100');
  const [recipientMode, setRecipientMode] = useState('self');
  const [recipientInput, setRecipientInput] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [hideFromFoundUser, setHideFromFoundUser] = useState(true);
  const [friends, setFriends] = useState([]);
  const [hiddenUserIds, setHiddenUserIds] = useState([]);
  const [lang, setLang] = useState('ru');
  const [listsTab, setListsTab] = useState('mine');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const {palette} = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const loadData = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      return;
    }
    const [mine, shared] = await Promise.all([
      getMyWishlists(token),
      getSharedWishlists(token),
    ]);
    setMyLists(mine.wishlists || []);
    setSharedLists(shared.wishlists || []);
  }, []);

  useEffect(() => {
    getLanguage().then(setLang);
    const sub = DeviceEventEmitter.addListener('languageChanged', setLang);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('currencyChanged', loadData);
    return () => sub.remove();
  }, [loadData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  useEffect(() => {
    if (!showCreateForm) {
      return;
    }
    async function loadFriends() {
      const token = await getToken();
      if (!token) {
        return;
      }
      const data = await getFriends(token);
      setFriends(data.friends || []);
    }
    loadFriends();
  }, [showCreateForm]);

  useEffect(() => {
    setFoundUser(null);
    setHideFromFoundUser(true);
    if (recipientMode !== 'friend') {
      return;
    }
    const candidate = recipientInput.trim();
    if (!candidate) {
      return;
    }
    let isActive = true;
    const timer = setTimeout(async () => {
      const token = await getToken();
      if (!token) {
        return;
      }
      const result = await lookupUserByUsername(candidate, token).catch(
        () => null,
      );
      if (!isActive) {
        return;
      }
      if (result?.found) {
        setFoundUser(result.user);
      } else {
        setFoundUser(null);
      }
    }, 250);
    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [recipientInput, recipientMode]);

  async function handleCreate() {
    const token = await getToken();
    if (!token || !title.trim()) {
      return;
    }
    const created = await createWishlist(
      {
        title: title.trim(),
        minContribution: Number(minContribution) || 100,
        recipientMode,
        recipientInput: recipientInput.trim() || undefined,
        hideFromRecipient: Boolean(foundUser && hideFromFoundUser),
        hiddenUserIds,
      },
      token,
    );
    setTitle('');
    setRecipientInput('');
    setHiddenUserIds([]);
    setFoundUser(null);
    setShowCreateForm(false);
    await loadData();
    if (created?.slug) {
      navigation.navigate('Wishlist', {slug: created.slug});
    }
  }

  function toggleFriendHidden(friendId) {
    setHiddenUserIds(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId],
    );
  }

  const visibleFriends = useMemo(
    () => friends.filter(friend => !foundUser || friend.id !== foundUser.id),
    [friends, foundUser],
  );

  const renderListRow = item => (
    <Pressable
      style={styles.listItem}
      onPress={() => navigation.navigate('Wishlist', {slug: item.slug})}>
      <Text style={styles.listTitle}>{item.title}</Text>
      {Number(item.my_contributed_sum || 0) > 0 || item.is_responsible ? (
        <Text style={styles.listMeta}>
          {Number(item.my_contributed_sum || 0) > 0
            ? `${Math.ceil(Number(item.my_contributed_sum || 0))} ${
                item.viewer_currency || 'RUB'
              }`
            : ''}
          {Number(item.my_contributed_sum || 0) > 0 && item.is_responsible
            ? ' • '
            : ''}
          {item.is_responsible ? t(lang, 'youAreResponsible') : ''}
        </Text>
      ) : null}
    </Pressable>
  );

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>{t(lang, 'appTitle')}</Text>

        {!showCreateForm ? (
          <Button
            title={t(lang, 'openCreateWishlist')}
            onPress={() => setShowCreateForm(true)}
          />
        ) : (
          <SectionCard title={t(lang, 'createWishlist')}>
            <Pressable
              style={styles.closeTap}
              onPress={() => setShowCreateForm(false)}>
              <Text style={styles.closeTapText}>×</Text>
            </Pressable>

            <Input
              label={t(lang, 'title')}
              value={title}
              onChangeText={setTitle}
              placeholder={t(lang, 'title')}
            />

            <Input
              label={t(lang, 'minContribution')}
              value={minContribution}
              onChangeText={setMinContribution}
              keyboardType="numeric"
              placeholder="100"
            />

            <View style={styles.modeRow}>
              <Pressable
                style={[
                  styles.modeButton,
                  recipientMode === 'self' && styles.modeButtonActive,
                ]}
                onPress={() => setRecipientMode('self')}>
                <Text
                  style={[
                    styles.modeText,
                    recipientMode === 'self' && styles.modeTextActive,
                  ]}>
                  {t(lang, 'recipientSelf')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modeButton,
                  recipientMode === 'friend' && styles.modeButtonActive,
                ]}
                onPress={() => setRecipientMode('friend')}>
                <Text
                  style={[
                    styles.modeText,
                    recipientMode === 'friend' && styles.modeTextActive,
                  ]}>
                  {t(lang, 'recipientFriend')}
                </Text>
              </Pressable>
            </View>

            {recipientMode === 'friend' ? (
              <Input
                label={t(lang, 'recipientInput')}
                value={recipientInput}
                onChangeText={setRecipientInput}
                placeholder={t(lang, 'recipientInput')}
              />
            ) : null}

            {foundUser ? (
              <Pressable
                style={styles.toggleRow}
                onPress={() => setHideFromFoundUser(prev => !prev)}>
                <Text style={styles.toggleText}>
                  {t(lang, 'hideFromFound')} @{foundUser.username}
                </Text>
                <Text style={styles.toggleValue}>
                  {hideFromFoundUser ? '✓' : '—'}
                </Text>
              </Pressable>
            ) : null}

            {visibleFriends.length > 0 ? (
              <View style={styles.friendsWrap}>
                <Text style={styles.muted}>{t(lang, 'hideFromUsers')}</Text>
                <View style={styles.chipsWrap}>
                  {visibleFriends.map(friend => (
                    <Pressable
                      key={friend.id}
                      style={[
                        styles.chip,
                        hiddenUserIds.includes(friend.id) && styles.chipActive,
                      ]}
                      onPress={() => toggleFriendHidden(friend.id)}>
                      <Text
                        style={[
                          styles.chipText,
                          hiddenUserIds.includes(friend.id) &&
                            styles.chipTextActive,
                        ]}>
                        @{friend.username}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <Button title={t(lang, 'createWishlist')} onPress={handleCreate} />
          </SectionCard>
        )}

        <View style={styles.segmented}>
          <Pressable
            style={[
              styles.segmentButton,
              listsTab === 'mine' && styles.segmentButtonActive,
            ]}
            onPress={() => setListsTab('mine')}>
            <Text
              style={[
                styles.segmentText,
                listsTab === 'mine' && styles.segmentTextActive,
              ]}>
              {t(lang, 'mineTab')}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segmentButton,
              listsTab === 'shared' && styles.segmentButtonActive,
            ]}
            onPress={() => setListsTab('shared')}>
            <Text
              style={[
                styles.segmentText,
                listsTab === 'shared' && styles.segmentTextActive,
              ]}>
              {t(lang, 'sharedTab')}
            </Text>
          </Pressable>
        </View>

        <FlatList
          data={listsTab === 'mine' ? myLists : sharedLists}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => renderListRow(item)}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {listsTab === 'mine'
                ? t(lang, 'noWishlists')
                : t(lang, 'noShared')}
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
      fontSize: 30,
      fontWeight: '800',
    },
    closeTap: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.colors.border,
      backgroundColor: palette.colors.bgElevated,
    },
    closeTapText: {
      color: palette.colors.muted,
      fontSize: 18,
      lineHeight: 18,
      fontWeight: '700',
    },
    segmented: {
      flexDirection: 'row',
      borderRadius: palette.radius.md,
      borderWidth: 1,
      borderColor: palette.colors.border,
      backgroundColor: palette.colors.bgElevated,
      padding: 4,
      gap: 4,
      marginTop: 4,
    },
    segmentButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    segmentButtonActive: {
      backgroundColor: palette.colors.primary,
    },
    segmentText: {
      color: palette.colors.muted,
      fontWeight: '700',
      fontSize: 13,
    },
    segmentTextActive: {
      color: '#ffffff',
    },
    modeRow: {
      flexDirection: 'row',
      gap: 8,
    },
    modeButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: palette.radius.md,
      borderWidth: 1,
      borderColor: palette.colors.border,
      backgroundColor: palette.colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeButtonActive: {
      backgroundColor: palette.colors.primary,
      borderColor: palette.colors.primary,
    },
    modeText: {
      color: palette.colors.text,
      fontWeight: '700',
      fontSize: 14,
    },
    modeTextActive: {
      color: '#ffffff',
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: palette.radius.md,
      borderWidth: 1,
      borderColor: palette.colors.border,
      backgroundColor: palette.colors.bgElevated,
      gap: 10,
    },
    toggleText: {
      color: palette.colors.text,
      fontWeight: '600',
      flex: 1,
    },
    toggleValue: {
      color: palette.colors.primary,
      fontWeight: '800',
      fontSize: 16,
    },
    friendsWrap: {
      gap: 8,
    },
    chipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 10,
      minHeight: 34,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.colors.border,
      backgroundColor: palette.colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chipActive: {
      backgroundColor: palette.colors.primary,
      borderColor: palette.colors.primary,
    },
    chipText: {
      color: palette.colors.text,
      fontWeight: '600',
      fontSize: 13,
    },
    chipTextActive: {
      color: '#ffffff',
    },
    listItem: {
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: palette.radius.md,
      backgroundColor: palette.colors.bgElevated,
      borderWidth: 1,
      borderColor: palette.colors.border,
      gap: 4,
    },
    listTitle: {
      color: palette.colors.text,
      fontWeight: '700',
      fontSize: 18,
    },
    listMeta: {
      color: palette.colors.muted,
      fontSize: 12,
      fontWeight: '600',
    },
    listGap: {
      gap: 8,
      paddingBottom: 4,
    },
    muted: {
      color: palette.colors.muted,
      fontSize: 12,
      fontWeight: '600',
    },
    empty: {
      color: palette.colors.muted,
      paddingVertical: 8,
    },
  });
}
