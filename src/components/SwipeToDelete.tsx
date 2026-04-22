import { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Icon } from './Icon';
import { useTheme, type Theme } from '../theme';

interface SwipeToDeleteProps {
  onDelete: () => void;
  children: React.ReactNode;
  label?: string;
  /** Screen reader name for the row (used with the Delete accessibility action). */
  accessibilityLabel?: string;
  rightThreshold?: number;
}

export function SwipeToDelete({
  onDelete,
  children,
  label = 'Delete',
  accessibilityLabel = 'Item',
  rightThreshold = 40,
}: SwipeToDeleteProps) {
  const t = useTheme();
  const styles = makeStyles(t);
  const ref = useRef<Swipeable>(null);

  function renderRightActions(progress: Animated.AnimatedInterpolation<number>) {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [80, 0],
    });
    return (
      <Animated.View style={[styles.action, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => { ref.current?.close(); onDelete(); }}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <Icon name="trash" size={18} color={t.surface} />
          <Text style={styles.actionText}>{label}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Swipeable
      ref={ref}
      renderRightActions={renderRightActions}
      rightThreshold={rightThreshold}
    >
      <View
        style={{ flex: 1 }}
        accessible
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Swipe up or down for actions."
        accessibilityActions={[{ name: 'delete', label }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'delete') {
            ref.current?.close();
            onDelete();
          }
        }}
      >
        {children}
      </View>
    </Swipeable>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    action: {
      width: 80,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: t.error,
      borderRadius: 14,
    },
    actionBtn: {
      flex: 1,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
    },
    actionText: {
      color: t.surface,
      fontWeight: '700',
      fontSize: 12,
      textAlign: 'center',
    },
  });
}
