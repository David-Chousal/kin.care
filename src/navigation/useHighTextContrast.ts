import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Android “High text contrast” (Display → Contrast / color). iOS always false.
 * When on, prefer opaque header chrome instead of live blur so titles stay readable.
 */
export function useHighTextContrast(): boolean {
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let cancelled = false;
    AccessibilityInfo.isHighTextContrastEnabled()
      .then((v: boolean) => {
        if (!cancelled) setHighContrast(!!v);
      })
      .catch(() => {
        if (!cancelled) setHighContrast(false);
      });

    const sub = AccessibilityInfo.addEventListener(
      'highTextContrastChanged',
      (v: boolean) => {
        setHighContrast(!!v);
      },
    );

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return highContrast;
}
