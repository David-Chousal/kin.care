import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, type Theme } from '../theme';

const SWIPE_COMMIT_THRESHOLD = 56;

interface Props {
  message: string;
  visible: boolean;
  onUndo: () => void;
  /** Called when the user swipes the bar away (delete is finalized). */
  onSwipeDismiss: () => void;
  undoLabel?: string;
}

export function UndoSnackbar({
  message,
  visible,
  onUndo,
  onSwipeDismiss,
  undoLabel = 'Undo',
}: Props) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) dragY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > SWIPE_COMMIT_THRESHOLD || g.vy > 0.35) {
            Animated.parallel([
              Animated.timing(dragY, { toValue: 120, duration: 160, useNativeDriver: true }),
              Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
            ]).start(() => {
              dragY.setValue(0);
              onSwipeDismiss();
            });
            return;
          }
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
        },
      }),
    [dragY, opacity, onSwipeDismiss],
  );

  useEffect(() => {
    if (!visible) return;
    dragY.setValue(0);
    opacity.setValue(0);
    translateY.setValue(20);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [visible, dragY, opacity, translateY]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity,
          transform: [{ translateY: Animated.add(translateY, dragY) }],
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      {...panResponder.panHandlers}
    >
      <View style={styles.row}>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
        <TouchableOpacity
          onPress={onUndo}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={undoLabel}
        >
          <Text style={styles.undo}>{undoLabel}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      bottom: 32,
      left: 16,
      right: 16,
      maxWidth: 480,
      alignSelf: 'center',
      backgroundColor: t.text,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      shadowColor: t.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    message: {
      flex: 1,
      color: t.bg,
      fontSize: 14,
      fontWeight: '600',
    },
    undo: {
      color: t.accent,
      fontSize: 15,
      fontWeight: '700',
    },
  });
}
