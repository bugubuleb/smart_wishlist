import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  DeviceEventEmitter,
} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import Button from '../components/Button';
import Input from '../components/Input';
import Screen from '../components/Screen';
import SectionCard from '../components/SectionCard';
import {getToken} from '../storage';
import {
  getWishlist,
  createItem,
  contributeToItem,
  reserveItem,
  unreserveItem,
  setItemResponsible,
  unsetItemResponsible,
  removeItem,
  setItemPriority,
  autofillByUrl,
} from '../api';
import {connectWishlistSocket} from '../realtime';
import {getLanguage, t} from '../i18n';
import {useAppTheme} from '../theme';

export default function WishlistScreen({route, navigation}) {
  const {slug} = route.params;
  const [wishlist, setWishlist] = useState(null);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [url, setUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const autofill = true;
  const [isAutofillLoading, setIsAutofillLoading] = useState(false);
  const [contributions, setContributions] = useState({});
  const [lang, setLang] = useState('ru');
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const {palette} = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  useEffect(() => {
    getLanguage().then(setLang);
  }, []);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      return;
    }
    const data = await getWishlist(slug, token);
    setWishlist(data);
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('currencyChanged', load);
    return () => sub.remove();
  }, [load]);

  useEffect(() => {
    const socket = connectWishlistSocket(slug, () => {
      load();
    });
    return () => socket.close();
  }, [slug, load]);

  useEffect(() => {
    if (!autofill || !url) {
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setIsAutofillLoading(true);
      try {
        const targetCurrency = wishlist?.currency || 'RUB';
        const data = await autofillByUrl(url, targetCurrency);
        if (!active || !data) {
          return;
        }
        if (data.title) {
          setTitle(data.title);
        }
        if (data.price != null) {
          setPrice(String(data.price));
        }
        if (data.image) {
          setImageUrl(data.image);
        }
      } finally {
        if (active) {
          setIsAutofillLoading(false);
        }
      }
    }, 600);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [url, autofill, wishlist?.currency]);

  async function handleAddItem() {
    const token = await getToken();
    if (!token || !title.trim()) {
      return;
    }
    await createItem(
      slug,
      {
        title: title.trim(),
        targetPrice: Number(price) || 0,
        productUrl: url.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        priority: 'medium',
      },
      token,
    );
    setTitle('');
    setPrice('');
    setUrl('');
    setImageUrl('');
    setShowAddItemForm(false);
    await load();
  }

  async function handleContribute(itemId) {
    const token = await getToken();
    const amount = Number(contributions[itemId] || 0);
    if (!token || !amount) {
      return;
    }
    await contributeToItem(itemId, amount, token);
    setContributions(prev => ({...prev, [itemId]: ''}));
    await load();
  }

  async function handleReserve(itemId, reserved) {
    const token = await getToken();
    if (!token) {
      return;
    }
    if (reserved) {
      await unreserveItem(itemId, token);
    } else {
      await reserveItem(itemId, token);
    }
    await load();
  }

  async function handleResponsible(itemId, responsible) {
    const token = await getToken();
    if (!token) {
      return;
    }
    if (responsible) {
      await unsetItemResponsible(itemId, token);
    } else {
      await setItemResponsible(itemId, token);
    }
    await load();
  }

  async function handlePriority(itemId, priority) {
    const token = await getToken();
    if (!token) {
      return;
    }
    await setItemPriority(itemId, priority, token);
    await load();
  }

  async function handleRemove(itemId) {
    const token = await getToken();
    if (!token) {
      return;
    }
    await removeItem(itemId, t(lang, 'remove'), token);
    await load();
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path
              d="M14.5 5.5L8.5 12L14.5 18.5"
              stroke={palette.colors.text}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Pressable>
        <Text style={styles.title}>{wishlist?.title || 'Wishlist'}</Text>

        {wishlist?.can_edit ? (
          !showAddItemForm ? (
            <Button
              title={t(lang, 'openAddItem')}
              onPress={() => setShowAddItemForm(true)}
            />
          ) : (
            <SectionCard title={t(lang, 'addItem')}>
              <Input
                label={t(lang, 'productUrl')}
                value={url}
                onChangeText={setUrl}
                placeholder="https://"
              />
              <Input
                label={t(lang, 'title')}
                value={title}
                onChangeText={setTitle}
                placeholder={t(lang, 'title')}
              />
              <Input
                label={t(lang, 'imageUrl')}
                value={imageUrl}
                onChangeText={setImageUrl}
                placeholder="https://"
              />
              <Input
                label={t(lang, 'price')}
                value={price}
                onChangeText={setPrice}
                placeholder="0"
                keyboardType="numeric"
              />
              {autofill ? (
                <Text style={styles.muted}>
                  {isAutofillLoading
                    ? t(lang, 'autofillRunning')
                    : t(lang, 'autofill')}
                </Text>
              ) : null}
              <View style={styles.row}>
                <Button
                  title={t(lang, 'back')}
                  onPress={() => setShowAddItemForm(false)}
                  variant="secondary"
                />
                <Button title="Save" onPress={handleAddItem} />
              </View>
            </SectionCard>
          )
        ) : null}

        <FlatList
          data={wishlist?.items || []}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => (
            <View
              style={[
                styles.item,
                item.is_fully_funded ? styles.itemFunded : null,
              ]}>
              {item.image_url ? (
                <Image source={{uri: item.image_url}} style={styles.image} />
              ) : null}
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemMeta}>
                {t(lang, 'price')}:{' '}
                {Math.ceil(
                  Number(item.display_target_price ?? item.target_price ?? 0),
                )}{' '}
                {item.display_currency ||
                  wishlist?.currency ||
                  item.currency ||
                  'RUB'}
              </Text>
              {item.is_responsible_me ? (
                <Text style={styles.responsibleText}>
                  {t(lang, 'youAreResponsible')}
                </Text>
              ) : null}
              <Text style={styles.itemMeta}>
                {t(lang, 'contribution')}:{' '}
                {Math.ceil(
                  Number(item.display_collected ?? item.collected ?? 0),
                )}{' '}
                {item.display_currency ||
                  wishlist?.currency ||
                  item.currency ||
                  'RUB'}
              </Text>
              {!item.is_fully_funded && wishlist?.can_contribute !== false ? (
                <>
                  <Input
                    label={t(lang, 'contribution')}
                    value={String(contributions[item.id] || '')}
                    onChangeText={value =>
                      setContributions(prev => ({...prev, [item.id]: value}))
                    }
                    placeholder="0"
                    keyboardType="numeric"
                  />
                  <View style={styles.row}>
                    <Button
                      title={t(lang, 'contribute')}
                      onPress={() => handleContribute(item.id)}
                    />
                    <Button
                      title={
                        item.is_reserved_me
                          ? t(lang, 'unreserve')
                          : t(lang, 'reserve')
                      }
                      onPress={() =>
                        handleReserve(item.id, Boolean(item.is_reserved_me))
                      }
                      variant="secondary"
                    />
                  </View>
                </>
              ) : null}
              {wishlist?.can_contribute !== false ? (
                <>
                  <View style={styles.row}>
                    <Button
                      title={
                        item.is_responsible_me
                          ? t(lang, 'removeResponsibility')
                          : t(lang, 'beResponsible')
                      }
                      onPress={() =>
                        handleResponsible(
                          item.id,
                          Boolean(item.is_responsible_me),
                        )
                      }
                      variant="secondary"
                    />
                    {wishlist?.can_edit ? (
                      <Button
                        title={t(lang, 'remove')}
                        onPress={() => handleRemove(item.id)}
                        variant="secondary"
                      />
                    ) : null}
                  </View>
                  {wishlist?.can_edit ? (
                    <View style={styles.row}>
                      <Button
                        title="Low"
                        onPress={() => handlePriority(item.id, 'low')}
                        variant="secondary"
                      />
                      <Button
                        title="Medium"
                        onPress={() => handlePriority(item.id, 'medium')}
                        variant="secondary"
                      />
                      <Button
                        title="High"
                        onPress={() => handlePriority(item.id, 'high')}
                        variant="secondary"
                      />
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No items yet.</Text>}
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
    backButton: {
      width: 42,
      height: 42,
      alignSelf: 'flex-start',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 21,
      borderWidth: 1,
      borderColor: palette.colors.border,
      backgroundColor: palette.colors.bgElevated,
    },
    title: {
      color: palette.colors.text,
      fontSize: 28,
      fontWeight: '800',
    },
    item: {
      padding: 14,
      borderRadius: palette.radius.lg,
      backgroundColor: palette.colors.bgElevated,
      borderWidth: 1,
      borderColor: palette.colors.border,
      gap: 8,
    },
    itemFunded: {
      backgroundColor: palette.colors.successCard,
    },
    itemTitle: {
      color: palette.colors.text,
      fontWeight: '700',
      fontSize: 16,
    },
    itemMeta: {
      color: palette.colors.muted,
    },
    responsibleText: {
      color: palette.colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    row: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    image: {
      width: '100%',
      height: 160,
      borderRadius: 10,
      backgroundColor: palette.colors.card,
    },
    empty: {
      color: palette.colors.muted,
      marginTop: 12,
    },
    muted: {
      color: palette.colors.muted,
    },
    list: {
      gap: 10,
      paddingBottom: 8,
    },
  });
}
