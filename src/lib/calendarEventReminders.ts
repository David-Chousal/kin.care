import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import type { CalendarEvent } from '../types';
import { useNotificationPrefs } from '../store/notifications';
import {
  ensureAndroidNotificationChannels,
  ANDROID_REMINDERS_CHANNEL_ID,
} from '../features/notifications/ensureAndroidNotificationChannels';

const STORAGE_KEY = 'kin:scheduled_notifications:v1';

type ScheduledMap = Record<string, string>;

function mapKeyForEvent(eventId: string) {
  return `calendar_event:${eventId}`;
}

async function ensureAndroidChannel() {
  await ensureAndroidNotificationChannels();
}

async function canScheduleNow() {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' || (status as string) === 'provisional';
}

function hasExplicitTime(startsAtIso: string) {
  const d = new Date(startsAtIso);
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

function computeTriggerDate(event: CalendarEvent): Date | null {
  const starts = new Date(event.starts_at);
  if (Number.isNaN(starts.getTime())) return null;

  const now = new Date();
  if (starts <= now) return null;

  if (hasExplicitTime(event.starts_at)) {
    const trigger = new Date(starts.getTime() - 30 * 60 * 1000); // 30 minutes before
    return trigger > now ? trigger : null;
  }

  // All-day (stored at midnight): remind at 9am local time.
  const trigger = new Date(starts);
  trigger.setHours(9, 0, 0, 0);
  return trigger > now ? trigger : null;
}

async function readMap(): Promise<ScheduledMap> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ScheduledMap;
  } catch {
    return {};
  }
}

async function writeMap(next: ScheduledMap) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

async function upsertMapping(key: string, notificationId: string) {
  const map = await readMap();
  map[key] = notificationId;
  await writeMap(map);
}

async function deleteMapping(key: string) {
  const map = await readMap();
  if (!map[key]) return;
  delete map[key];
  await writeMap(map);
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
}

export async function cancelCalendarEventReminder(eventId: string) {
  const key = mapKeyForEvent(eventId);
  const map = await readMap();
  const existing = map[key];
  if (!existing) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(existing);
  } finally {
    await deleteMapping(key);
  }
}

export async function scheduleCalendarEventReminder(event: CalendarEvent) {
  const prefs = useNotificationPrefs.getState();
  if (!prefs.masterEnabled || !prefs.eventReminders) return;

  const triggerDate = computeTriggerDate(event);
  if (!triggerDate) {
    await cancelCalendarEventReminder(event.id);
    return;
  }

  if (!(await canScheduleNow())) return;
  await ensureAndroidChannel();

  // Replace any existing scheduled reminder for this event.
  await cancelCalendarEventReminder(event.id);

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: event.title,
      body: event.location ? `Today • ${event.location}` : 'Today',
      sound: 'default',
      data: { type: 'calendar_event', eventId: event.id },
      ...(Platform.OS === 'android'
        ? { android: { channelId: ANDROID_REMINDERS_CHANNEL_ID } }
        : {}),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
  });

  await upsertMapping(mapKeyForEvent(event.id), notificationId);
}

export async function syncCalendarEventReminders(events: CalendarEvent[], signal?: AbortSignal) {
  const prefs = useNotificationPrefs.getState();

  throwIfAborted(signal);
  if (!(await canScheduleNow())) return;

  throwIfAborted(signal);
  const map = await readMap();
  throwIfAborted(signal);
  const desiredKeys = new Set(events.map((e) => mapKeyForEvent(e.id)));

  // If disabled, cancel everything calendar-related and return.
  if (!prefs.masterEnabled || !prefs.eventReminders) {
    const keys = Object.keys(map).filter((k) => k.startsWith('calendar_event:'));
    throwIfAborted(signal);
    await Promise.all(keys.map(async (k) => {
      const id = map[k];
      if (!id) return;
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } finally {
        delete map[k];
      }
    }));
    throwIfAborted(signal);
    await writeMap(map);
    return;
  }

  // Cancel reminders that no longer correspond to an event.
  const orphanKeys = Object.keys(map).filter((k) => k.startsWith('calendar_event:') && !desiredKeys.has(k));
  throwIfAborted(signal);
  await Promise.all(orphanKeys.map(async (k) => {
    const id = map[k];
    if (!id) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } finally {
      delete map[k];
    }
  }));
  if (orphanKeys.length > 0) {
    throwIfAborted(signal);
    await writeMap(map);
  }

  // Ensure all upcoming events have a correct reminder.
  for (const e of events) {
    throwIfAborted(signal);
    // eslint-disable-next-line no-await-in-loop
    await scheduleCalendarEventReminder(e);
  }
}

