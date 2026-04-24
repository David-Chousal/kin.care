import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  ensureAndroidNotificationChannels,
  ANDROID_REMINDERS_CHANNEL_ID,
} from '../features/notifications/ensureAndroidNotificationChannels';

export type RefillLevelSnapshot = {
  quantity_remaining: number | null;
  refill_threshold: number | null;
};

/** True when the medication is low after the change but was not low before (or there is no prior row). */
export function shouldFireRefillBecameLow(
  prev: RefillLevelSnapshot | null,
  next: RefillLevelSnapshot,
): boolean {
  const t = next.refill_threshold;
  const q = next.quantity_remaining;
  if (t == null || q == null || q > t) return false;
  if (!prev) return true;
  const prevQ = prev.quantity_remaining;
  const prevT = prev.refill_threshold;
  const wasLow = prevT != null && prevQ != null && prevQ <= prevT;
  return !wasLow;
}

export async function scheduleMedicationRefillNotification(
  medicationName: string,
  quantityRemaining: number,
  medicationId?: string,
): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && (status as string) !== 'provisional') return;
  await ensureAndroidNotificationChannels();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Refill reminder',
      body: `${medicationName} is running low — only ${quantityRemaining} left.`,
      sound: 'default',
      data: {
        type: 'medication_refill',
        ...(medicationId ? { medicationId } : {}),
      },
      ...(Platform.OS === 'android'
        ? { android: { channelId: ANDROID_REMINDERS_CHANNEL_ID } }
        : {}),
    },
    trigger: null,
  });
}
