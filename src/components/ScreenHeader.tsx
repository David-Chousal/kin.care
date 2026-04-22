import type { ReactNode } from 'react';
import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Animated, Easing } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';
import {
  useTheme,
  type Theme,
  spacing,
  typography,
  navigationTitleTextStyle,
  navigationSubtitleTextStyle,
  NAVIGATION_HEADER_TOOLBAR,
  NAVIGATION_HEADER_CHROME_PAD,
  navigationStickyChromeHeight,
} from '../theme';
import { HeaderFrostedBackdrop } from './HeaderFrostedBackdrop';
import { useReduceMotion } from '../navigation/useReduceMotion';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Optional override for the back row text. Defaults to "Back". */
  backLabel?: string;
  /**
   * Icon before the label (Ionicons chevron-back). Defaults to `back` when `onBack` is set.
   * Pass `null` for text-only (no chevron).
   */
  backIcon?: IconName | null;
  rightLabel?: string;
  onRight?: () => void;
  rightIcon?: IconName;
  rightDestructive?: boolean;
}

export type ScreenWithBlurredHeaderProps = Props & { children: ReactNode };

/** Measured header height for `contentContainerStyle.paddingTop` so lists scroll under the blur. */
const ScreenHeaderOverlayInsetContext = createContext(96);

export function useScreenHeaderOverlayInset(): number {
  return useContext(ScreenHeaderOverlayInsetContext);
}

/**
 * Header is absolutely stacked above the body. Do not pad the body — use `useScreenHeaderOverlayInset()`
 * on `ScrollView` / `FlatList` `contentContainerStyle.paddingTop` so content scrolls under the blur.
 */
export function ScreenWithBlurredHeader({ children, ...headerProps }: ScreenWithBlurredHeaderProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const initialH = navigationStickyChromeHeight(insets.top);
  const [headerHeight, setHeaderHeight] = useState(initialH);

  return (
    <ScreenHeaderOverlayInsetContext.Provider value={headerHeight}>
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={{ flex: 1 }}>{children}</View>
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            elevation: 24,
          }}
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        >
          <ScreenHeader {...(headerProps as Props)} />
        </View>
      </View>
    </ScreenHeaderOverlayInsetContext.Provider>
  );
}

export function ScreenHeader({
  title,
  onBack,
  subtitle,
  backLabel,
  backIcon,
  rightLabel,
  onRight,
  rightIcon,
  rightDestructive = false,
}: Props) {
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const styles = makeStyles(t);

  const backOpacity = useRef(new Animated.Value(onBack ? 0 : 1)).current;

  useEffect(() => {
    if (!onBack) {
      backOpacity.setValue(1);
      return;
    }
    // If the back affordance appears after mount, ensure we start hidden for the focus fade-in.
    backOpacity.setValue(0);
  }, [onBack, backOpacity]);

  useFocusEffect(
    useCallback(() => {
      if (!onBack) return () => {};

      if (reduceMotion) {
        backOpacity.setValue(1);
        return () => {
          backOpacity.setValue(0);
        };
      }

      backOpacity.setValue(0);
      const animIn = Animated.timing(backOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animIn.start();

      return () => {
        animIn.stop();
        Animated.timing(backOpacity, {
          toValue: 0,
          duration: 140,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start();
      };
    }, [onBack, reduceMotion, backOpacity]),
  );

  const resolvedBackLabel = backLabel ?? 'Back';
  const resolvedBackIcon: IconName | null =
    !onBack ? null : backIcon === null ? null : (backIcon ?? 'back');

  const backPressable = onBack ? (
    <Pressable
      onPress={onBack}
      style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={resolvedBackLabel}
      android_ripple={{ color: `${t.accent}22`, borderless: true }}
    >
      {resolvedBackIcon ? <Icon name={resolvedBackIcon} size={18} color={t.accent} /> : null}
      <Text style={[styles.actionText, styles.chromeLeadingLabel]} numberOfLines={1}>
        {resolvedBackLabel}
      </Text>
    </Pressable>
  ) : null;

  return (
    <View style={[styles.header, { paddingTop: insets.top + NAVIGATION_HEADER_CHROME_PAD }]}>
      <HeaderFrostedBackdrop />

      <View style={styles.row}>
        <View style={styles.left}>
          {onBack ? (
            <Animated.View style={[styles.backVisibleWrap, { opacity: backOpacity }]}>{backPressable}</Animated.View>
          ) : (
            <View style={styles.leftPlaceholder} />
          )}
        </View>

        <View pointerEvents="none" style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.right}>
          {onRight && (rightLabel || rightIcon) ? (
            rightLabel ? (
              <Pressable
                onPress={onRight}
                style={({ pressed }) => [
                  styles.actionBtn,
                  rightDestructive && styles.actionBtnDestructive,
                  pressed && styles.pressed,
                ]}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={rightLabel}
                android_ripple={{
                  color: rightDestructive ? `${t.error}33` : `${t.accent}22`,
                  borderless: true,
                }}
              >
                {rightIcon ? <Icon name={rightIcon} size={18} color={rightDestructive ? t.error : t.accent} /> : null}
                <Text style={[styles.actionText, rightDestructive && styles.actionTextDestructive]} numberOfLines={1}>
                  {rightLabel}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onRight}
                style={({ pressed }) => [styles.headerActionIcon, pressed && styles.pressed]}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Action"
                android_ripple={{ color: t.border, borderless: true }}
              >
                <Icon name={rightIcon!} size={20} color={rightDestructive ? t.error : t.textSecondary} />
              </Pressable>
            )
          ) : (
            <View style={styles.rightPlaceholder} />
          )}
        </View>
      </View>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    header: {
      position: 'relative',
      overflow: 'hidden',
      paddingHorizontal: spacing.xl,
      paddingBottom: NAVIGATION_HEADER_CHROME_PAD,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
      ...Platform.select({
        ios: {},
        default: { elevation: 10 },
      }),
    },
    chromeLeadingLabel: {
      flexShrink: 1,
      maxWidth: 200,
    },
    row: {
      position: 'relative',
      zIndex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: NAVIGATION_HEADER_TOOLBAR,
    },
    left: {
      flex: 1,
      alignItems: 'flex-start',
      position: 'relative',
      minHeight: NAVIGATION_HEADER_TOOLBAR,
      justifyContent: 'center',
    },
    right: { flex: 1, alignItems: 'flex-end', justifyContent: 'center', minHeight: NAVIGATION_HEADER_TOOLBAR },
    leftPlaceholder: { width: NAVIGATION_HEADER_TOOLBAR, height: NAVIGATION_HEADER_TOOLBAR },
    rightPlaceholder: { width: NAVIGATION_HEADER_TOOLBAR, height: NAVIGATION_HEADER_TOOLBAR },
    backVisibleWrap: {
      alignSelf: 'flex-start',
    },
    titleWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      ...navigationTitleTextStyle(t),
      textAlign: 'center',
      width: '100%',
      paddingHorizontal: spacing.sm,
    },
    subtitle: {
      ...navigationSubtitleTextStyle(t),
      marginTop: 2,
      textAlign: 'center',
      width: '100%',
      paddingHorizontal: spacing.sm,
    },
    headerActionIcon: {
      width: NAVIGATION_HEADER_TOOLBAR,
      height: NAVIGATION_HEADER_TOOLBAR,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: 4,
      paddingHorizontal: spacing.xs,
      backgroundColor: 'transparent',
    },
    actionBtnDestructive: { backgroundColor: 'transparent' },
    actionText: {
      ...typography.callout,
      color: t.accent,
      fontWeight: '700',
    },
    actionTextDestructive: { color: t.error },
    pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  });
}
