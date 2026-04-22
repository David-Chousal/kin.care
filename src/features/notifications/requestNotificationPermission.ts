import { Alert, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNotificationPrefs } from '../../store/notifications';

/**
 * Context labels used to tailor the rationale message shown before the OS prompt.
 */
export type NotificationTriggerContext =
  | 'settings'
  | 'medication_alert'
  | 'calendar_reminder';

const CONTEXT_LABELS: Record<NotificationTriggerContext, string> = {
  settings: 'reminders and updates from your family care plan',
  medication_alert: 'medication reminders so you never miss a dose',
  calendar_reminder: 'event reminders before upcoming appointments',
};

/**
 * Ensures the OS notification permission is granted, following the single-global-ask policy:
 *
 * 1. If already granted → returns true immediately (no UI).
 * 2. If denied or previously asked → shows an Alert directing the user to OS Settings.
 * 3. If undetermined and never asked → shows an in-app rationale Alert, then — only if the
 *    user taps "Enable" — shows the OS permission dialog exactly once.
 *
 * Returns true when permission is granted after this call.
 *
 * @param context  Identifies the feature triggering the request; used to tailor the rationale copy.
 * @param onGranted Optional callback invoked synchronously after permission is granted.
 */
export async function requestNotificationPermission(
  context: NotificationTriggerContext,
  onGranted?: () => void,
): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status } = await Notifications.getPermissionsAsync();

  // Sync cached status without touching the asked-once flag.
  useNotificationPrefs.getState().syncPermissionStatus(status);

  if (status === 'granted' || status === 'provisional') {
    onGranted?.();
    return true;
  }

  const { permissionAskedOnce } = useNotificationPrefs.getState();

  // Already asked once (or OS is set to denied): direct user to system Settings.
  if (permissionAskedOnce || status === 'denied') {
    Alert.alert(
      'Enable notifications in Settings',
      'Notifications are currently disabled. You can enable them in your device Settings.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    );
    return false;
  }

  // First time: show in-app rationale before triggering the OS dialog.
  const label = CONTEXT_LABELS[context];
  const proceed = await new Promise<boolean>((resolve) => {
    Alert.alert(
      'Turn on notifications?',
      `Enable notifications so we can send ${label}.`,
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Enable', onPress: () => resolve(true) },
      ],
    );
  });

  if (!proceed) return false;

  const { status: next } = await Notifications.requestPermissionsAsync();
  // Record that the OS dialog was shown and the resulting status.
  useNotificationPrefs.getState().markPermissionAsked(next);

  const granted = next === 'granted' || next === 'provisional';
  if (granted) onGranted?.();
  return granted;
}
