import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  DeviceEventEmitter,
} from 'react-native';
import Button from '../components/Button';
import Screen from '../components/Screen';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api';
import {getToken} from '../storage';
import {getLanguage, t} from '../i18n';
import {useAppTheme} from '../theme';
import {connectNotificationsSocket} from '../realtime';

export default function NotificationsScreen({navigation}) {
  const [notifications, setNotifications] = useState([]);
  const [lang, setLang] = useState('ru');
  const {palette} = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  useEffect(() => {
    getLanguage().then(setLang);
  }, []);

  async function loadNotifications() {
    const token = await getToken();
    if (!token) {
      return;
    }
    const data = await getNotifications(token);
    const next = data.notifications || [];
    setNotifications(next);
    DeviceEventEmitter.emit(
      'notificationsChanged',
      next.filter(item => !item.is_read).length,
    );
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    const timer = setInterval(loadNotifications, 15000);
    let socket = null;

    async function setupRealtime() {
      const token = await getToken();
      if (!token) {
        return;
      }
      socket = connectNotificationsSocket(token, () => {
        loadNotifications();
      });
      unsubscribe = navigation.addListener('focus', loadNotifications);
    }

    setupRealtime();

    return () => {
      clearInterval(timer);
      unsubscribe();
      if (socket) {
        socket.close();
      }
    };
  }, [navigation]);

  async function handleReadAll() {
    const token = await getToken();
    if (!token) {
      return;
    }
    await markAllNotificationsRead(token);
    const next = notifications.map(item => ({...item, is_read: true}));
    setNotifications(next);
    DeviceEventEmitter.emit('notificationsChanged', 0);
  }

  function resolveWishlistSlug(item) {
    const link = item?.link_url || item?.link || '';
    if (typeof link === 'string' && link.includes('/wishlist/')) {
      const parts = link.split('/wishlist/');
      return parts[1]?.split(/[?#]/)[0];
    }
    const data = item?.data_json || item?.data || {};
    if (data?.slug) {
      return data.slug;
    }
    return null;
  }

  async function handleOpen(item) {
    const token = await getToken();
    if (!token) {
      return;
    }
    const slug = resolveWishlistSlug(item);
    await markNotificationRead(item.id, token);
    const next = notifications.filter(row => row.id !== item.id);
    setNotifications(next);
    DeviceEventEmitter.emit(
      'notificationsChanged',
      next.filter(row => !row.is_read).length,
    );
    if (slug) {
      navigation.navigate('Wishlist', {slug});
    }
  }

  const unread = notifications.filter(item => !item.is_read);

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>{t(lang, 'notifications')}</Text>
        {unread.length > 0 ? (
          <Button title={t(lang, 'markAllRead')} onPress={handleReadAll} />
        ) : null}
        <FlatList
          data={unread}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => (
            <Pressable style={styles.item} onPress={() => handleOpen(item)}>
              <Text style={styles.itemText}>{item.title}</Text>
            </Pressable>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>{t(lang, 'noNotifications')}</Text>
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
    item: {
      borderRadius: palette.radius.md,
      borderWidth: 1,
      borderColor: palette.colors.border,
      backgroundColor: palette.colors.bgElevated,
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    itemText: {
      color: palette.colors.text,
      fontWeight: '600',
    },
    list: {
      gap: 8,
    },
    empty: {
      color: palette.colors.muted,
      marginTop: 12,
    },
  });
}
