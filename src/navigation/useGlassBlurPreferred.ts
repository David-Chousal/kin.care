import { Platform } from 'react-native';
import { GLASS_ANDROID_MIN_API_FOR_LIVE_BLUR, GLASS_HEADER_FORCE_FALLBACK } from '../theme/glass';
import { useHighTextContrast } from './useHighTextContrast';
import { useReduceMotion } from './useReduceMotion';
import { useReduceTransparency } from './useReduceTransparency';

export type GlassBlurPreferredOptions = {
  /** When true, ignores `GLASS_HEADER_FORCE_FALLBACK` (blur still off for motion/transparency/web). */
  ignoreForceFallback?: boolean;
};

/**
 * Whether live `expo-blur` should run for glass chrome (headers, sheets).
 * Respects Reduce Motion, Reduce Transparency (iOS), Android high text contrast,
 * Android API below `GLASS_ANDROID_MIN_API_FOR_LIVE_BLUR` (see `theme/glass`), web, and
 * `GLASS_HEADER_FORCE_FALLBACK`.
 */
export function useGlassBlurPreferred(options?: GlassBlurPreferredOptions): boolean {
  const reduceMotion = useReduceMotion();
  const reduceTransparency = useReduceTransparency();
  const highTextContrast = useHighTextContrast();
  const ignoreForce = options?.ignoreForceFallback === true;

  if (!ignoreForce && GLASS_HEADER_FORCE_FALLBACK) return false;
  if (Platform.OS === 'web') return false;
  if (reduceMotion) return false;
  if (reduceTransparency) return false;
  if (highTextContrast) return false;
  if (
    Platform.OS === 'android' &&
    typeof Platform.Version === 'number' &&
    Platform.Version < GLASS_ANDROID_MIN_API_FOR_LIVE_BLUR
  ) {
    return false;
  }
  return true;
}
