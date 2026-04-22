import { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  type ListRenderItem,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme, spacing, space, radius, typography, elevation, type Theme } from '../../theme';

const { width: SCREEN_W } = Dimensions.get('window');

type Slide = { key: string; headline: string; body: string };

interface Props {
  onComplete: () => void;
}

export function WelcomeIntro({ onComplete }: Props) {
  const t = useTheme();
  const { t: tx, i18n } = useTranslation();
  const styles = makeStyles(t);
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);

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

  const goNext = () => {
    if (index < slides.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
      setIndex(index + 1);
    } else {
      onComplete();
    }
  };

  const renderItem: ListRenderItem<Slide> = ({ item }) => (
    <View style={[styles.slide, { width: SCREEN_W }]}>
      <Text style={styles.headline}>{item.headline}</Text>
      <Text style={styles.body}>{item.body}</Text>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[4] }]}>
      <View style={styles.topRow}>
        <Text style={styles.brand}>{tx('auth.brand.name')}</Text>
        <TouchableOpacity onPress={onComplete} hitSlop={12}>
          <Text style={styles.skip}>{tx('auth.welcome.skip')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
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
      />

      <View style={styles.dots}>
        {slides.map((s, i) => (
          <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <TouchableOpacity style={styles.cta} onPress={goNext} activeOpacity={0.85}>
        <Text style={styles.ctaText}>
          {index < slides.length - 1 ? tx('auth.welcome.next') : tx('auth.welcome.getStarted')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space[5],
      marginBottom: spacing.xl,
    },
    brand: { ...typography.title, color: t.text, fontWeight: '700' },
    skip: { ...typography.callout, color: t.textTertiary, fontWeight: '600' },
    slide: {
      paddingHorizontal: space[5],
      paddingTop: space[6],
      justifyContent: 'flex-start',
    },
    headline: {
      ...typography.display,
      fontSize: 34,
      lineHeight: 41,
      letterSpacing: -0.75,
      color: t.text,
      marginBottom: space[4],
    },
    body: {
      // typography-exception: intro slide uses slightly larger reading size than in-app body
      ...typography.body,
      fontSize: 17,
      lineHeight: 26,
      letterSpacing: 0.02,
      color: t.textSecondary,
      maxWidth: 340,
    },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: space[2], marginTop: spacing.xl },
    dot: { width: space[2], height: space[2], borderRadius: space[1], backgroundColor: t.border },
    // layout-exception: elongated active dot (carousel affordance)
    dotActive: { backgroundColor: t.accent, width: 22 },
    cta: {
      marginHorizontal: space[5],
      marginTop: space[5],
      backgroundColor: t.accent,
      borderRadius: radius.xl,
      paddingVertical: space[4],
      alignItems: 'center',
      ...elevation(4, t.accent),
    },
    ctaText: { ...typography.subhead, color: t.surface, fontWeight: '700' },
  });
}
