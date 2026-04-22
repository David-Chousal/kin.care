import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { useTheme, type Theme } from '../theme';

interface Props {
  message: string;
  visible: boolean;
  type?: 'success' | 'info';
  onHide: () => void;
}

export function Toast({ message, visible, type = 'success', onHide }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const t = useTheme();
  const styles = makeStyles(t);

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    translateY.setValue(20);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(onHide);
      }, 1800);
    });
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.toast, type === 'info' && styles.info, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    toast: {
      position: 'absolute',
      bottom: 32,
      alignSelf: 'center',
      backgroundColor: t.text,
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 10,
      shadowColor: t.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    info: { backgroundColor: t.accent },
    text: { color: t.bg, fontSize: 14, fontWeight: '600' },
  });
}
