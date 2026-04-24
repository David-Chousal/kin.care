import { useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { showActionSheet } from '../../lib/actionSheet';
import { SkeletonList } from '../../components/SkeletonCard';
import { useCalendarEvents, useDeleteCalendarEvent } from './hooks/useCalendarEvents';
import { AddEventSheet } from './AddEventSheet';
import type { CalendarEvent } from '../../types';
import { useTheme, type Theme } from '../../theme';
import { Icon } from '../../components/Icon';
import { Collapsible, DisclosureChevron } from '../../components/Collapsible';
import { syncCalendarEventReminders } from '../../lib/calendarEventReminders';
import { useNotificationPrefs } from '../../store/notifications';
import type { MainStackParamList } from '../../navigation/types';
import { NativeHeaderTextButton } from '../../navigation/NativeHeaderTextButton';
import { EmptyState } from '../../components/EmptyState';
import { UndoSnackbar } from '../../components/UndoSnackbar';
import { useUndoDelete } from '../../hooks/useUndoDelete';
import { errorMessageFromUnknown } from '../../lib/errorMessage';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { useFormatLocaleTag } from '../../i18n/useFormatLocaleTag';

function formatTime(iso: string, locale: string) {
  const d = new Date(iso);
  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
  return d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

function EventCard({ event, onMenu }: { event: CalendarEvent; onMenu: () => void }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const formatLocale = useFormatLocaleTag();
  const time = formatTime(event.starts_at, formatLocale);
  const d = new Date(event.starts_at);
  return (
    <View style={styles.card}>
      <View style={styles.dateBlock}>
        <Text style={styles.dateMonth}>
          {d.toLocaleDateString(formatLocale, { month: 'short' }).toUpperCase()}
        </Text>
        <Text style={styles.dateDay}>{d.getDate()}</Text>
        {time ? <Text style={styles.dateTime}>{time}</Text> : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{event.title}</Text>
        {event.location ? (
          <View style={styles.cardMetaRow}>
            <Icon name="location" size={13} color={t.textSecondary} />
            <Text style={styles.cardMeta}>{event.location}</Text>
          </View>
        ) : null}
        {event.description ? (
          <Text style={styles.cardNotes} numberOfLines={2}>{event.description}</Text>
        ) : null}
      </View>
      <TouchableOpacity onPress={onMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.menuBtn}>
        <Text style={styles.menuDots}>···</Text>
      </TouchableOpacity>
    </View>
  );
}

export function CalendarScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const { t: tx } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, 'Calendar'>>();
  const { data: events, isLoading, isFetching, refetch } = useCalendarEvents();
  const deleteEvent = useDeleteCalendarEvent();
  const undoDelete = useUndoDelete();
  const notifPrefs = useNotificationPrefs();
  const [showAdd, setShowAdd] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
  const [pastExpanded, setPastExpanded] = useState(false);

  const openAdd = useCallback(() => {
    setEditingEvent(undefined);
    setShowAdd(true);
  }, []);

  useEffect(() => {
    const params = route.params;
    if (!params?.openAdd) return;
    setEditingEvent(undefined);
    setShowAdd(true);
  }, [route.params?.openAdd]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <NativeHeaderTextButton label={tx('common.add')} onPress={openAdd} />,
    });
  }, [navigation, openAdd, tx]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = (events ?? []).filter((e) => new Date(e.starts_at) >= today);
  const past = (events ?? []).filter((e) => new Date(e.starts_at) < today);

  useEffect(() => {
    if (!events || events.length === 0) return;
    const controller = new AbortController();
    void syncCalendarEventReminders(events, controller.signal).catch((err) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      throw err;
    });
    return () => controller.abort();
  }, [events, notifPrefs.masterEnabled, notifPrefs.eventReminders]);

  const listData = [
    ...(upcoming.length > 0 ? [{ type: 'header' as const, label: tx('calendar.sections.upcoming') }] : []),
    ...upcoming.map((e) => ({ type: 'event' as const, event: e })),
    ...(past.length > 0 ? [{ type: 'past_section' as const, count: past.length }] : []),
  ];
  const calendarListEmpty = listData.length === 0;

  const deleteWithUndo = useCallback(
    (event: CalendarEvent) => {
      const title = event.title?.trim() || tx('common.event');
      undoDelete.scheduleDelete(tx('common.removed', { item: title }), () =>
        deleteEvent.mutate(event.id, {
          onError: (err) => {
            Alert.alert(tx('calendar.errors.deleteFailedTitle'), errorMessageFromUnknown(err));
          },
        }),
      );
    },
    [deleteEvent, undoDelete, tx],
  );

  const showMenu = useCallback((event: CalendarEvent) => {
    showActionSheet(
      {
        options: [tx('common.cancel'), tx('common.edit'), tx('common.delete')],
        destructiveButtonIndex: 2,
        cancelButtonIndex: 0,
      },
      (i) => {
        if (i === 1) {
          setEditingEvent(event);
          setShowAdd(true);
        }
        if (i === 2) deleteWithUndo(event);
      },
    );
  }, [deleteWithUndo, tx]);

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={{ flex: 1, paddingTop: 12 }}>
          <SkeletonList count={4} lines={2} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={listData}
          keyExtractor={(item, i) =>
            item.type === 'event'
              ? item.event!.id
              : item.type === 'past_section'
                ? 'past-section'
                : `header-${i}`}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.list, { paddingTop: 12 }, calendarListEmpty && { flexGrow: 1 }]}
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
            ListEmptyComponent={
              <EmptyState
                icon="calendar"
                title={tx('calendar.empty.title')}
                message={tx('calendar.empty.message')}
                actionLabel={tx('calendar.empty.action')}
                onAction={openAdd}
              />
            }
            renderItem={({ item }) => {
              if (item.type === 'header') return <Text style={styles.sectionLabel}>{item.label}</Text>;
              if (item.type === 'past_section') {
                return (
                  <View style={{ marginTop: 8, marginBottom: 4 }}>
                    <TouchableOpacity
                      style={styles.pastToggle}
                      onPress={() => setPastExpanded((v) => !v)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: pastExpanded }}
                      accessibilityLabel={tx('calendar.a11y.pastEventsLabel', { count: item.count })}
                    >
                      <Text style={styles.pastToggleLabel}>
                        {tx('calendar.sections.pastEventsWithCount', { count: item.count })}
                      </Text>
                      <DisclosureChevron expanded={pastExpanded} color={t.textSecondary} size={18} />
                    </TouchableOpacity>
                    <Collapsible expanded={pastExpanded}>
                      <View style={{ marginTop: 10 }}>
                        {past.map((e) => (
                          <View key={e.id} style={{ marginBottom: 10 }}>
                            <SwipeToDelete
                              onDelete={() => deleteWithUndo(e)}
                              accessibilityLabel={e.title?.trim() || tx('calendar.a11y.eventFallback')}
                            >
                              <EventCard event={e} onMenu={() => showMenu(e)} />
                            </SwipeToDelete>
                          </View>
                        ))}
                      </View>
                    </Collapsible>
                  </View>
                );
              }
              const ev = item.event!;
              return (
                <View style={{ marginBottom: 10 }}>
                  <SwipeToDelete
                    onDelete={() => deleteWithUndo(ev)}
                    accessibilityLabel={ev.title?.trim() || tx('calendar.a11y.eventFallback')}
                  >
                    <EventCard event={ev} onMenu={() => showMenu(ev)} />
                  </SwipeToDelete>
                </View>
              );
            }}
        />
      )}

      <AddEventSheet
        visible={showAdd}
        editing={editingEvent}
        draft={route.params?.draft}
        onClose={() => { setShowAdd(false); setEditingEvent(undefined); }}
      />

      <UndoSnackbar
        message={undoDelete.message}
        visible={undoDelete.visible}
        onUndo={undoDelete.undo}
        onSwipeDismiss={undoDelete.dismissAndCommit}
      />
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    list: { padding: 16, paddingBottom: 40 },
    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: t.textTertiary,
      textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8, marginBottom: 8,
    },
    pastToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: t.surface,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderLight,
    },
    pastToggleLabel: { fontSize: 15, fontWeight: '600', color: t.textSecondary },
    card: {
      flexDirection: 'row', backgroundColor: t.surface, borderRadius: 14,
      overflow: 'hidden',
      shadowColor: t.shadow, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    },
    dateBlock: {
      width: 64, backgroundColor: t.accentLight,
      alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 2,
    },
    dateMonth: { fontSize: 10, fontWeight: '700', color: t.accent, letterSpacing: 0.5 },
    dateDay: { fontSize: 24, fontWeight: '700', color: t.text, lineHeight: 28 },
    dateTime: { fontSize: 10, color: t.textSecondary },
    cardBody: { flex: 1, padding: 14, gap: 3 },
    cardTitle: { fontSize: 15, fontWeight: '600', color: t.text },
    cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    cardMeta: { fontSize: 13, color: t.textSecondary },
    cardNotes: { fontSize: 13, color: t.textTertiary },
    menuBtn: { justifyContent: 'center', paddingHorizontal: 14 },
    menuDots: { fontSize: 18, color: t.textTertiary },
  });
}
