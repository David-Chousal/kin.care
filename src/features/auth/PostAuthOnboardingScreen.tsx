import { useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  AccessibilityInfo,
  type ListRenderItem,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { elevation, radius, space, typography, useTheme, type Theme } from '../../theme';
import { setPostAuthOnboardingSeen } from './postAuthOnboardingStorage';

const { width: SCREEN_W } = Dimensions.get('window');

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
const SLIDE_ICONS: Array<{ name: IoniconName; a11yLabelKey: string }> = [
  { name: 'medical-outline', a11yLabelKey: 'auth.postAuthOnboarding.icons.careTracking' },
  { name: 'chatbubbles-outline', a11yLabelKey: 'auth.postAuthOnboarding.icons.familyCommunication' },
  { name: 'people-outline', a11yLabelKey: 'auth.postAuthOnboarding.icons.sharedFamilySpace' },
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

export function PostAuthOnboardingScreen({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const { t: tx, i18n } = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const reduceMotion = useReduceMotion();

  const slides = useMemo<Slide[]>(
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

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setIndex(Math.min(Math.max(i, 0), slides.length - 1));
  };

  const goNext = async () => {
    if (index < slides.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: !reduceMotion });
      setIndex(index + 1);
    } else {
      await setPostAuthOnboardingSeen();
      onDone();
    }
  };

  const goBack = () => {
    if (index <= 0) return;
    listRef.current?.scrollToIndex({ index: index - 1, animated: !reduceMotion });
    setIndex(index - 1);
  };

  const skipOut = async () => {
    await setPostAuthOnboardingSeen();
    onDone();
  };

  const renderItem: ListRenderItem<Slide> = ({ item, index: slideIdx }) => {
    const icon = SLIDE_ICONS[slideIdx] ?? SLIDE_ICONS[0]!;
    return (
      <View style={[styles.slide, { width: SCREEN_W }]}>
        <View
          style={styles.heroCircle}
          accessibilityRole="image"
          accessibilityLabel={tx(icon.a11yLabelKey)}
        >
          <Ionicons name={icon.name} size={32} color={t.accent} />
        </View>
        <Text style={styles.headline}>{item.headline}</Text>
        <Text style={styles.body}>{item.body}</Text>
      </View>
    );
  };

  const isLastSlide = index === slides.length - 1;
  const ctaLabel = isLastSlide ? tx('auth.welcome.getStarted') : tx('auth.welcome.next');
  const ctaHint = isLastSlide
    ? tx('auth.welcome.a11y.getStartedHint')
    : tx('auth.welcome.a11y.nextHint', { next: index + 2, total: slides.length });

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topRow}>
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
            onPress={() => void skipOut()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={tx('auth.welcome.skip')}
            accessibilityHint={tx('auth.welcome.a11y.skipPostAuthHint')}
          >
            <Text style={styles.topEdgeLabel}>{tx('auth.welcome.skip')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={listRef}
        style={styles.list}
        data={slides}
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
          {slides.map((s, i) => (
            <View key={s.key} style={[styles.segment, i === index && styles.segmentActive]} />
          ))}
        </View>

        <TouchableOpacity
          style={styles.cta}
          onPress={() => void goNext()}
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
    list: {
      flex: 1,
    },
    slide: {
      flex: 1,
      paddingHorizontal: space[5],
      justifyContent: 'center',
      alignItems: 'center',
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

