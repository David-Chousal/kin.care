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
