import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {View, Text, StyleSheet, FlatList, Pressable} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import Input from '../components/Input';
import Screen from '../components/Screen';
import SectionCard from '../components/SectionCard';
import {
  assignSharedWishlistToEvent,
  createWishlist,
  getEventWishlists,
  getSharedWishlists,
  lookupUserByUsername,
} from '../api';
import {getToken} from '../storage';
import {getLanguage, t} from '../i18n';
import {useAppTheme} from '../theme';

export default function EventScreen({navigation, route}) {
  const {eventId} = route.params;
  const [event, setEvent] = useState(null);
  const [wishlists, setWishlists] = useState([]);
  const [sharedWishlists, setSharedWishlists] = useState([]);
  const [assigningWishlistId, setAssigningWishlistId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [minContribution, setMinContribution] = useState('100');
  const [recipientMode, setRecipientMode] = useState('self');
  const [recipientInput, setRecipientInput] = useState('');
  const [lang, setLang] = useState('ru');
  const {palette} = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  useEffect(() => {
    getLanguage().then(setLang);
  }, []);

  const loadData = useCallback(async () => {
    const token = await getToken();
    if (!token || !eventId) {
      return;
    }
    const [eventData, sharedData] = await Promise.all([
      getEventWishlists(eventId, token),
      getSharedWishlists(token).catch(() => ({wishlists: []})),
    ]);
    setEvent(eventData.event || null);
    setWishlists(eventData.wishlists || []);
    setSharedWishlists(sharedData.wishlists || []);
  }, [eventId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  async function handleCreateWishlist() {
    const token = await getToken();
    if (!token || !title.trim()) {
      return;
    }

    let finalRecipient = recipientInput.trim() || undefined;
    if (recipientMode === 'friend' && recipientInput.trim()) {
      const lookup = await lookupUserByUsername(
        recipientInput.trim(),
        token,
      ).catch(() => null);
      if (lookup?.found) {
        finalRecipient = lookup.user.username;
      }
    }

    const created = await createWishlist(
      {
        eventId: Number(eventId),
        title: title.trim(),
        minContribution: Number(minContribution) || 100,
        recipientMode,
        recipientInput: finalRecipient,
      },
      token,
    );
    setTitle('');
    setMinContribution('100');
    setRecipientMode('self');
    setRecipientInput('');
    setShowCreate(false);
    await loadData();
    if (created?.slug) {
      navigation.navigate('Wishlist', {slug: created.slug});
    }
  }

  async function handleAttachSharedWishlist(wishlistId) {
    const token = await getToken();
    if (!token || !eventId || !wishlistId) {
      return;
    }
    setAssigningWishlistId(Number(wishlistId));
    await assignSharedWishlistToEvent(eventId, wishlistId, token).catch(
      () => null,
    );
    setAssigningWishlistId(null);
    await loadData();
  }

  const availableSharedWishlists = useMemo(
    () =>
      sharedWishlists.filter(
        item => Number(item.assigned_event_id || 0) !== Number(eventId),
      ),
    [eventId, sharedWishlists],
  );

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path
                d="M14.5 5.5L8.5 12L14.5 18.5"
                stroke={palette.colors.text}
                strokeWidth={2.3}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </Pressable>
          <Text style={styles.title}>{event?.title || t(lang, 'event')}</Text>
          <Pressable
            style={styles.createPill}
            onPress={() => setShowCreate(prev => !prev)}>
            <Text style={styles.createPillText}>{t(lang, 'create')}</Text>
          </Pressable>
        </View>

        {showCreate ? (
          <SectionCard>
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
            <Pressable style={styles.submitPill} onPress={handleCreateWishlist}>
              <Text style={styles.submitPillText}>
                {t(lang, 'createWishlist')}
              </Text>
            </Pressable>
          </SectionCard>
        ) : null}

        {availableSharedWishlists.length > 0 ? (
          <SectionCard>
            <Text style={styles.sectionTitle}>{t(lang, 'sharedWithYou')}</Text>
            <View style={styles.sharedList}>
              {availableSharedWishlists.map(item => {
                const isMoving = Number(item.assigned_event_id || 0) > 0;
                const isLoading =
                  Number(assigningWishlistId) === Number(item.id);
                return (
                  <View key={String(item.id)} style={styles.sharedRow}>
                    <View style={styles.sharedRowTextWrap}>
                      <Text style={styles.sharedRowTitle}>{item.title}</Text>
                      <Text style={styles.sharedRowMeta}>
                        {t(lang, 'sharedFrom')} @{item.owner_username}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.sharedAttachButton}
                      disabled={isLoading}
                      onPress={() => handleAttachSharedWishlist(item.id)}>
                      <Text style={styles.sharedAttachButtonText}>
                        {isLoading
                          ? t(lang, 'loading')
                          : isMoving
                          ? t(lang, 'moveToThisEvent')
                          : t(lang, 'addToThisEvent')}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </SectionCard>
        ) : null}

        <FlatList
          data={wishlists}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => (
            <Pressable
              style={styles.listItem}
              onPress={() =>
                navigation.navigate('Wishlist', {slug: item.slug})
              }>
              <Text style={styles.listTitle}>{item.title}</Text>
              {(() => {
                const meta = [];
                if (item.is_shared && item.owner_username) {
                  meta.push(`${t(lang, 'sharedFrom')} @${item.owner_username}`);
                }
                if (Number(item.my_contributed_sum || 0) > 0) {
                  meta.push(
                    `${Math.ceil(Number(item.my_contributed_sum || 0))} ${
                      item.viewer_currency || 'RUB'
                    }`,
                  );
                }
                if (item.is_responsible) {
                  meta.push(t(lang, 'youAreResponsible'));
                }
                if (!meta.length) {
                  return null;
                }
                return <Text style={styles.listMeta}>{meta.join(' • ')}</Text>;
              })()}
            </Pressable>
          )}
          contentContainerStyle={styles.listGap}
          ListEmptyComponent={
            <Text style={styles.empty}>{t(lang, 'noWishlists')}</Text>
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
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    backButton: {
      width: 38,
      height: 38,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.colors.border,
      backgroundColor: palette.colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      flex: 1,
      color: palette.colors.text,
      fontSize: 24,
      fontWeight: '800',
      textAlign: 'center',
    },
    createPill: {
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.colors.primary,
      backgroundColor: palette.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createPillText: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 13,
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
    submitPill: {
      minHeight: 42,
      borderRadius: palette.radius.md,
      borderWidth: 1,
      borderColor: palette.colors.primary,
      backgroundColor: palette.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitPillText: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 15,
    },
    sectionTitle: {
      color: palette.colors.text,
      fontWeight: '800',
      fontSize: 16,
      marginBottom: 8,
    },
    sharedList: {
      gap: 8,
    },
    sharedRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.colors.border,
      backgroundColor: palette.colors.bgElevated,
    },
    sharedRowTextWrap: {
      flex: 1,
      gap: 2,
      paddingRight: 6,
    },
    sharedRowTitle: {
      color: palette.colors.text,
      fontWeight: '700',
      fontSize: 14,
    },
    sharedRowMeta: {
      color: palette.colors.muted,
      fontSize: 12,
      fontWeight: '600',
    },
    sharedAttachButton: {
      minHeight: 30,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.colors.primary,
      backgroundColor: palette.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sharedAttachButtonText: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 12,
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
    empty: {
      color: palette.colors.muted,
      paddingVertical: 8,
    },
  });
}
