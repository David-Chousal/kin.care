import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconName } from './Icon';
import { useTheme, type Theme, spacing, radius } from '../theme';

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  /** Defaults to theme borderLight (muted). Use e.g. `t.success` for positive empty states. */
  iconColor?: string;
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  testID,
  style,
  iconColor,
}: EmptyStateProps) {
  const t = useTheme();
  const styles = makeStyles(t);
  return (
    <View style={[styles.root, style]} testID={testID} accessibilityRole="none">
      <Icon name={icon} size={48} color={iconColor ?? t.borderLight} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        onPress={onAction}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
      >
        <Text style={styles.ctaLabel}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    root: {
      alignItems: 'center',
      paddingTop: spacing.xxxl + spacing.md,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
      gap: spacing.sm,
    },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: t.text,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    message: {
      fontSize: 14,
      color: t.textTertiary,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    cta: {
      alignSelf: 'stretch',
      maxWidth: 320,
      width: '100%',
      backgroundColor: t.accent,
      borderRadius: radius.xl,
      paddingVertical: spacing.md + 2,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
    },
    ctaPressed: { opacity: 0.88 },
    ctaLabel: {
      color: t.surface,
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
