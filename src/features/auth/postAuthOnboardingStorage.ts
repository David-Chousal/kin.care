import AsyncStorage from '@react-native-async-storage/async-storage';

export const POST_AUTH_ONBOARDING_SEEN_KEY = 'kin_post_auth_onboarding_seen';

export async function setPostAuthOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(POST_AUTH_ONBOARDING_SEEN_KEY, '1');
}

export async function getPostAuthOnboardingSeen(): Promise<boolean> {
  const v = await AsyncStorage.getItem(POST_AUTH_ONBOARDING_SEEN_KEY);
  return v === '1';
}

