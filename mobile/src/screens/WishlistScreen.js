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
import {launchImageLibrary} from 'react-native-image-picker';
import Button from '../components/Button';
import Input from '../components/Input';
import Screen from '../components/Screen';
import SectionCard from '../components/SectionCard';
import {getPreferredCurrency, getToken} from '../storage';
import {
  getWishlist,
  createItem,
  contributeToItem,
  setItemResponsible,
  unsetItemResponsible,
  removeItem,
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
  const [selectedCurrency, setSelectedCurrency] = useState('RUB');
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [isImagePicking, setIsImagePicking] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [itemActionError, setItemActionError] = useState('');
  const {palette} = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  useEffect(() => {
    getLanguage().then(setLang);
    getPreferredCurrency().then(value => {
      if (value) {
        setSelectedCurrency(String(value).toUpperCase());
      }
    });
    const sub = DeviceEventEmitter.addListener('currencyChanged', currency => {
      if (currency) {
        setSelectedCurrency(String(currency).toUpperCase());
      }
    });
    return () => sub.remove();
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
        const targetCurrency = wishlist?.currency || selectedCurrency || 'RUB';
        const data = await autofillByUrl(url, targetCurrency);
        if (!active || !data) {
          return;
        }
        if (data.title) {
          setTitle(data.title);
        }
        if (data.convertedPrice != null) {
          setPrice(String(data.convertedPrice));
        } else if (data.targetPrice != null) {
          setPrice(String(data.targetPrice));
        }
        if (data.imageUrl) {
          setImageUrl(data.imageUrl);
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
  }, [url, autofill, wishlist?.currency, selectedCurrency]);

  async function handlePickImage() {
    setIsImagePicking(true);
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: true,
        quality: 0.9,
      });
      if (result.didCancel || !result.assets?.length) {
        return;
      }
      const asset = result.assets[0];
      if (asset.base64) {
        const mime = asset.type || 'image/jpeg';
        setImageUrl(`data:${mime};base64,${asset.base64}`);
      }
    } finally {
      setIsImagePicking(false);
    }
  }

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
    setItemActionError('');
    await contributeToItem(itemId, amount, token);
    setContributions(prev => ({...prev, [itemId]: ''}));
    await load();
  }

  async function handleResponsible(itemId, responsible) {
    const token = await getToken();
    if (!token) {
      return;
    }
    setItemActionError('');
    if (responsible) {
      await unsetItemResponsible(itemId, token);
    } else {
      await setItemResponsible(itemId, token);
    }
    await load();
  }

  async function handleRemove(itemId) {
    const token = await getToken();
    if (!token) {
      return;
    }
    setItemActionError('');
    try {
      await removeItem(itemId, t(lang, 'remove'), token);
      if (Number(expandedItemId) === Number(itemId)) {
        setExpandedItemId(null);
      }
      await load();
    } catch (error) {
      if (
        String(error?.message || '')
          .toLowerCase()
          .includes('fully funded')
      ) {
        setItemActionError(t(lang, 'cannotDeleteFunded'));
      } else {
        setItemActionError(error?.message || t(lang, 'loading'));
      }
    }
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
        <Text style={styles.title}>
          {wishlist?.title || t(lang, 'appTitle')}
        </Text>
        {itemActionError ? (
          <Text style={styles.errorText}>{itemActionError}</Text>
        ) : null}

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
              <Button
                title={
                  isImagePicking ? t(lang, 'loading') : t(lang, 'uploadImage')
                }
                onPress={handlePickImage}
                variant="secondary"
                disabled={isImagePicking}
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
                <Button title={t(lang, 'save')} onPress={handleAddItem} />
              </View>
            </SectionCard>
          )
        ) : null}

        <FlatList
          data={wishlist?.items || []}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => {
            const displayCurrency =
              item.display_currency ||
              wishlist?.currency ||
              item.currency ||
              'RUB';
            const displayTarget = Number(
              item.display_target_price ?? item.target_price ?? 0,
            );
            const displayCollected = Number(
              item.display_collected ?? item.collected ?? 0,
            );
            const remaining = Math.max(
              0,
              Math.ceil(displayTarget - displayCollected),
            );
            const isExpanded = Number(expandedItemId) === Number(item.id);

            return (
              <View
                style={[
                  styles.item,
                  item.is_fully_funded ? styles.itemFunded : null,
                  isExpanded ? styles.itemExpanded : null,
                ]}>
                <Pressable
                  style={styles.itemHeader}
                  onPress={() =>
                    setExpandedItemId(prev =>
                      Number(prev) === Number(item.id) ? null : item.id,
                    )
                  }>
                  {item.image_url ? (
                    <Image
                      source={{uri: item.image_url}}
                      style={styles.image}
                    />
                  ) : null}
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemMeta}>
                    {t(lang, 'toGoal')}: {remaining} {displayCurrency}
                  </Text>
                  {item.is_responsible_me ? (
                    <Text style={styles.responsibleText}>
                      {t(lang, 'youAreResponsible')}
                    </Text>
                  ) : null}
                  {item.is_fully_funded ? (
                    <Text style={styles.fundedText}>
                      {t(lang, 'itemFullyFunded')}
                    </Text>
                  ) : null}
                </Pressable>

                {isExpanded ? (
                  <View style={styles.actionsWrap}>
                    {!item.is_fully_funded &&
                    wishlist?.can_contribute !== false ? (
                      <>
                        <Input
                          label={t(lang, 'contribution')}
                          value={String(contributions[item.id] || '')}
                          onChangeText={value =>
                            setContributions(prev => ({
                              ...prev,
                              [item.id]: value,
                            }))
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
                        </View>
                      </>
                    ) : null}
                    {wishlist?.can_edit && !item.is_fully_funded ? (
                      <Button
                        title={t(lang, 'remove')}
                        onPress={() => handleRemove(item.id)}
                        variant="secondary"
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          }}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>{t(lang, 'noItems')}</Text>
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
    itemExpanded: {
      borderColor: palette.colors.primary,
    },
    itemHeader: {
      gap: 8,
    },
    actionsWrap: {
      gap: 8,
      marginTop: 2,
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
    fundedText: {
      color: palette.colors.text,
      fontSize: 12,
      fontWeight: '700',
      opacity: 0.75,
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
    errorText: {
      color: palette.colors.danger,
      fontWeight: '600',
    },
    list: {
      gap: 10,
      paddingBottom: 8,
    },
  });
}
