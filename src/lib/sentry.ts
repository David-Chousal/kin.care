import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

function sentryEnvironment(): string {
  if (__DEV__) return 'development';
  const variant = process.env.EXPO_PUBLIC_APP_VARIANT;
  if (variant === 'preview') return 'preview';
  return 'production';
}

/** Stable release id for crash-free rates per native build (EAS autoIncrement updates dist). */
function sentryRelease(): string | undefined {
  if (__DEV__) return undefined;
  const slug = Constants.expoConfig?.slug ?? 'kin-care';
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const iosBuild = Constants.expoConfig?.ios?.buildNumber;
  const androidVc = Constants.expoConfig?.android?.versionCode;
  const dist =
    Platform.OS === 'ios'
      ? (iosBuild != null ? String(iosBuild) : undefined)
      : androidVc != null
        ? String(androidVc)
        : undefined;
  return dist ? `${slug}@${version}+${dist}` : `${slug}@${version}`;
}

export function initSentry() {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: sentryEnvironment(),
    release: sentryRelease(),
    dist:
      Platform.OS === 'ios'
        ? (Constants.expoConfig?.ios?.buildNumber != null
            ? String(Constants.expoConfig.ios.buildNumber)
            : undefined)
        : Constants.expoConfig?.android?.versionCode != null
          ? String(Constants.expoConfig.android.versionCode)
          : undefined,
    enableNativeNagger: false,
    tracesSampleRate: __DEV__ ? 0 : 0.2,
    // Health-adjacent UI: avoid capturing screen contents in crash reports (store / PHI posture).
    attachScreenshot: false,
  });
}

export { Sentry };
