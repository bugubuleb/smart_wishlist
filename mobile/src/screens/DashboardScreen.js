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
  const [step, setStep] = useState(1);
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
    async function loadFriends() {
      const token = await getToken();
      if (!token) {
        return;
      }
      const data = await getFriends(token);
      setFriends(data.friends || []);
    }
    if (step === 2) {
      loadFriends();
    }
  }, [step]);

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
    await createWishlist(
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
    setStep(1);
    setShowCreateForm(false);
    await loadData();
  }

  const visibleFriends = useMemo(
    () => friends.filter(friend => !foundUser || friend.id !== foundUser.id),
    [friends, foundUser],
  );

  const renderListRow = item => (
    <Pressable
      style={styles.listItem}
      onPress={() => navigation.navigate('Wishlist', {slug: item.slug})}>
      <View style={styles.listTopRow}>
        <Text style={styles.listTitle}>{item.title}</Text>
        <View style={styles.listRightColumn}>
          {Number(item.my_contributed_sum || 0) > 0 ? (
            <Text style={styles.listAmount}>
              {Math.ceil(Number(item.my_contributed_sum || 0))}{' '}
              {item.viewer_currency || 'RUB'}
            </Text>
          ) : null}
          {item.is_responsible ? (
            <Text style={styles.responsibleBadge}>
              {t(lang, 'youAreResponsible')}
            </Text>
          ) : null}
        </View>
      </View>
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
            <Input
              label={t(lang, 'title')}
              value={title}
              onChangeText={setTitle}
              placeholder={t(lang, 'title')}
            />

            {step === 1 ? (
              <>
                <View style={styles.row}>
                  <Button
                    title={t(lang, 'recipientSelf')}
                    onPress={() => setRecipientMode('self')}
                    variant={recipientMode === 'self' ? 'primary' : 'secondary'}
                  />
                  <Button
                    title={t(lang, 'recipientFriend')}
                    onPress={() => setRecipientMode('friend')}
                    variant={
                      recipientMode === 'friend' ? 'primary' : 'secondary'
                    }
                  />
                </View>
                {recipientMode === 'friend' ? (
                  <Input
                    label={t(lang, 'recipientInput')}
                    value={recipientInput}
                    onChangeText={setRecipientInput}
                    placeholder={t(lang, 'recipientInput')}
                  />
                ) : null}
                <Input
                  label={t(lang, 'minContribution')}
                  value={minContribution}
                  onChangeText={setMinContribution}
                  keyboardType="numeric"
                  placeholder="100"
                />
                <View style={styles.row}>
                  <Button
                    title={t(lang, 'back')}
                    onPress={() => {
                      setShowCreateForm(false);
                      setStep(1);
                    }}
                    variant="secondary"
                  />
                  <Button title={t(lang, 'next')} onPress={() => setStep(2)} />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>
                  {t(lang, 'privacyTitle')}
                </Text>
                {foundUser ? (
                  <Button
                    title={`${t(lang, 'hideFromFound')} @${foundUser.username}`}
                    onPress={() => setHideFromFoundUser(prev => !prev)}
                    variant={hideFromFoundUser ? 'primary' : 'secondary'}
                  />
                ) : null}
                {visibleFriends.length > 0 ? (
                  <View style={styles.listBlock}>
                    <Text style={styles.muted}>{t(lang, 'hideFromUsers')}</Text>
                    {visibleFriends.map(friend => (
                      <Button
                        key={friend.id}
                        title={`@${friend.username}`}
                        onPress={() => {
                          setHiddenUserIds(prev =>
                            prev.includes(friend.id)
                              ? prev.filter(id => id !== friend.id)
                              : [...prev, friend.id],
                          );
                        }}
                        variant={
                          hiddenUserIds.includes(friend.id)
                            ? 'primary'
                            : 'secondary'
                        }
                      />
                    ))}
                  </View>
                ) : null}
                <View style={styles.row}>
                  <Button
                    title={t(lang, 'prev')}
                    onPress={() => setStep(1)}
                    variant="secondary"
                  />
                  <Button
                    title={t(lang, 'createWishlist')}
                    onPress={handleCreate}
                  />
                </View>
              </>
            )}
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
    sectionTitle: {
      color: palette.colors.muted,
      marginTop: 12,
      marginBottom: 4,
      fontWeight: '700',
      fontSize: 12,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    segmented: {
      flexDirection: 'row',
      borderRadius: palette.radius.md,
      borderWidth: 1,
      borderColor: palette.colors.border,
      backgroundColor: palette.colors.bgElevated,
      padding: 4,
      gap: 4,
      marginTop: 6,
    },
    segmentButton: {
      flex: 1,
      minHeight: 40,
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
    listItem: {
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: palette.radius.md,
      backgroundColor: palette.colors.bgElevated,
      borderWidth: 1,
      borderColor: palette.colors.border,
      gap: 4,
    },
    listTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    listTitle: {
      color: palette.colors.text,
      fontWeight: '700',
      fontSize: 18,
      flex: 1,
    },
    listRightColumn: {
      alignItems: 'flex-end',
      gap: 4,
    },
    listAmount: {
      color: palette.colors.text,
      fontWeight: '700',
      fontSize: 12,
    },
    responsibleBadge: {
      color: palette.colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    listGap: {
      gap: 8,
      paddingBottom: 4,
    },
    empty: {
      color: palette.colors.muted,
      paddingVertical: 8,
    },
    row: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    listBlock: {
      gap: 8,
    },
    muted: {
      color: palette.colors.muted,
    },
  });
}
