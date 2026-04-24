import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, TouchableOpacity, Pressable, StyleSheet, ActivityIndicator,
  Animated, RefreshControl, Platform, type NativeSyntheticEvent, type NativeScrollEvent, Easing,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderFrostedBackdrop } from '../../components/HeaderFrostedBackdrop';
import { BlurredFooterChrome, homeFooterScrollPaddingBottom } from '../../components/BlurredFooterChrome';
import { LinearGradient } from 'expo-linear-gradient';
import { useFamilyStore } from '../../store/family';
import { useAuthStore } from '../../store/auth';
import { consumePendingPostAuthIntent } from '../auth/pendingAuthIntent';
import { DashboardSummary } from './DashboardSummary';
import { useFamily } from '../family/hooks/useFamily';
import { CreateFamilyScreen } from '../family/CreateFamilyScreen';
import { AcceptInviteScreen } from '../family/AcceptInviteScreen';
import {
  useTheme,
  type Theme,
  spacing,
  space,
  typography,
  NAVIGATION_HEADER_TOOLBAR,
  NAVIGATION_HEADER_CHROME_PAD,
  navigationStickyChromeHeight,
  navigationFooterChromeHeight,
  navigationTitleTextStyle,
  navigationSubtitleTextStyle,
} from '../../theme';
import { useResolvedScheme } from '../../lib/useResolvedScheme';
import type { MainStackParamList } from '../../navigation/types';
import { useEffectiveTier } from '../../subscription/useEffectiveTier';
import { featureUnlocked } from '../../subscription/featureTierConfig';
import type { FeatureId } from '../../subscription/featureTierConfig';
import { Icon, type IconName } from '../../components/Icon';
import { Collapsible, DisclosureChevron } from '../../components/Collapsible';
import { useTasks } from '../tasks/hooks/useTasks';
import { useCalendarEvents } from '../calendar/hooks/useCalendarEvents';
import { useCheckIns } from '../checkins/hooks/useCheckIns';
import {
  useMedications, useTodayMedLogs,
  parseMedicationSchedule,
  computeDoseStatusForDate,
  scheduledDoseSlotsForDate,
  takenDoseSlotsForDate,
} from '../medications/hooks/useMedications';
import { useHealthLogs } from '../health/hooks/useHealthLogs';
import { useReduceMotion } from '../../navigation/useReduceMotion';
import type { Family } from '../../types';

/** Scroll (px) at which the frosted nav bar begins sliding in; fully docked at end. */
const STICKY_REVEAL_START = 10;
const STICKY_REVEAL_END = 72;
/** Distance from scroll bottom (px) across which the footer frosted wash fades in (layout-aware). */
const FOOTER_CHROME_FADE_RANGE = 72;
/** Tall band at top of scroll content for accent wash + parallax “left behind” on scroll. */
const TOP_PAGE_GRADIENT_HEIGHT = 520;
/** Max extra height / negative top when rubber-banding (y < 0) so the wash still fills above. */
const TOP_GRADIENT_OVERSCROLL_MAX = 360;
const TOP_PAGE_GRADIENT_LOCATIONS = [0, 0.06, 0.16, 0.3, 0.52, 0.78, 1] as const;

const ONBOARDING_TO_DASHBOARD_MS = 260;
const ONBOARDING_TO_DASHBOARD_REDUCED_MS = 140;
const ONBOARDING_TO_DASHBOARD_TRANSLATE_Y = 8;

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type SectionView =
  | 'members' | 'tasks' | 'calendar'
  | 'medications' | 'health' | 'documents' | 'checkins' | 'visitprep' | 'doctors' | 'settings' | 'notes';

/** Soft gate on Home: navigate to paywall instead of premium areas. */
const SECTION_PREMIUM_FEATURE: Partial<Record<SectionView, FeatureId>> = {
  visitprep: 'ai_visit_prep',
  documents: 'document_vault',
};

const SECTION_TO_ROUTE: Record<SectionView, keyof MainStackParamList> = {
  tasks: 'Tasks',
  calendar: 'Calendar',
  visitprep: 'VisitPrep',
  doctors: 'Doctors',
  medications: 'Medications',
  health: 'Health',
  documents: 'Documents',
  checkins: 'CheckIns',
  members: 'Members',
  settings: 'Settings',
  notes: 'Notes',
};

const NAV_KEYS: Array<{ key: SectionView; icon: IconName }> = [
  { key: 'tasks', icon: 'tasks' },
  { key: 'calendar', icon: 'calendar' },
  { key: 'visitprep', icon: 'visitprep' },
  { key: 'doctors', icon: 'doctor' },
  { key: 'medications', icon: 'medications' },
  { key: 'health', icon: 'health' },
  { key: 'checkins', icon: 'checkin' },
  { key: 'documents', icon: 'documents' },
  { key: 'notes', icon: 'notes' },
  { key: 'members', icon: 'members' },
];

function NeedsAttentionSection({ onNavigate }: { onNavigate: (v: SectionView) => void }) {
  const t = useTheme();
  const { t: tx } = useTranslation();
  const styles = makeStyles(t);
  const family = useFamilyStore((s) => s.family);
  const { data: tasks } = useTasks(family?.id ?? null);
  const { data: medications } = useMedications();
  const { data: todayLogs = {} } = useTodayMedLogs();
  const { data: checkins } = useCheckIns();
  const { data: events } = useCalendarEvents();
  const { data: healthLogs } = useHealthLogs();

  const now = new Date();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const overdueTasks = (tasks ?? []).filter(
    (task) => !task.completed && task.due_date && new Date(task.due_date) < now
  );
  const trackedMeds = (medications ?? []).filter(
    (m) => parseMedicationSchedule(m).periodType !== 'as_needed'
  );
  const pendingMeds = trackedMeds.filter(
    (m) => computeDoseStatusForDate(m, todayLogs[m.id], todayStart) !== 'taken'
  );
  const medDosesRemaining = trackedMeds.reduce((sum, m) => {
    const total = scheduledDoseSlotsForDate(m, todayStart);
    const done = takenDoseSlotsForDate(m, todayLogs[m.id], todayStart);
    return sum + Math.max(0, total - done);
  }, 0);
  const checkinToday = (checkins ?? []).find((c) => new Date(c.created_at) >= todayStart);
  const todayEvents = (events ?? []).filter((e) => {
    const d = new Date(e.starts_at);
    return d >= todayStart && d <= todayEnd;
  });
  const healthLogToday = (healthLogs ?? []).find((log) => new Date(log.logged_at) >= todayStart);

  const items: Array<{ label: string; target: SectionView; color: string; icon: IconName }> = [];
  if (overdueTasks.length > 0) {
    items.push({
      label: tx('home.attention.overdueTasks', { count: overdueTasks.length }),
      target: 'tasks',
      color: t.error,
      icon: 'warning',
    });
  }
  if (medDosesRemaining > 0) {
    items.push({
      label: tx('home.attention.medDoses', { count: medDosesRemaining }),
      target: 'medications',
      color: t.warning,
      icon: 'medications',
    });
  }
  if (todayEvents.length > 0) {
    const title = todayEvents[0].title;
    const extra = todayEvents.length - 1;
    const label =
      extra > 0 ? tx('home.attention.eventsMulti', { title, extra }) : tx('home.attention.eventsSingle', { title });
    items.push({ label, target: 'calendar', color: t.accent, icon: 'calendar' });
  }
  if (!checkinToday) items.push({ label: tx('home.attention.checkIn'), target: 'checkins', color: t.textTertiary, icon: 'checkin' });
  if (!healthLogToday) items.push({ label: tx('home.attention.healthLog'), target: 'health', color: t.textTertiary, icon: 'health' });

  if (items.length === 0) {
    return (
      <View style={styles.allClearCard}>
        <Icon name="checkCircle" size={22} color={t.success} style={{ width: 32, textAlign: 'center' } as object} />
        <View style={{ flex: 1 }}>
          <Text style={styles.allClearTitle}>{tx('home.allClearTitle')}</Text>
          <Text style={styles.allClearSub}>{tx('home.allClearSub')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.attentionCard}>
      {items.map((item, i) => (
        <View key={item.target}>
          {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginLeft: space[4] }} />}
          <TouchableOpacity style={styles.attentionRow} onPress={() => onNavigate(item.target)} activeOpacity={0.7}>
            <View style={styles.attentionIconWrap}>
              <Icon name={item.icon} size={18} color={item.color} />
            </View>
            <Text style={[styles.attentionLabel, { color: item.color }]}>{item.label}</Text>
            <Icon name="chevron" size={18} color={t.borderLight} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

type HomeDashboardProps = {
  activeFamily: Family;
  onNavigateSection: (view: SectionView) => void;
};

function HomeDashboard({ activeFamily, onNavigateSection }: HomeDashboardProps) {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const { t: tx } = useTranslation();
  const styles = makeStyles(t);
  const resolvedScheme = useResolvedScheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showAllSections, setShowAllSections] = useState(true);

  const scrollY = useRef(new Animated.Value(0)).current;
  /** Fades blur + bottom wash only; updated from scroll `listener` (not a pure fn of `scrollY`). */
  const footerChromeOpacity = useRef(new Animated.Value(1)).current;

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const maxOffset = Math.max(0, contentSize.height - layoutMeasurement.height);
          if (maxOffset < 1) {
            footerChromeOpacity.setValue(1);
            return;
          }
          const distanceFromBottom = maxOffset - contentOffset.y;
          const d = Math.max(0, distanceFromBottom);
          const op = Math.min(1, d / FOOTER_CHROME_FADE_RANGE);
          footerChromeOpacity.setValue(op);
        },
      }),
    [scrollY, footerChromeOpacity],
  );

  /** Long vertical fade ending in solid page bg so the wash never “cuts off” mid-scroll. */
  const topPageGradientColors = useMemo((): readonly [string, string, string, string, string, string, string] => {
    if (resolvedScheme === 'dark') {
      // Layered neutrals + soft accent (dark-only): reads as depth on hand-tuned surfaces, not a flat color invert.
      return [
        hexToRgba(t.accent, 0.26),
        hexToRgba(t.surface, 0.55),
        hexToRgba(t.surfaceDim, 0.62),
        hexToRgba(t.surfaceAlt, 0.35),
        hexToRgba(t.bg, 0.78),
        hexToRgba(t.bg, 0.94),
        t.bg,
      ];
    }
    return [
      hexToRgba(t.accent, 0.42),
      hexToRgba(t.accent, 0.22),
      hexToRgba(t.accent, 0.1),
      hexToRgba(t.accent, 0.04),
      hexToRgba(t.bg, 0.58),
      hexToRgba(t.bg, 0.9),
      t.bg,
    ];
  }, [resolvedScheme, t.accent, t.bg]);

  const stickyHeaderHeight = navigationStickyChromeHeight(insets.top);

  const stickyHeaderOpacity = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, STICKY_REVEAL_START, STICKY_REVEAL_END],
        outputRange: [0, 0.2, 1],
        extrapolate: 'clamp',
      }),
    [scrollY],
  );

  /** Overscroll hero scale — native-driven from scrollY (no per-frame JS listener). */
  const heroOverscrollScale = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [-120, 0, 1],
        outputRange: [1.04, 1, 1],
        extrapolate: 'clamp',
      }),
    [scrollY],
  );

  /**
   * Top wash: only transform + opacity (native driver). Overscroll fill uses a static tall band
   * (`scrollTopGradientBase` negative top), not animated layout.
   */
  const scrollTopGradientMotion = useMemo(
    () => ({
      opacity: scrollY.interpolate({
        inputRange: [0, 110, 280],
        outputRange: [1, 0.4, 0.08],
        extrapolate: 'clamp',
      }),
      transform: [
        {
          translateY: scrollY.interpolate({
            inputRange: [-1, 0, 340],
            outputRange: [0, 0, 110],
            extrapolate: 'clamp',
          }),
        },
      ],
    }),
    [scrollY],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }, [queryClient]);

  const footerBarHeight = navigationFooterChromeHeight(insets.bottom);
  const scrollPaddingBottom = homeFooterScrollPaddingBottom(insets.bottom);

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        style={styles.scrollFill}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={1}
        onScroll={onScroll}
        removeClippedSubviews={false}
        bounces
        {...(Platform.OS === 'android' ? { overScrollMode: 'always' as const } : {})}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPaddingBottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={t.accent} />}
      >
        <View style={styles.scrollStack}>
          <Animated.View
            style={[styles.scrollTopGradientBase, scrollTopGradientMotion]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={topPageGradientColors}
              locations={[...TOP_PAGE_GRADIENT_LOCATIONS]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>

          <View style={styles.scrollForeground}>
            {/* Top “hero” is page content — scrolls with list; frosted bar fades in separately. */}
            <Animated.View style={{ transform: [{ scale: heroOverscrollScale }] }}>
              <View style={[styles.scrollHeroSection, { paddingTop: insets.top + spacing.md }]}>
                <View style={styles.scrollHeroTopRow}>
                  <View style={styles.scrollHeroTextCol}>
                    <View style={styles.heroMeasureWrap}>
                      <Text style={styles.familyName} numberOfLines={2}>
                        {activeFamily.name}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => onNavigateSection('settings')}
                    style={({ pressed }) => [styles.settingsBtn, pressed && styles.settingsBtnPressed]}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={tx('home.a11ySettings')}
                    android_ripple={{ color: t.border, borderless: true }}
                  >
                    <Icon name="settings" size={20} color={t.textSecondary} />
                  </Pressable>
                </View>
                <Text style={styles.recipientScroll} numberOfLines={1}>
                  {tx('home.caringFor', { name: activeFamily.care_recipient_name })}
                </Text>
              </View>
            </Animated.View>

            <DashboardSummary onNavigate={(v) => onNavigateSection(v as SectionView)} />

            <Text style={[styles.sectionLabel, styles.sectionHeaderNeedsAttention]}>{tx('home.needsAttention')}</Text>
            <NeedsAttentionSection onNavigate={onNavigateSection} />

            <TouchableOpacity
              style={styles.browseAllBtn}
              onPress={() => setShowAllSections((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.browseAllText}>
                {showAllSections ? tx('home.browseHide') : tx('home.browseShow')}
              </Text>
              <DisclosureChevron expanded={showAllSections} color={t.textTertiary} size={14} />
            </TouchableOpacity>

            <Collapsible expanded={showAllSections}>
              <View style={styles.navGrid}>
                {NAV_KEYS.map(({ key, icon }) => (
                  <TouchableOpacity key={key} style={styles.navCard} onPress={() => onNavigateSection(key)} activeOpacity={0.7}>
                    <View style={styles.navIconWrap}>
                      <Icon name={icon} size={22} color={t.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.navLabel}>{tx(`home.nav.${key}.label`)}</Text>
                      <Text style={styles.navDesc}>{tx(`home.nav.${key}.desc`)}</Text>
                    </View>
                    <Icon name="chevron" size={18} color={t.borderLight} />
                  </TouchableOpacity>
                ))}
              </View>
            </Collapsible>
          </View>
        </View>
      </Animated.ScrollView>

      {/* Frosted nav: hidden at rest, fades in over content as user scrolls. */}
      <Animated.View
        style={[
          styles.stickyChrome,
          {
            height: stickyHeaderHeight,
            opacity: stickyHeaderOpacity,
          },
        ]}
        pointerEvents="box-none"
      >
        <HeaderFrostedBackdrop />
        <View
          style={[styles.stickyInner, { paddingTop: insets.top + NAVIGATION_HEADER_CHROME_PAD }]}
          pointerEvents="box-none"
        >
          <View style={styles.stickyTitleRow}>
            <View style={{ width: NAVIGATION_HEADER_TOOLBAR }} />
            <View style={styles.stickyTitleMeasure}>
              <Text style={styles.stickyTitle} numberOfLines={1}>
                {activeFamily.name}
              </Text>
            </View>
            <Pressable
              onPress={() => onNavigateSection('settings')}
              style={({ pressed }) => [styles.settingsBtn, pressed && styles.settingsBtnPressed]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={tx('home.a11ySettings')}
              android_ripple={{ color: t.border, borderless: true }}
            >
              <Icon name="settings" size={20} color={t.textSecondary} />
            </Pressable>
          </View>
        </View>
      </Animated.View>

      <BlurredFooterChrome
        chromeOpacity={footerChromeOpacity}
        barHeight={footerBarHeight}
        borderColor={t.border}
        insetBottom={insets.bottom}
      >
        <Pressable
          onPress={() => onNavigateSection('members')}
          style={({ pressed }) => [styles.settingsBtn, pressed && styles.settingsBtnPressed]}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={tx('home.a11yMembers')}
          android_ripple={{ color: t.border, borderless: true }}
        >
          <Icon name="members" size={22} color={t.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => onNavigateSection('documents')}
          style={({ pressed }) => [styles.settingsBtn, pressed && styles.settingsBtnPressed]}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={tx('home.a11yDocuments')}
          android_ripple={{ color: t.border, borderless: true }}
        >
          <Icon name="documents" size={22} color={t.textSecondary} />
        </Pressable>
      </BlurredFooterChrome>
    </View>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { data: effectiveTier = 'free' } = useEffectiveTier();
  const { isLoading } = useFamily();
  const user = useAuthStore((s) => s.user);
  const family = useFamilyStore((s) => s.family);
  const reduceMotion = useReduceMotion();
  const [noFamilyMode, setNoFamilyMode] = useState<'join' | 'create'>('join');

  useEffect(() => {
    if (isLoading || !user) return;
    let cancelled = false;
    void (async () => {
      const intent = await consumePendingPostAuthIntent();
      if (cancelled) return;
      if (!family && intent === 'join_family') setNoFamilyMode('join');
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading, user, family]);
  const t = useTheme();
  const styles = makeStyles(t);

  const navigateToTarget = useCallback(
    (target: keyof MainStackParamList) => {
      switch (target) {
        case 'Tasks': navigation.navigate('Tasks'); break;
        case 'Calendar': navigation.navigate('Calendar'); break;
        case 'VisitPrep': navigation.navigate('VisitPrep'); break;
        case 'Doctors': navigation.navigate('Doctors'); break;
        case 'Medications': navigation.navigate('Medications'); break;
        case 'Health': navigation.navigate('Health'); break;
        case 'Documents': navigation.navigate('Documents'); break;
        case 'CheckIns': navigation.navigate('CheckIns'); break;
        case 'Members': navigation.navigate('Members'); break;
        case 'Settings': navigation.navigate('Settings'); break;
        case 'Notes': navigation.navigate('Notes'); break;
        default: break;
      }
    },
    [navigation],
  );

  const navToSection = useCallback(
    (view: SectionView) => {
      const fid = SECTION_PREMIUM_FEATURE[view];
      if (fid && !featureUnlocked(effectiveTier, fid)) {
        navigation.navigate('Subscription', { featureId: fid });
        return;
      }
      const target = SECTION_TO_ROUTE[view];
      navigateToTarget(target);
    },
    [navigateToTarget, effectiveTier, navigation],
  );

  const [homePhase, setHomePhase] = useState<'onboarding' | 'transitioning' | 'dashboard'>(() => (family ? 'dashboard' : 'onboarding'));
  const onboardingOpacity = useRef(new Animated.Value(family ? 0 : 1)).current;
  const onboardingTranslateY = useRef(new Animated.Value(0)).current;
  const dashboardOpacity = useRef(new Animated.Value(family ? 1 : 0)).current;
  const dashboardTranslateY = useRef(
    new Animated.Value(
      family ? 0 : reduceMotion ? 0 : -ONBOARDING_TO_DASHBOARD_TRANSLATE_Y,
    ),
  ).current;

  useEffect(() => {
    if (!family) {
      setHomePhase('onboarding');
      onboardingOpacity.setValue(1);
      onboardingTranslateY.setValue(0);
      dashboardOpacity.setValue(0);
      dashboardTranslateY.setValue(reduceMotion ? 0 : -ONBOARDING_TO_DASHBOARD_TRANSLATE_Y);
      return;
    }

    if (homePhase !== 'onboarding') return;
    setHomePhase('transitioning');

    const duration = reduceMotion ? ONBOARDING_TO_DASHBOARD_REDUCED_MS : ONBOARDING_TO_DASHBOARD_MS;
    const easing = Easing.out(Easing.cubic);

    const anims: Animated.CompositeAnimation[] = [
      Animated.timing(onboardingOpacity, { toValue: 0, duration, easing, useNativeDriver: true }),
      Animated.timing(dashboardOpacity, { toValue: 1, duration, easing, useNativeDriver: true }),
    ];

    if (!reduceMotion) {
      anims.push(
        Animated.timing(onboardingTranslateY, { toValue: ONBOARDING_TO_DASHBOARD_TRANSLATE_Y, duration, easing, useNativeDriver: true }),
        Animated.timing(dashboardTranslateY, { toValue: 0, duration, easing, useNativeDriver: true }),
      );
    }

    Animated.parallel(anims).start(({ finished }) => {
      if (!finished) return;
      setHomePhase('dashboard');
    });
  }, [
    family,
    homePhase,
    reduceMotion,
    onboardingOpacity,
    onboardingTranslateY,
    dashboardOpacity,
    dashboardTranslateY,
  ]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={t.accent} />
      </View>
    );
  }

  const onboarding = (
    <View style={styles.noFamilyContainer}>
      {noFamilyMode === 'join' ? (
        <AcceptInviteScreen
          footerAction={{
            label: 'Starting fresh? Create new',
            onPress: () => setNoFamilyMode('create'),
          }}
        />
      ) : (
        <CreateFamilyScreen
          footerAction={{
            label: 'Have an invite code? Join your family',
            onPress: () => setNoFamilyMode('join'),
          }}
        />
      )}
    </View>
  );

  const dashboardContent = family ? (
    <HomeDashboard activeFamily={family} onNavigateSection={navToSection} />
  ) : null;

  if (!family && homePhase === 'onboarding') return onboarding;

  return (
    <View style={styles.root}>
      {homePhase !== 'dashboard' ? (
        <Animated.View
          style={[
            styles.fill,
            {
              opacity: onboardingOpacity,
              transform: [{ translateY: onboardingTranslateY }],
            },
          ]}
        >
          {onboarding}
        </Animated.View>
      ) : null}

      <Animated.View
        pointerEvents={homePhase === 'dashboard' ? 'auto' : 'none'}
        style={[
          styles.fill,
          {
            opacity: dashboardOpacity,
            transform: [{ translateY: dashboardTranslateY }],
          },
        ]}
      >
        {dashboardContent}
      </Animated.View>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    fill: { ...StyleSheet.absoluteFillObject },
    centered: { flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' },
    noFamilyContainer: { flex: 1, backgroundColor: t.bg },
    container: { flex: 1, backgroundColor: t.bg, overflow: 'hidden' },
    scrollFill: { flex: 1 },
    scrollStack: {
      position: 'relative',
      backgroundColor: t.bg,
    },
    scrollForeground: {
      position: 'relative',
      zIndex: 1,
      paddingHorizontal: spacing.lg,
    },
    scrollTopGradientBase: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: -TOP_GRADIENT_OVERSCROLL_MAX,
      height: TOP_PAGE_GRADIENT_HEIGHT + TOP_GRADIENT_OVERSCROLL_MAX,
      zIndex: 0,
    },
    scrollHeroSection: {
      backgroundColor: 'transparent',
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
    },
    scrollHeroTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.md,
      minHeight: NAVIGATION_HEADER_TOOLBAR,
    },
    scrollHeroTextCol: {
      flex: 1,
      minWidth: 0,
      paddingRight: spacing.xs,
      justifyContent: 'center',
      minHeight: NAVIGATION_HEADER_TOOLBAR,
    },
    heroMeasureWrap: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
    },
    recipientScroll: {
      ...navigationSubtitleTextStyle(t),
      marginTop: spacing.xs,
    },
    stickyChrome: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 20,
      ...Platform.select({
        android: { elevation: 16 },
        default: {},
      }),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
    },
    stickyInner: {
      ...StyleSheet.absoluteFillObject,
      paddingHorizontal: spacing.xl,
      paddingBottom: NAVIGATION_HEADER_CHROME_PAD,
    },
    stickyTitleRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: NAVIGATION_HEADER_TOOLBAR,
    },
    stickyTitleMeasure: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stickyTitle: {
      ...navigationTitleTextStyle(t),
      width: '100%',
      textAlign: 'center',
    },
    familyName: {
      ...typography.title,
      fontSize: 24,
      lineHeight: 29,
      letterSpacing: Platform.OS === 'ios' ? -0.35 : -0.22,
      color: t.text,
    },
    settingsBtn: {
      width: NAVIGATION_HEADER_TOOLBAR,
      height: NAVIGATION_HEADER_TOOLBAR,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingsBtnPressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
    scrollContent: { gap: space[3] },
    sectionLabel: {
      ...typography.overline,
      color: t.textTertiary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    sectionHeaderNeedsAttention: { marginTop: spacing.lg, marginBottom: spacing.xs },
    navGrid: { gap: space[2] },
    navCard: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface,
      borderRadius: 14, paddingHorizontal: space[4], paddingVertical: space[4], gap: space[3],
      shadowColor: t.shadow, shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    },
    navIconWrap: {
      width: space[5] + space[3], height: space[5] + space[3], borderRadius: 10,
      backgroundColor: t.accentLight, alignItems: 'center', justifyContent: 'center',
    },
    navLabel: { ...typography.bodyBold, color: t.text },
    navDesc: { ...typography.footnote, color: t.textTertiary, marginTop: 1 },
    allClearCard: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface,
      borderRadius: 14, padding: space[4], gap: space[3],
      shadowColor: t.shadow, shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    },
    allClearTitle: { ...typography.bodyBold, color: t.success },
    allClearSub: { ...typography.caption, color: t.textTertiary, marginTop: 2 },
    attentionCard: {
      backgroundColor: t.surface, borderRadius: 14, overflow: 'hidden',
      shadowColor: t.shadow, shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    },
    attentionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[4], paddingVertical: space[3] + space[1], gap: space[3] },
    attentionIconWrap: { width: space[5], alignItems: 'center' },
    attentionLabel: { flex: 1, ...typography.callout, color: t.text },
    browseAllBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: space[3], gap: space[2],
    },
    browseAllText: { ...typography.caption, color: t.textTertiary, fontWeight: '500' },
  });
}
