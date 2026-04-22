import { Platform } from 'react-native';

type ExpoGlassEffectModule = typeof import('expo-glass-effect');

/** `undefined` = not yet attempted; `null` = native glass unavailable or failed to load. */
let cached: ExpoGlassEffectModule | null | undefined;

/**
 * Loads expo-glass-effect only when the native `ExpoGlassEffect` module is present.
 *
 * The package sets `sideEffects: false`, so `require('expo-glass-effect')` may not eagerly load
 * `GlassView.ios.js`. We must probe `isGlassEffectAPIAvailable` and touch `GlassView` inside this
 * try/catch; otherwise the first call in a component can throw outside any loader guard.
 */
export function getExpoGlassEffectModule(): ExpoGlassEffectModule | null {
  if (Platform.OS !== 'ios') return null;
  if (cached === null) return null;
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-glass-effect') as ExpoGlassEffectModule;
    if (typeof mod.isGlassEffectAPIAvailable !== 'function' || !mod.isGlassEffectAPIAvailable()) {
      cached = null;
      return null;
    }
    // Force evaluation of native view manager (lazy with sideEffects: false).
    if (mod.GlassView == null) {
      cached = null;
      return null;
    }
    cached = mod;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}
