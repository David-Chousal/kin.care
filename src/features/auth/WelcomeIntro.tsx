import { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Dimensions,
  AccessibilityInfo,
  type ListRenderItem,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme, space, radius, typography, elevation, type Theme } from '../../theme';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../../config/legal';
import { AuthSplitShell } from './AuthSplitShell';

const { width: SCREEN_W } = Dimensions.get('window');

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
const SLIDE_ICONS: Array<{ name: IoniconName; a11yLabel: string }> = [
  { name: 'medical-outline', a11yLabel: 'Care tracking' },
  { name: 'chatbubbles-outline', a11yLabel: 'Family communication' },
  { name: 'people-outline', a11yLabel: 'Shared family space' },
];

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

type Slide = { key: string; headline: string; body: string };
type HubPage = { kind: 'hub'; key: 'hub' };
type SlidePage = Slide & { kind: 'slide' };
type Page = HubPage | SlidePage;

export interface WelcomeIntroProps {
  onFinishLastSlide: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  onOpenSignIn: () => void | Promise<void>;
  onOpenSignUp: () => void | Promise<void>;
  onOpenJoinFamily: () => void;
}

export function WelcomeIntro({
  onFinishLastSlide,
  onSkip,
  onOpenSignIn,
  onOpenSignUp,
  onOpenJoinFamily,
}: WelcomeIntroProps) {
  const t = useTheme();
  const { t: tx, i18n } = useTranslation();
  const styles = makeStyles(t);
  const hubStyles = useMemo(() => makeHubStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const listRef = useRef<FlatList<Page>>(null);
  const reduceMotion = useReduceMotion();

  const slideData = useMemo<Slide[]>(
    () => [
      {
        key: '1',
        headline: tx('auth.welcome.slide1Headline'),
        body: tx('auth.welcome.slide1Body'),
      },
      {
        key: '2',
        headline: tx('auth.welcome.slide2Headline'),
        body: tx('auth.welcome.slide2Body'),
      },
      {
        key: '3',
        headline: tx('auth.welcome.slide3Headline'),
        body: tx('auth.welcome.slide3Body'),
      },
    ],
    [tx, i18n.language],
  );

  const pages = useMemo<Page[]>(
    () => [{ kind: 'hub', key: 'hub' }, ...slideData.map((s) => ({ ...s, kind: 'slide' as const }))],
    [slideData],
  );

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setIndex(Math.min(Math.max(i, 0), pages.length - 1));
  };

  const goNext = () => {
    if (index < pages.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: !reduceMotion });
      setIndex(index + 1);
    } else {
      void onFinishLastSlide();
    }
  };

  const goBack = () => {
    if (index <= 0) return;
    listRef.current?.scrollToIndex({ index: index - 1, animated: !reduceMotion });
    setIndex(index - 1);
  };

  const renderHub = () => (
    <View style={[styles.slide, styles.hubSlideOuter, { width: SCREEN_W }]}>
      <AuthSplitShell heroHeightFraction={0.36} showBrandInHero={false}>
        <ScrollView
          style={hubStyles.scroll}
          contentContainerStyle={hubStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          <Text style={hubStyles.hubTitle}>{tx('auth.welcome.hubTitle')}</Text>
          <Text style={hubStyles.hubTagline}>{tx('auth.welcome.hubTagline')}</Text>

          <TouchableOpacity
            style={hubStyles.checkRow}
            onPress={() => setLegalAccepted((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: legalAccepted }}
            accessibilityLabel={tx('auth.welcome.a11y.legalCheckbox')}
          >
            <View style={[hubStyles.checkBox, legalAccepted && hubStyles.checkBoxOn]}>
              {legalAccepted ? <Ionicons name="checkmark" size={16} color={t.surface} /> : null}
            </View>
            <Text style={hubStyles.checkLabel}>
              {tx('auth.welcome.legalPrefix')}
              <Text
                style={hubStyles.link}
                onPress={() => void Linking.openURL(TERMS_OF_SERVICE_URL)}
                accessibilityRole="link"
              >
                {tx('auth.welcome.termsLink')}
              </Text>
              {tx('auth.welcome.legalMid')}
              <Text
                style={hubStyles.link}
                onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
                accessibilityRole="link"
              >
                {tx('auth.welcome.privacyLink')}
              </Text>
              {tx('auth.welcome.legalSuffix')}
            </Text>
          </TouchableOpacity>

          <View style={hubStyles.dualRow}>
            <TouchableOpacity
              style={[hubStyles.pillSecondary, hubStyles.pillHalf]}
              onPress={() => void onOpenSignIn()}
              accessibilityRole="button"
              accessibilityLabel={tx('auth.welcome.logIn')}
              accessibilityHint={tx('auth.welcome.a11y.logInHint')}
            >
              <Text style={hubStyles.pillSecondaryText}>{tx('auth.welcome.logIn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                hubStyles.pillAccent,
                hubStyles.pillHalf,
                !legalAccepted && hubStyles.pillDisabled,
              ]}
              onPress={() => {
                if (!legalAccepted) return;
                void onOpenSignUp();
              }}
              disabled={!legalAccepted}
              accessibilityRole="button"
              accessibilityLabel={tx('auth.welcome.signUp')}
              accessibilityHint={tx('auth.welcome.a11y.signUpHint')}
              accessibilityState={{ disabled: !legalAccepted }}
            >
              <Text style={hubStyles.pillAccentText}>{tx('auth.welcome.signUp')}</Text>
            </TouchableOpacity>
          </View>

          <View style={hubStyles.orRow}>
            <View style={hubStyles.orLine} />
            <Text style={hubStyles.orText}>{tx('auth.welcome.or')}</Text>
            <View style={hubStyles.orLine} />
          </View>

          <TouchableOpacity
            style={hubStyles.pillGhost}
            onPress={onOpenJoinFamily}
            accessibilityRole="button"
            accessibilityLabel={tx('auth.welcome.joinFamily')}
            accessibilityHint={tx('auth.welcome.a11y.joinFamilyHint')}
          >
            <Text style={hubStyles.pillGhostText}>{tx('auth.welcome.joinFamily')}</Text>
          </TouchableOpacity>

          <Text style={hubStyles.emailHint}>{tx('auth.welcome.continueWithEmail')}</Text>
        </ScrollView>
      </AuthSplitShell>
    </View>
  );

  const renderItem: ListRenderItem<Page> = ({ item, index: slideIdx }) => {
    if (item.kind === 'hub') return renderHub();
    const icon = SLIDE_ICONS[slideIdx - 1] ?? SLIDE_ICONS[0]!;
    return (
      <View style={[styles.slide, { width: SCREEN_W }]}>
        <View style={styles.heroCircle} accessibilityElementsHidden importantForAccessibility="no">
          <Ionicons name={icon.name} size={32} color={t.accent} />
        </View>
        <Text style={styles.headline}>{item.headline}</Text>
        <Text style={styles.body}>{item.body}</Text>
      </View>
    );
  };

  const isLast = index === pages.length - 1;
  const isHub = index === 0;
  const ctaLabel = isHub
    ? tx('auth.welcome.learnMore')
    : isLast
      ? tx('auth.welcome.getStarted')
      : tx('auth.welcome.next');
  const ctaHint = isHub
    ? tx('auth.welcome.a11y.learnMoreHint')
    : isLast
      ? tx('auth.welcome.a11y.getStartedHint')
      : tx('auth.welcome.a11y.nextHint', { next: index + 1, total: pages.length });

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topRow}>
        <View style={styles.brandStripe} pointerEvents="none">
          <Text style={[styles.brand, index === 0 && styles.brandOnHub]}>{tx('auth.brand.name')}</Text>
        </View>
        <View style={[styles.topEdge, styles.topEdgeLeft]}>
          {index > 0 ? (
            <TouchableOpacity
              onPress={goBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={tx('auth.welcome.back')}
              accessibilityHint={tx('auth.welcome.a11y.backHint')}
            >
              <Text style={styles.topEdgeLabel}>{tx('auth.welcome.back')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={[styles.topEdge, styles.topEdgeRight]}>
          <TouchableOpacity
            onPress={() => void onSkip()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={tx('auth.welcome.skip')}
            accessibilityHint={tx('auth.welcome.a11y.skipHint')}
          >
            <Text style={[styles.topEdgeLabel, index === 0 && styles.topEdgeOnHub]}>{tx('auth.welcome.skip')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={listRef}
        style={styles.list}
        data={pages}
        extraData={i18n.language}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
        onMomentumScrollEnd={onMomentumEnd}
        onScrollToIndexFailed={({ index: i }) => {
          requestAnimationFrame(() => listRef.current?.scrollToIndex({ index: i, animated: false }));
        }}
        scrollEventThrottle={16}
      />

      <View style={styles.bottomChrome}>
        <View
          style={styles.indicator}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {pages.map((p, i) => (
            <View key={p.key} style={[styles.segment, i === index && styles.segmentActive]} />
          ))}
        </View>

        <TouchableOpacity
          style={styles.cta}
          onPress={goNext}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          accessibilityHint={ctaHint}
        >
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: t.bg,
    },
    topRow: {
      minHeight: 44,
      paddingTop: space[4],
      paddingBottom: space[2],
      position: 'relative',
    },
    brandStripe: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: space[4],
      bottom: space[2],
      justifyContent: 'center',
      alignItems: 'center',
    },
    brand: {
      ...typography.title,
      color: t.text,
      fontWeight: '700',
      letterSpacing: -0.5,
      textAlign: 'center',
    },
    brandOnHub: {
      color: 'rgba(255,255,255,0.92)',
    },
    topEdge: {
      position: 'absolute',
      top: space[4],
      bottom: space[2],
      justifyContent: 'center',
      zIndex: 1,
    },
    topEdgeLeft: {
      left: space[5],
      alignItems: 'flex-start',
    },
    topEdgeRight: {
      right: space[5],
      alignItems: 'flex-end',
    },
    topEdgeLabel: {
      ...typography.callout,
      color: t.textTertiary,
      fontWeight: '600',
    },
    topEdgeOnHub: {
      color: 'rgba(255,255,255,0.72)',
    },
    list: {
      flex: 1,
    },
    slide: {
      flex: 1,
      paddingHorizontal: space[5],
      justifyContent: 'center',
      alignItems: 'center',
    },
    hubSlideOuter: {
      paddingHorizontal: 0,
    },
    heroCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: t.accentLight,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.accentBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: space[6],
    },
    headline: {
      ...typography.display,
      fontSize: 36,
      lineHeight: 43,
      letterSpacing: -0.9,
      fontWeight: '800',
      color: t.text,
      marginBottom: space[3],
      textAlign: 'center',
      width: '100%',
    },
    body: {
      ...typography.body,
      fontSize: 17,
      lineHeight: 27,
      letterSpacing: 0,
      color: t.textSecondary,
      maxWidth: 320,
      textAlign: 'center',
      width: '100%',
    },
    bottomChrome: {
      paddingHorizontal: space[5],
      paddingTop: space[3],
      paddingBottom: space[4],
      gap: space[4],
    },
    indicator: {
      flexDirection: 'row',
      gap: space[1],
    },
    segment: {
      flex: 1,
      height: 3,
      borderRadius: radius.pill,
      backgroundColor: t.border,
    },
    segmentActive: {
      backgroundColor: t.accent,
    },
    cta: {
      backgroundColor: t.accent,
      borderRadius: radius.pill,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
      ...elevation(2, t.accent),
    },
    ctaText: {
      ...typography.subhead,
      fontSize: 17,
      fontWeight: '700',
      color: t.surface,
      letterSpacing: -0.1,
      textAlign: 'center',
    },
  });
}

function makeHubStyles(t: Theme) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    scrollContent: {
      flexGrow: 1,
      paddingTop: space[2],
      paddingBottom: space[6],
      paddingHorizontal: space[5],
    },
    hubTitle: {
      ...typography.display,
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800',
      letterSpacing: -0.65,
      color: t.text,
      textAlign: 'center',
      marginBottom: space[2],
    },
    hubTagline: {
      ...typography.body,
      fontSize: 16,
      lineHeight: 24,
      color: t.textSecondary,
      textAlign: 'center',
      marginBottom: space[4],
      maxWidth: 360,
      alignSelf: 'center',
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space[3],
      marginBottom: space[4],
      width: '100%',
    },
    checkBox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.border,
      marginTop: 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceAlt,
    },
    checkBoxOn: {
      backgroundColor: t.accent,
      borderColor: t.accent,
    },
    checkLabel: {
      ...typography.body,
      fontSize: 14,
      lineHeight: 20,
      color: t.textSecondary,
      flex: 1,
    },
    link: {
      color: t.accent,
      fontWeight: '600',
    },
    dualRow: {
      flexDirection: 'row',
      gap: space[2],
      marginBottom: space[3],
      width: '100%',
    },
    pillHalf: {
      flex: 1,
      minWidth: 0,
    },
    pillSecondary: {
      height: 56,
      borderRadius: radius.pill,
      backgroundColor: t.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillSecondaryText: {
      ...typography.subhead,
      fontSize: 16,
      fontWeight: '700',
      color: t.text,
    },
    pillAccent: {
      height: 56,
      borderRadius: radius.pill,
      backgroundColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
      ...elevation(2, t.accent),
    },
    pillAccentText: {
      ...typography.subhead,
      fontSize: 16,
      fontWeight: '700',
      color: t.surface,
    },
    pillDisabled: {
      opacity: 0.42,
    },
    orRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: space[3],
      gap: space[3],
      width: '100%',
    },
    orLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.border,
    },
    orText: {
      ...typography.caption,
      color: t.textSecondary,
      fontWeight: '600',
    },
    pillGhost: {
      width: '100%',
      height: 56,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: space[2],
      backgroundColor: 'transparent',
    },
    pillGhostText: {
      ...typography.subhead,
      fontSize: 17,
      fontWeight: '600',
      color: t.text,
    },
    emailHint: {
      ...typography.caption,
      color: t.textSecondary,
      textAlign: 'center',
      marginTop: space[1],
    },
  });
}
