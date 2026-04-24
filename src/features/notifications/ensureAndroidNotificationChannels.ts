import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/** Matches `defaultChannel` in app.json expo-notifications plugin (FC / default tray behavior). */
export const ANDROID_DEFAULT_CHANNEL_ID = 'default';

/** Local calendar reminders channel (see calendarEventReminders). */
export const ANDROID_REMINDERS_CHANNEL_ID = 'reminders';

/**
 * Android 13+: Expo recommends creating a notification channel before
 * `getExpoPushTokenAsync` / `requestPermissionsAsync` so the OS permission
 * prompt can appear. Safe to call repeatedly (idempotent).
 */
export async function ensureAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_DEFAULT_CHANNEL_ID, {
    name: 'General',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  await Notifications.setNotificationChannelAsync(ANDROID_REMINDERS_CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}
