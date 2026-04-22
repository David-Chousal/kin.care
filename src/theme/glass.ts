import { Platform } from 'react-native';
import type { Theme } from './index';

/**
 * When true, all header/sheet glass surfaces use the solid fallback (no live blur).
 * Flip for debugging or if blur causes perf issues on a specific build.
 */
export const GLASS_HEADER_FORCE_FALLBACK = false;

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
 * Semi-opaque “glass” approximation when blur is off (a11y, web, or forced fallback).
 * Uses hex + alpha suffix; falls back to opaque surface if `t.surface` is not #RRGGBB.
 */
export function frostGlassFallbackFill(t: Theme, scheme: 'light' | 'dark'): string {
  const hex = t.surface.replace('#', '');
  if (hex.length !== 6) return t.surface;
  const alpha = scheme === 'dark' ? 'E6' : 'EE';
  return `#${hex}${alpha}`;
}
