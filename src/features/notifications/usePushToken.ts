import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { useNotificationPrefs } from '../../store/notifications';
import { ensureAndroidNotificationChannels } from './ensureAndroidNotificationChannels';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushToken() {
  const { user } = useAuthStore();
  const lastRegisteredUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    maybeRegisterToken(user.id, lastRegisteredUserIdRef);
  }, [user]);

  // Re-sync permission status and token when the app comes back to the foreground.
  // This handles the case where the user granted or revoked permission from OS Settings.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      const currentUserId = useAuthStore.getState().user?.id;
      if (!currentUserId) return;
      maybeRegisterToken(currentUserId, lastRegisteredUserIdRef);
    });
    return () => sub.remove();
  }, []);
}

/**
 * Checks the current OS permission status and, if already granted, upserts
 * the Expo push token for this user. Never requests permission — that must
 * be triggered by an explicit user action through requestNotificationPermission().
 */
async function maybeRegisterToken(
  userId: string,
  lastRegisteredUserIdRef: React.MutableRefObject<string | null>
) {
  if (Platform.OS === 'web') return;

  const { status } = await Notifications.getPermissionsAsync();

  // Keep the cached status in the store up to date without marking asked-once.
  useNotificationPrefs.getState().syncPermissionStatus(status);

  if (status !== 'granted' && status !== 'provisional') return;
  if (lastRegisteredUserIdRef.current === userId) return;

  await ensureAndroidNotificationChannels();

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token }, { onConflict: 'user_id,token' });

  lastRegisteredUserIdRef.current = userId;
}
