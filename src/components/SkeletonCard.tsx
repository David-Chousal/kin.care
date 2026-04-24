import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { useTheme, type Theme } from '../theme';

interface Props {
  lines?: number;
  height?: number;
}

export function SkeletonCard({ lines = 2, height = 72 }: Props) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  const t = useTheme();
  const styles = makeStyles(t);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.card, { height, opacity }]}>
      <View style={styles.icon} />
      <View style={styles.lines}>
        <View style={[styles.line, { width: '60%' }]} />
        {lines >= 2 && <View style={[styles.line, { width: '40%', marginTop: 8 }]} />}
        {lines >= 3 && <View style={[styles.line, { width: '25%', marginTop: 6 }]} />}
      </View>
    </Animated.View>
  );
}

export function SkeletonList({ count = 4, lines = 2 }: { count?: number; lines?: number }) {
  return (
    <View style={{ padding: 16, gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </View>
  );
}

/** Matches settings profile row: avatar, two text lines, edit affordance — avoids layout jump while profile loads. */
export function ProfileRowSkeleton() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  const t = useTheme();
  const styles = makeProfileRowSkeletonStyles(t);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => {
      anim.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.row, { opacity }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.avatar} />
      <View style={styles.textBlock}>
        <View style={styles.linePrimary} />
        <View style={styles.lineSecondary} />
      </View>
      <View style={styles.editPill} />
    </Animated.View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: t.surface,
      borderRadius: 14,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      shadowColor: t.shadow,
      shadowOpacity: 0.03,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    },
    icon: { width: 40, height: 40, borderRadius: 10, backgroundColor: t.border },
    lines: { flex: 1 },
    line: { height: 12, borderRadius: 6, backgroundColor: t.border },
  });
}

function makeProfileRowSkeletonStyles(t: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      width: '100%',
      minHeight: 48,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: t.border,
    },
    textBlock: { flex: 1, gap: 8, justifyContent: 'center' },
    linePrimary: {
      height: 15,
      width: '55%',
      maxWidth: 180,
      borderRadius: 7,
      backgroundColor: t.border,
    },
    lineSecondary: {
      height: 13,
      width: '72%',
      maxWidth: 220,
      borderRadius: 6,
      backgroundColor: t.border,
    },
    editPill: {
      width: 36,
      height: 16,
      borderRadius: 4,
      backgroundColor: t.border,
    },
  });
}
