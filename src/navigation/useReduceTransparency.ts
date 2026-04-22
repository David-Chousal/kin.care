import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * iOS “Reduce Transparency” (and similar). On Android this stays false.
 */
export function useReduceTransparency(): boolean {
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    let cancelled = false;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((v: boolean) => {
        if (!cancelled) setReduceTransparency(!!v);
      })
      .catch(() => {
        if (!cancelled) setReduceTransparency(false);
      });

    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', (v: boolean) => {
      setReduceTransparency(!!v);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return reduceTransparency;
}
