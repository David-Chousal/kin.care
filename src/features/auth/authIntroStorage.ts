import AsyncStorage from '@react-native-async-storage/async-storage';

export const WELCOME_INTRO_SEEN_KEY = 'kin_welcome_intro_seen';

export async function setWelcomeIntroSeen(): Promise<void> {
  await AsyncStorage.setItem(WELCOME_INTRO_SEEN_KEY, '1');
}
