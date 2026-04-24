import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  type LayoutChangeEvent,
} from 'react-native';
import { hapticImpact, hapticSelection, ImpactFeedbackStyle } from '../../lib/haptics';
import { useTranslation } from 'react-i18next';
import { useTheme, type Theme, navigationTitleTextStyle, radius } from '../../theme';
import { useResolvedScheme } from '../../lib/useResolvedScheme';
import { getExpoGlassEffectModule } from '../../lib/expoGlassEffectOptional';
import { Icon } from '../../components/Icon';
import { HeaderFrostedBackdrop } from '../../components/HeaderFrostedBackdrop';

const PILL_WIDTH = 124;
const SPRING = { friction: 11, tension: 72, useNativeDriver: false as const };

interface Props {
  onOpenVisitPrep: () => void;
}

export function VisitPrepGlassPromo({ onOpenVisitPrep }: Props) {
  const t = useTheme();
  const { t: tx } = useTranslation();
  const resolvedScheme = useResolvedScheme();
  const styles = makeStyles(t);
  const [expanded, setExpanded] = useState(false);
  const [trackWidth, setTrackWidth] = useState(320);
  const [expandedHeight, setExpandedHeight] = useState(136);
  const progress = useRef(new Animated.Value(0)).current;

  const glassModule = useMemo(() => getExpoGlassEffectModule(), []);
  const useNativeGlass = glassModule != null;
  const GlassView = glassModule?.GlassView;

  const fullWidth = Math.max(PILL_WIDTH + 8, trackWidth);
  /** Final inner row width so title/body measure once; shell clips until wide enough (no reflow fight). */
  const heroLayoutWidth = Math.max(PILL_WIDTH, fullWidth - 36);

  const shellWidth = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [PILL_WIDTH, fullWidth],
        extrapolate: 'clamp',
      }),
    [progress, fullWidth],
  );

  const shellRadius = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [radius.pill, 16],
        extrapolate: 'clamp',
      }),
    [progress],
  );

  const shellHeight = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [42, Math.max(100, expandedHeight)],
        extrapolate: 'clamp',
      }),
    [progress, expandedHeight],
  );

  const pillFadeOut = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 0.28],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [progress],
  );

  const expandedFadeIn = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0.58, 0.88],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    [progress],
  );

  const expandedSlideUp = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0.58, 0.88],
        outputRange: [10, 0],
        extrapolate: 'clamp',
      }),
    [progress],
  );

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setTrackWidth(w);
  }, []);

  const onInnerLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (!expanded) return;
      const h = e.nativeEvent.layout.height;
      if (h > 0) setExpandedHeight(Math.min(260, Math.ceil(h)));
    },
    [expanded],
  );

  const runExpand = useCallback(() => {
    requestAnimationFrame(() => {
      Animated.spring(progress, { toValue: 1, ...SPRING }).start();
    });
  }, [progress]);

  const runCollapse = useCallback(() => {
    Animated.spring(progress, { toValue: 0, ...SPRING }).start();
  }, [progress]);

  const handleMainPress = useCallback(() => {
    if (!expanded) {
      hapticImpact(ImpactFeedbackStyle.Light);
      setExpanded(true);
      runExpand();
      return;
    }
    hapticImpact(ImpactFeedbackStyle.Medium);
    onOpenVisitPrep();
  }, [expanded, runExpand, onOpenVisitPrep]);

  const handleCollapse = useCallback(() => {
    hapticSelection();
    // Switch to pill first so the wide shell does not reflow the full card (which grows height).
    setExpanded(false);
    setExpandedHeight(136);
    runCollapse();
  }, [runCollapse]);

  const animatedFrameStyle = useMemo(
    () => ({
      width: shellWidth,
      borderRadius: shellRadius,
      height: shellHeight,
      overflow: 'hidden' as const,
      alignSelf: 'flex-end' as const,
    }),
    [shellWidth, shellRadius, shellHeight],
  );

  const inner = (
    <View style={styles.innerRoot} onLayout={onInnerLayout}>
      {expanded ? (
        <Pressable
          onPress={handleCollapse}
          style={({ pressed }) => [styles.collapseTouch, pressed && styles.collapsePressed]}
          hitSlop={12}
          accessibilityLabel={tx('visitPrep.promo.a11yHideSummary')}
          accessibilityRole="button"
        >
          <Icon name="close" size={16} color={t.textTertiary} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={handleMainPress}
        style={expanded ? styles.mainTouchExpanded : styles.mainTouchCollapsed}
        accessibilityRole="button"
        accessibilityLabel={expanded ? tx('visitPrep.promo.a11yExpandedSummary') : tx('visitPrep.promo.a11yCollapsed')}
        accessibilityState={{ expanded }}
        accessibilityHint={
          expanded
            ? tx('visitPrep.promo.a11yExpandedHint')
            : tx('visitPrep.promo.a11yCollapsedHint')
        }
      >
        {expanded ? (
          <View style={styles.crossfadeStage}>
            <Animated.View
              style={[
                styles.expandedFadeLayer,
                {
                  width: heroLayoutWidth,
                  opacity: expandedFadeIn,
                  transform: [{ translateY: expandedSlideUp }],
                },
              ]}
              pointerEvents="box-none"
            >
              <View style={styles.visitPrepHeroIconWrap}>
                <Icon name="visitprep" size={26} color={t.accent} />
              </View>
              <View style={styles.visitPrepHeroText}>
                <View style={styles.visitPrepHeroTopRow}>
                  <View style={styles.visitPrepBadge}>
                    <Text style={styles.visitPrepBadgeText}>{tx('visitPrep.promo.badge')}</Text>
                  </View>
                  <Text style={styles.visitPrepHeroEyebrow}>{tx('visitPrep.promo.eyebrow')}</Text>
                </View>
                <Text style={styles.visitPrepHeroTitle}>{tx('visitPrep.promo.heroTitle')}</Text>
                <Text style={styles.visitPrepHeroSub}>
                  {tx('visitPrep.promo.heroSub')}
                </Text>
              </View>
              <Icon name="chevron" size={20} color={t.accent} />
            </Animated.View>
            <Animated.View
              style={[styles.pillFadeLayer, { opacity: pillFadeOut }]}
              pointerEvents="none"
            >
              <Text style={styles.pillLabel}>{tx('visitPrep.promo.pillLabel')}</Text>
            </Animated.View>
          </View>
        ) : (
          <Text style={styles.pillLabel}>{tx('visitPrep.promo.pillLabel')}</Text>
        )}
      </Pressable>
    </View>
  );

  return (
    <View style={styles.track} onLayout={onTrackLayout}>
      {useNativeGlass && GlassView ? (
        <Animated.View style={[animatedFrameStyle, styles.shell]}>
          <GlassView
            style={StyleSheet.absoluteFillObject}
            glassEffectStyle="regular"
            tintColor={`${t.accent}33`}
            colorScheme={resolvedScheme === 'dark' ? 'dark' : 'light'}
          >
            {inner}
          </GlassView>
        </Animated.View>
      ) : (
        <Animated.View style={[animatedFrameStyle, styles.shell, styles.fallbackOuter]}>
          <HeaderFrostedBackdrop />
          <View style={styles.fallbackContent}>{inner}</View>
        </Animated.View>
      )}
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    track: {
      width: '100%',
      alignItems: 'flex-end',
    },
    shell: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderLight,
      ...Platform.select({
        ios: {
          shadowColor: t.shadow,
          shadowOpacity: 0.08,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
        },
        android: { elevation: 3 },
        default: {},
      }),
    },
    fallbackOuter: {
      position: 'relative',
    },
    fallbackContent: {
      position: 'relative',
      zIndex: 1,
    },
    innerRoot: {
      position: 'relative',
    },
    collapseTouch: {
      position: 'absolute',
      top: 6,
      end: 6,
      zIndex: 2,
      padding: 8,
      borderRadius: 12,
    },
    collapsePressed: {
      transform: [{ scale: 0.92 }],
    },
    mainTouchCollapsed: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mainTouchExpanded: {
      paddingVertical: 16,
      paddingHorizontal: 16,
      paddingTop: 36,
    },
    crossfadeStage: {
      position: 'relative',
      width: '100%',
    },
    expandedFadeLayer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    pillFadeLayer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
    },
    pillLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: t.accent,
      letterSpacing: 0.2,
    },
    visitPrepHeroIconWrap: {
      width: 50,
      height: 50,
      borderRadius: 14,
      backgroundColor: t.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.accentBorder,
    },
    visitPrepHeroText: { flex: 1, minWidth: 0 },
    visitPrepHeroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    visitPrepBadge: {
      backgroundColor: t.accent,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 5,
    },
    visitPrepBadgeText: { fontSize: 10, fontWeight: '800', color: t.surface, letterSpacing: 0.6 },
    visitPrepHeroEyebrow: {
      fontSize: 11,
      fontWeight: '700',
      color: t.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    visitPrepHeroTitle: { ...navigationTitleTextStyle(t) },
    visitPrepHeroSub: { fontSize: 13, color: t.textSecondary, marginTop: 4, lineHeight: 18 },
  });
}
