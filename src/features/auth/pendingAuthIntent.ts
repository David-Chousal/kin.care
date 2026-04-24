import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'kin_pending_post_auth_intent';

export type PendingPostAuthIntent = 'join_family';

export async function setPendingPostAuthIntent(intent: PendingPostAuthIntent): Promise<void> {
  await AsyncStorage.setItem(KEY, intent);
}

export async function consumePendingPostAuthIntent(): Promise<PendingPostAuthIntent | null> {
  const v = await AsyncStorage.getItem(KEY);
  await AsyncStorage.removeItem(KEY);
  if (v === 'join_family') return 'join_family';
  return null;
}
