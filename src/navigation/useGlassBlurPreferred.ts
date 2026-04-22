import { Platform } from 'react-native';
import { GLASS_HEADER_FORCE_FALLBACK } from '../theme/glass';
import { useReduceMotion } from './useReduceMotion';
import { useReduceTransparency } from './useReduceTransparency';

export type GlassBlurPreferredOptions = {
  /** When true, ignores `GLASS_HEADER_FORCE_FALLBACK` (blur still off for motion/transparency/web). */
  ignoreForceFallback?: boolean;
};

/**
 * Whether live `expo-blur` should run for glass chrome (headers, sheets).
 * Respects Reduce Motion, Reduce Transparency (iOS), web, and `GLASS_HEADER_FORCE_FALLBACK`.
 */
export function useGlassBlurPreferred(options?: GlassBlurPreferredOptions): boolean {
  const reduceMotion = useReduceMotion();
  const reduceTransparency = useReduceTransparency();
  const ignoreForce = options?.ignoreForceFallback === true;

  if (!ignoreForce && GLASS_HEADER_FORCE_FALLBACK) return false;
  if (Platform.OS === 'web') return false;
  if (reduceMotion) return false;
  if (reduceTransparency) return false;
  return true;
}
