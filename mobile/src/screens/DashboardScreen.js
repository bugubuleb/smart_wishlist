import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {View, Text, StyleSheet, FlatList, Pressable} from 'react-native';
import Input from '../components/Input';
import Screen from '../components/Screen';
import SectionCard from '../components/SectionCard';
import {createEvent, getEvents} from '../api';
import {getToken} from '../storage';
import {getLanguage, t} from '../i18n';
import {useAppTheme} from '../theme';

export default function DashboardScreen({navigation}) {
  const [events, setEvents] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [lang, setLang] = useState('ru');
  const {palette} = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const loadData = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      return;
    }
    const data = await getEvents(token);
    const list = (data.events || []).sort(
      (a, b) => Number(b.wishlists_count || 0) - Number(a.wishlists_count || 0),
    );
    setEvents(list);
  }, []);

  useEffect(() => {
    getLanguage().then(setLang);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  async function handleCreateEvent() {
    const token = await getToken();
    if (!token || !newEventTitle.trim()) {
      return;
    }
    const created = await createEvent({title: newEventTitle.trim()}, token);
    setNewEventTitle('');
    setShowCreate(false);
    await loadData();
    if (created?.id) {
      navigation.navigate('Event', {eventId: created.id});
    }
  }

  const renderEvent = ({item}) => (
    <Pressable
      style={styles.eventCard}
      onPress={() => navigation.navigate('Event', {eventId: item.id})}>
      <Text style={styles.eventTitle}>{item.title}</Text>
      <Text style={styles.eventMeta}>
        {Number(item.wishlists_count || 0)} {t(lang, 'wishlistsCount')}
      </Text>
    </Pressable>
  );

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t(lang, 'events')}</Text>
          <Pressable
            style={styles.createPill}
            onPress={() => setShowCreate(prev => !prev)}>
            <Text style={styles.createPillText}>{t(lang, 'create')}</Text>
          </Pressable>
        </View>

        {showCreate ? (
          <SectionCard>
            <Input
              label={t(lang, 'eventName')}
              value={newEventTitle}
              onChangeText={setNewEventTitle}
              placeholder={t(lang, 'eventName')}
            />
            <Pressable style={styles.submitPill} onPress={handleCreateEvent}>
              <Text style={styles.submitPillText}>{t(lang, 'new')}</Text>
            </Pressable>
          </SectionCard>
        ) : null}

        <FlatList
          data={events}
          keyExtractor={item => String(item.id)}
          renderItem={renderEvent}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>{t(lang, 'noEvents')}</Text>
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
      gap: 10,
    },
    title: {
      color: palette.colors.text,
      fontSize: 30,
      fontWeight: '800',
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
    eventCard: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: palette.radius.md,
      backgroundColor: palette.colors.bgElevated,
      borderWidth: 1,
      borderColor: palette.colors.border,
      gap: 4,
    },
    eventTitle: {
      color: palette.colors.text,
      fontWeight: '700',
      fontSize: 18,
    },
    eventMeta: {
      color: palette.colors.muted,
      fontSize: 12,
      fontWeight: '600',
    },
    list: {
      gap: 8,
      paddingBottom: 4,
    },
    empty: {
      color: palette.colors.muted,
      paddingVertical: 8,
    },
  });
}
