import { createElement } from 'react';
import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { Theme } from '../theme';
import { GlassNativeStackHeaderBackground } from './GlassNativeStackHeaderBackground';

/**
 * Native stack header defaults for Kin main stack (Expo 54 / RN 0.81 /
 * @react-navigation/native-stack ^7.14, react-native-screens ~4.16).
 *
 * Glass chrome: `headerTransparent` + custom `headerBackground` using shared
 * `HeaderFrostedBackdrop` (blur or semi-opaque fallback). `headerShadowVisible` is off;
 * the backdrop draws the bottom hairline for a consistent separator.
 *
 * Trailing actions use shrink-wrapped `NativeHeaderTextButton` (no `flex:1` in `headerRight`)
 * so iOS does not merge controls into one wide capsule over the title.
 *
 * Special cases (no extra blur copy/paste — extend this helper if needed):
 * - Hero / edge-to-edge content under the bar: add per-screen `contentStyle` padding or a
 *   dedicated option later; avoid stacking a second frosted strip over the native header.
 * - Modal `pageSheet` headers: use `BlurredHeaderBar` (same `HeaderFrostedBackdrop`).
 */
export function nativePushHeaderScreenOptions(t: Theme): NativeStackNavigationOptions {
  const base: NativeStackNavigationOptions = {
    headerShown: true,
    headerTintColor: t.accent,
    headerTitleStyle: {
      color: t.text,
      fontSize: 17,
      fontWeight: '600' as const,
    },
    headerBackButtonDisplayMode: 'default',
    contentStyle: { backgroundColor: t.bg },
    headerTransparent: true,
    headerShadowVisible: false,
    headerBlurEffect: undefined,
    headerBackground: () => createElement(GlassNativeStackHeaderBackground),
    headerStyle: {
      backgroundColor: 'transparent',
    },
    ...(Platform.OS === 'android' ? { headerStatusBarTranslucent: true } : {}),
  };

  return base;
}
