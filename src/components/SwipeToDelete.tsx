import { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { useTheme, type Theme } from '../theme';

interface SwipeToDeleteProps {
  onDelete: () => void;
  children: React.ReactNode;
  label?: string;
  /** Screen reader name for the row (used with the Delete accessibility action). */
  accessibilityLabel?: string;
  /** Screen reader hint for the row (keep short; long strings may be truncated by VoiceOver). */
  accessibilityHint?: string;
  rightThreshold?: number;
}

export function SwipeToDelete({
  onDelete,
  children,
  label,
  accessibilityLabel = 'Item',
  accessibilityHint,
  rightThreshold = 40,
}: SwipeToDeleteProps) {
  const { t: tx } = useTranslation();
  const t = useTheme();
  const styles = makeStyles(t);
  const ref = useRef<Swipeable>(null);
  const deleteLabel = label ?? tx('common.delete', { defaultValue: 'Delete' });
  const hint = accessibilityHint ?? tx('common.a11y.swipeToRevealDeleteHint', { defaultValue: 'Swipe for delete.' });

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
          accessibilityLabel={deleteLabel}
        >
          <Icon name="trash" size={20} color={t.surface} />
          <Text style={styles.actionText}>{deleteLabel}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Swipeable
      ref={ref}
      renderRightActions={renderRightActions}
      rightThreshold={rightThreshold}
      overshootRight={false}
    >
      <View
        accessible
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={hint}
        accessibilityActions={[{ name: 'delete', label: deleteLabel }]}
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
