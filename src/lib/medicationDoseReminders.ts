import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import type { Medication } from '../types';
import { useNotificationPrefs } from '../store/notifications';
import {
  ensureAndroidNotificationChannels,
  ANDROID_REMINDERS_CHANNEL_ID,
} from '../features/notifications/ensureAndroidNotificationChannels';
import {
  appWeekdayToExpoWeekday,
  inferFrequencyTypeFromLegacyFrequency,
  parseHHMMToMinutes,
} from '../features/medications/scheduleUtils';
import { scheduleMedicationRefillNotification } from './medicationRefillNotifications';

const DOSE_MAP_KEY = 'kin:medication_dose_notifications:v1';
const REFILL_DAY_MAP_KEY = 'kin:refill_notified:v1';

type IdMap = Record<string, string>;

export type SyncMedicationNotificationsOptions = {
  signal?: AbortSignal;
};

function isAborted(signal?: AbortSignal): boolean {
  return signal?.aborted ?? false;
}

function mapPrefix() {
  return 'medication_dose:';
}

async function readDoseMap(): Promise<IdMap> {
  const raw = await AsyncStorage.getItem(DOSE_MAP_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as IdMap;
  } catch {
    return {};
  }
}

async function writeDoseMap(next: IdMap) {
  await AsyncStorage.setItem(DOSE_MAP_KEY, JSON.stringify(next));
}

async function upsertDoseMapping(key: string, notificationId: string) {
  const map = await readDoseMap();
  map[key] = notificationId;
  await writeDoseMap(map);
}

async function deleteDoseMapping(key: string) {
  const map = await readDoseMap();
  if (!map[key]) return;
  delete map[key];
  await writeDoseMap(map);
}

async function canScheduleNow() {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' || (status as string) === 'provisional';
}

function frequencyTypeOf(med: Medication): 'daily' | 'weekly' | 'as_needed' {
  return med.frequency_type ?? inferFrequencyTypeFromLegacyFrequency(med.frequency);
}

function parseTimeParts(hhmm: string): { hour: number; minute: number } | null {
  const mins = parseHHMMToMinutes(hhmm);
  if (mins == null) return null;
  return { hour: Math.floor(mins / 60), minute: mins % 60 };
}

export async function cancelMedicationDoseReminderByKey(key: string) {
  const map = await readDoseMap();
  const existing = map[key];
  if (!existing) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(existing);
  } finally {
    await deleteDoseMapping(key);
  }
}

/** Cancel every scheduled dose reminder (prefs off, sign-out, etc.). */
export async function cancelAllMedicationDoseReminders() {
  const map = await readDoseMap();
  for (const k of Object.keys(map)) {
    const id = map[k];
    if (!id) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      await Notifications.cancelScheduledNotificationAsync(id);
    } finally {
      delete map[k];
    }
  }
  await writeDoseMap(map);
}

async function scheduleOneDose(
  key: string,
  title: string,
  body: string,
  trigger: Notifications.NotificationTriggerInput,
  medicationId: string,
  signal?: AbortSignal,
) {
  if (isAborted(signal)) return;
  await cancelMedicationDoseReminderByKey(key);
  if (isAborted(signal)) return;
  await ensureAndroidNotificationChannels();
  if (isAborted(signal)) return;
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: { type: 'medication_dose', medicationId },
      ...(Platform.OS === 'android'
        ? { android: { channelId: ANDROID_REMINDERS_CHANNEL_ID } }
        : {}),
    },
    trigger,
  });
  if (isAborted(signal)) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
      /* ignore */
    }
    return;
  }
  await upsertDoseMapping(key, notificationId);
}

/**
 * Sync repeating local notifications for medication dose times.
 * Respects `masterEnabled` and `medicationAlerts` (same idea as calendar event reminders).
 */
export async function syncMedicationDoseReminders(
  medications: Medication[],
  options?: SyncMedicationNotificationsOptions,
) {
  const signal = options?.signal;
  const prefs = useNotificationPrefs.getState();
  if (!(await canScheduleNow())) {
    if (isAborted(signal)) return;
    await cancelAllMedicationDoseReminders();
    return;
  }

  if (!prefs.masterEnabled || !prefs.medicationAlerts) {
    if (isAborted(signal)) return;
    await cancelAllMedicationDoseReminders();
    return;
  }

  const prefix = mapPrefix();
  const desiredKeys = new Set<string>();

  for (const med of medications) {
    if (isAborted(signal)) return;
    const ft = frequencyTypeOf(med);
    if (ft === 'as_needed') continue;
    const times = med.times?.filter(Boolean) ?? [];
    if (times.length === 0) continue;

    if (ft === 'daily') {
      for (const hhmm of times) {
        if (isAborted(signal)) return;
        const parts = parseTimeParts(hhmm);
        if (!parts) continue;
        const slotKey = `daily:${hhmm}`;
        const mapKey = `${prefix}${med.id}:${slotKey}`;
        desiredKeys.add(mapKey);
        const trigger: Notifications.DailyTriggerInput = {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: parts.hour,
          minute: parts.minute,
          ...(Platform.OS === 'android' ? { channelId: ANDROID_REMINDERS_CHANNEL_ID } : {}),
        };
        await scheduleOneDose(
          mapKey,
          `Dose: ${med.name}`,
          `${med.dosage} · ${hhmm}`,
          trigger,
          med.id,
          signal,
        );
      }
      continue;
    }

    const days = (med.days_of_week ?? []).filter((d) => d >= 0 && d <= 6);
    if (!days.length) continue;

    for (const appDay of days) {
      if (isAborted(signal)) return;
      if (appDay < 0 || appDay > 6) continue;
      const expoWeekday = appWeekdayToExpoWeekday(appDay);
      for (const hhmm of times) {
        if (isAborted(signal)) return;
        const parts = parseTimeParts(hhmm);
        if (!parts) continue;
        const slotKey = `weekly:${expoWeekday}:${hhmm}`;
        const mapKey = `${prefix}${med.id}:${slotKey}`;
        desiredKeys.add(mapKey);
        const trigger: Notifications.WeeklyTriggerInput = {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: expoWeekday,
          hour: parts.hour,
          minute: parts.minute,
          ...(Platform.OS === 'android' ? { channelId: ANDROID_REMINDERS_CHANNEL_ID } : {}),
        };
        await scheduleOneDose(
          mapKey,
          `Dose: ${med.name}`,
          `${med.dosage} · ${hhmm}`,
          trigger,
          med.id,
          signal,
        );
      }
    }
  }

  if (isAborted(signal)) return;

  const finalMap = await readDoseMap();
  if (isAborted(signal)) return;

  const orphanKeys = Object.keys(finalMap).filter((k) => k.startsWith(prefix) && !desiredKeys.has(k));
  for (const k of orphanKeys) {
    if (isAborted(signal)) return;
    // eslint-disable-next-line no-await-in-loop
    await cancelMedicationDoseReminderByKey(k);
  }
}

async function readRefillDayMap(): Promise<IdMap> {
  const raw = await AsyncStorage.getItem(REFILL_DAY_MAP_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as IdMap;
  } catch {
    return {};
  }
}

async function writeRefillDayMap(next: IdMap) {
  await AsyncStorage.setItem(REFILL_DAY_MAP_KEY, JSON.stringify(next));
}

function localDateKey(d: Date) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${m < 10 ? `0${m}` : m}-${day < 10 ? `0${day}` : day}`;
}

function isRefillLow(med: Medication) {
  return (
    med.refill_threshold != null &&
    med.quantity_remaining != null &&
    med.quantity_remaining <= med.refill_threshold
  );
}

/**
 * If stock is already low when the user opens the app, nudge at most once per local calendar day per medication.
 */
export async function syncLowStockRefillNudge(
  medications: Medication[],
  options?: SyncMedicationNotificationsOptions,
) {
  const signal = options?.signal;
  const prefs = useNotificationPrefs.getState();
  if (!(await canScheduleNow())) return;
  if (!prefs.masterEnabled || !prefs.medicationAlerts) return;

  const today = localDateKey(new Date());
  const map = await readRefillDayMap();

  for (const med of medications) {
    if (isAborted(signal)) return;
    if (!isRefillLow(med)) continue;
    const dedupeKey = `${med.id}:${today}`;
    if (map[dedupeKey]) continue;
    await scheduleMedicationRefillNotification(
      med.name,
      med.quantity_remaining!,
      med.id,
    );
    map[dedupeKey] = '1';
    await writeRefillDayMap(map);
  }
}
