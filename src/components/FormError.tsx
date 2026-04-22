import { useEffect, useRef } from 'react';
import { Platform, Text, View, StyleSheet } from 'react-native';
import { announceForAccessibility } from '../lib/a11y/announceForAccessibility';
import { useTheme, typography, type Theme } from '../theme';

interface Props {
  message: string | null | undefined;
}

/**
 * Inline validation / form error with assertive live region (Android) and explicit announcement (iOS).
 */
export function FormError({ message }: Props) {
  const t = useTheme();
  const styles = makeStyles(t);
  const prev = useRef<string | null>(null);

  useEffect(() => {
    const next = message?.trim() ?? '';
    if (!next) {
      prev.current = null;
      return;
    }
    if (next !== prev.current) {
      announceForAccessibility(next);
      prev.current = next;
    }
  }, [message]);

  const text = message?.trim();
  if (!text) return null;

  return (
    <View
      accessibilityRole="alert"
      {...(Platform.OS === 'android' ? { accessibilityLiveRegion: 'assertive' as const } : {})}
      style={styles.wrap}
    >
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    wrap: { marginBottom: 8 },
    text: { ...typography.caption, color: t.error, fontWeight: '600' },
  });
}
