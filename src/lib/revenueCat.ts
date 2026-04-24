import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Sentry } from './sentry';

let purchasesConfigured = false;

/** False in store/release: Metro inlines `NODE_ENV==='production'`; RN sets `__DEV__===false`. Missing keys alone never enable `console.warn` in prod. */
const shouldWarnRevenueCatMisconfig =
  process.env.NODE_ENV !== 'production' && (typeof __DEV__ === 'undefined' || __DEV__);

/** Serializes configure so callers (App, Subscription, sync) never race the singleton. */
let configureChain: Promise<void> = Promise.resolve();

function getPublicSdkKey(): string | undefined {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_RC_API_KEY_IOS;
  }
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID;
  }
  return undefined;
}

/** True after `Purchases.configure` succeeded (safe to call `getOfferings`, etc.). */
export function isPurchasesConfigured(): boolean {
  return purchasesConfigured;
}

/** Call once on native after you have EXPO_PUBLIC_RC_API_KEY_* set (dev / EAS build). No-op on web or missing keys. */
export async function initRevenueCatIfNeeded(): Promise<void> {
  if (Platform.OS === 'web') return;
  const apiKey = getPublicSdkKey()?.trim();
  if (!apiKey) {
    if (shouldWarnRevenueCatMisconfig) {
      console.warn(
        '[RevenueCat] Missing EXPO_PUBLIC_RC_API_KEY_IOS / EXPO_PUBLIC_RC_API_KEY_ANDROID — subscriptions disabled until set.',
      );
    }
    return;
  }
  if (purchasesConfigured) return;

  configureChain = configureChain.then(async () => {
    if (purchasesConfigured) return;
    try {
      if (__DEV__) {
        await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }
      Purchases.configure({ apiKey });
      purchasesConfigured = true;
    } catch (e) {
      Sentry.captureException(e);
    }
  });
  await configureChain;
}

/**
 * Links RevenueCat `app_user_id` to Supabase `auth.users.id` (required for `rc-webhook` → `rc_subscriptions`).
 * Call `logOut` when session ends.
 */
export async function syncRevenueCatUser(userId: string | null | undefined): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!purchasesConfigured) {
    await initRevenueCatIfNeeded();
  }
  if (!purchasesConfigured) return;

  try {
    if (!userId) {
      await Purchases.logOut();
      return;
    }
    await Purchases.logIn(userId);
  } catch (e) {
    Sentry.captureException(e);
  }
}
