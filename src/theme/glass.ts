import { Platform } from 'react-native';
import type { Theme } from './index';

/**
 * When true, all header/sheet glass surfaces use the solid fallback (no live blur).
 * Flip for debugging or if blur causes perf issues on a specific build.
 */
export const GLASS_HEADER_FORCE_FALLBACK = false;

/**
 * expo-blur on Android uses `RenderEffectBlur` only from API 31; below that
 * `RenderScriptBlur` often degrades to an opaque gray slab with poor contrast
 * against header labels. Prefer opaque `t.surface` chrome instead.
 */
export const GLASS_ANDROID_MIN_API_FOR_LIVE_BLUR = 31;

/** Unified frosted chrome blur strength (headers, footer, floating fallback). */
export const GLASS_BLUR_INTENSITY = {
  ios: 80,
  android: 72,
} as const;

/** Android blur tuning — shared with all `expo-blur` surfaces. */
export const glassBlurAndroidProps = {
  experimentalBlurMethod: 'dimezisBlurView' as const,
  blurReductionFactor: 3,
};

/** iOS / default blur reduction (non-Android). */
export const glassBlurIosProps = {
  blurReductionFactor: 4,
};

export function glassBlurPlatformProps(): typeof glassBlurAndroidProps | typeof glassBlurIosProps {
  return Platform.OS === 'android' ? glassBlurAndroidProps : glassBlurIosProps;
}

/** Semi-opaque veil on top of blur for legibility (matches Visit Prep fallback). */
export function frostVeilColor(t: Theme, scheme: 'light' | 'dark'): string {
  return scheme === 'dark' ? `${t.surface}35` : `${t.surface}AA`;
}

/** Solid fill when Reduce Motion avoids live blur. */
export function frostSolidFallbackColor(t: Theme): string {
  return t.surface;
}

/**
 * Opaque header/sheet chrome when live blur is off (reduce motion/transparency,
 * web, older Android blur, high text contrast, or forced fallback). Uses
 * `t.surface` so titles and controls keep the same contrast as the rest of the app.
 */
export function frostGlassFallbackFill(t: Theme, _scheme: 'light' | 'dark'): string {
  return t.surface;
}
