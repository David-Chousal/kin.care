import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { Sentry } from '../lib/sentry';
import { useTheme, spacing, radius, typography, type Theme } from '../theme';
import type { MainStackParamList } from '../navigation/types';
import { useEffectiveTier, useInvalidateEffectiveTier } from './useEffectiveTier';
import type { EffectiveTier } from './types';
import { TIER_DISPLAY_NAME } from './featureTierConfig';
import { FEATURE_TIER } from './featureTierConfig';
import { initRevenueCatIfNeeded, isPurchasesConfigured, syncRevenueCatUser } from '../lib/revenueCat';
import { useAuthStore } from '../store/auth';
import { messageFromRevenueCatError } from './revenueCatUiErrors';
import { IOS_APP_SEARCH_URL, PLAY_STORE_URL } from './storeLinks';
type Nav = NativeStackNavigationProp<MainStackParamList, 'Subscription'>;
type RRoute = RouteProp<MainStackParamList, 'Subscription'>;

function tierLabel(tier: EffectiveTier): string {
  return TIER_DISPLAY_NAME[tier];
}

function inferPackageTier(pkg: PurchasesPackage): 'family' | 'care_team' | 'unknown' {
  const blob = `${pkg.identifier} ${String(pkg.packageType)} ${pkg.product.identifier} ${pkg.product.title}`
    .toLowerCase();
  if (blob.includes('care')) return 'care_team';
  if (blob.includes('family')) return 'family';
  return 'unknown';
}

function billingPeriodLabel(pkg: PurchasesPackage): string {
  // RevenueCat packageType is the most reliable signal for cadence (vs. parsing title).
  switch (pkg.packageType) {
    case 'MONTHLY':
      return 'Billed monthly';
    case 'ANNUAL':
      return 'Billed annually';
    case 'WEEKLY':
      return 'Billed weekly';
    case 'TWO_MONTH':
      return 'Billed every 2 months';
    case 'THREE_MONTH':
      return 'Billed every 3 months';
    case 'SIX_MONTH':
      return 'Billed every 6 months';
    case 'LIFETIME':
      return 'One-time purchase';
    default: {
      const blob = `${pkg.identifier} ${String(pkg.packageType)} ${pkg.product.identifier} ${pkg.product.title}`
        .toLowerCase();
      if (blob.includes('annual') || blob.includes('year')) return 'Billed annually';
      if (blob.includes('month')) return 'Billed monthly';
      if (blob.includes('week')) return 'Billed weekly';
      // Never silently drop the label; if RevenueCat introduces a new package type,
      // show a generic fallback rather than rendering nothing.
      return 'Billing period unavailable';
    }
  }
}

export function SubscriptionScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const { t: tx } = useTranslation();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RRoute>();
  const featureId = route.params?.featureId;
  const userId = useAuthStore((s) => s.user?.id);

  const { data: tier, isPending: tierLoading, isError: tierError, error: tierErr, refetch } = useEffectiveTier();
  const invalidateTier = useInvalidateEffectiveTier();

  const [refreshing, setRefreshing] = useState(false);
  const [offeringsLoading, setOfferingsLoading] = useState(Platform.OS !== 'web');
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tierSyncPolling, setTierSyncPolling] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resolvedTier: EffectiveTier = tier ?? 'free';

  const featureHint = useMemo(() => {
    if (!featureId) return null;
    return FEATURE_TIER[featureId];
  }, [featureId]);

  useFocusEffect(
    useCallback(() => {
      Sentry.addBreadcrumb({
        category: 'subscription',
        message: 'paywall_screen',
        level: 'info',
        data: { featureId: featureId ?? null },
      });
    }, [featureId]),
  );

  useEffect(() => {
    navigation.setOptions({ title: 'Subscription' });
  }, [navigation]);

  const loadOfferings = useCallback(async () => {
    if (Platform.OS === 'web') {
      setOfferingsLoading(false);
      setPackages([]);
      return;
    }
    setOfferingsError(null);
    setOfferingsLoading(true);
    try {
      await initRevenueCatIfNeeded();
      await syncRevenueCatUser(userId ?? null);
      if (!isPurchasesConfigured()) {
        setOfferingsError(
          __DEV__
            ? 'RevenueCat is not configured. Set EXPO_PUBLIC_RC_API_KEY_IOS (or ANDROID), rebuild the dev client, then try again.'
            : 'Subscriptions are not available in this build.',
        );
        return;
      }
      const off = await Purchases.getOfferings();
      const current = off.current;
      const pkgs = current?.availablePackages ?? [];
      setPackages(pkgs);
      if (!current && __DEV__) {
        setOfferingsError(
          'No current offering in RevenueCat. Check the dashboard (Offerings → set current).',
        );
      }
    } catch (e) {
      const m = messageFromRevenueCatError(e);
      setOfferingsError(m.body);
      Sentry.captureException(e);
    } finally {
      setOfferingsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadOfferings();
  }, [loadOfferings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), loadOfferings()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, loadOfferings]);

  const pollAfterPurchase = useCallback(async () => {
    if (Platform.OS === 'web') return;
    setTierSyncPolling(true);
    const started = Date.now();
    const maxMs = 45_000;
    try {
      while (Date.now() - started < maxMs) {
        await new Promise((r) => setTimeout(r, 2000));
        const { data } = await refetch();
        if (data && data !== 'free') return;
      }
    } finally {
      if (mountedRef.current) setTierSyncPolling(false);
    }
  }, [refetch]);

  async function handlePurchase(pkg: PurchasesPackage) {
    if (Platform.OS === 'web') return;
    setBusyId(pkg.identifier);
    try {
      await initRevenueCatIfNeeded();
      await syncRevenueCatUser(userId ?? null);
      if (!isPurchasesConfigured()) {
        Alert.alert(
          'Subscriptions unavailable',
          __DEV__
            ? 'Set EXPO_PUBLIC_RC_API_KEY_IOS (or ANDROID) and rebuild before purchasing.'
            : 'Please try again later.',
        );
        return;
      }
      await Purchases.purchasePackage(pkg);
      Sentry.addBreadcrumb({ category: 'subscription', message: 'purchase_success', level: 'info' });
      await invalidateTier();
      await refetch();
      Alert.alert(
        'Purchase complete',
        'Your plan may take a minute to appear while the store confirms the subscription. Pull to refresh if you are still on Core.',
        [
          { text: 'OK', style: 'default' },
          { text: 'Refresh status', onPress: () => void onRefresh() },
        ],
      );
      void pollAfterPurchase();
    } catch (e) {
      Sentry.addBreadcrumb({
        category: 'subscription',
        message: 'purchase_failed',
        level: 'warning',
        data: { code: (e as { code?: string })?.code },
      });
      const m = messageFromRevenueCatError(e);
      Alert.alert(m.title, m.body);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRestore() {
    if (Platform.OS === 'web') return;
    setBusyId('restore');
    try {
      await initRevenueCatIfNeeded();
      await syncRevenueCatUser(userId ?? null);
      if (!isPurchasesConfigured()) {
        Alert.alert(
          'Subscriptions unavailable',
          __DEV__
            ? 'Set EXPO_PUBLIC_RC_API_KEY_IOS (or ANDROID) and rebuild before restoring purchases.'
            : 'Please try again later.',
        );
        return;
      }
      await Purchases.restorePurchases();
      await invalidateTier();
      await refetch();
      Alert.alert('Restored', 'If you had an active subscription, it can take a moment to sync. Pull to refresh.');
      void pollAfterPurchase();
    } catch (e) {
      const m = messageFromRevenueCatError(e);
      Alert.alert(m.title, m.body);
    } finally {
      setBusyId(null);
    }
  }

  const grouped = useMemo(() => {
    const family: PurchasesPackage[] = [];
    const care: PurchasesPackage[] = [];
    const rest: PurchasesPackage[] = [];
    for (const p of packages) {
      const g = inferPackageTier(p);
      if (g === 'family') family.push(p);
      else if (g === 'care_team') care.push(p);
      else rest.push(p);
    }
    return { family, care, rest };
  }, [packages]);

  const webBody = (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Subscribe on iPhone or Android</Text>
      <Text style={styles.p}>
        In-app purchases are not available in the web browser. Install Kin on your phone, sign in with the same
        account, and choose a plan there.
      </Text>
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => Linking.openURL(IOS_APP_SEARCH_URL)}>
        <Text style={styles.secondaryBtnText}>App Store (search)</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 10 }]} onPress={() => Linking.openURL(PLAY_STORE_URL)}>
        <Text style={styles.secondaryBtnText}>Google Play</Text>
      </TouchableOpacity>
    </View>
  );

  const nativePlans = (
    <>
      {offeringsLoading ? (
        <ActivityIndicator style={{ marginVertical: 24 }} color={t.accent} />
      ) : offeringsError ? (
        <View style={styles.card}>
          <Text style={styles.warnTitle}>{__DEV__ ? 'Offerings (dev)' : 'Plans unavailable'}</Text>
          <Text style={styles.p}>{offeringsError}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => void loadOfferings()}>
            <Text style={styles.secondaryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!offeringsLoading && packages.length === 0 && !offeringsError ? (
        <View style={styles.card}>
          <Text style={styles.p}>
            No subscription products are configured yet. When RevenueCat offerings are ready, Family and Care Team
            prices will show here automatically.
          </Text>
          <Text style={styles.caption}>Expected packages: identifiers or titles containing “family” or “care”.</Text>
        </View>
      ) : null}

      {['family', 'care_team'].map((slot) => {
        const tierKey = slot as 'family' | 'care_team';
        const list = tierKey === 'family' ? grouped.family : grouped.care;
        const title = tierKey === 'family' ? 'Family' : 'Care Team';
        if (list.length === 0) return null;
        return (
          <View key={slot} style={styles.card}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.caption}>{tx(`subscription.tierFeatureCaption.${tierKey}`)}</Text>
            {list.map((pkg) => (
              <TouchableOpacity
                key={pkg.identifier}
                style={[styles.primaryBtn, (busyId || tierSyncPolling) && { opacity: 0.6 }]}
                disabled={!!busyId || tierSyncPolling}
                onPress={() => void handlePurchase(pkg)}
              >
                {busyId === pkg.identifier ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.planBtnLabel}>
                    <Text style={styles.planBtnTitle}>{pkg.product.title}</Text>
                    <Text style={styles.planBtnBilling}>{billingPeriodLabel(pkg)}</Text>
                    <Text style={styles.planBtnPrice}>{pkg.product.priceString}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        );
      })}

      {grouped.rest.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Other plans</Text>
          {grouped.rest.map((pkg) => (
            <TouchableOpacity
              key={pkg.identifier}
              style={[
                styles.primaryBtn,
                { backgroundColor: t.textSecondary },
                (busyId || tierSyncPolling) && { opacity: 0.6 },
              ]}
              disabled={!!busyId || tierSyncPolling}
              onPress={() => void handlePurchase(pkg)}
            >
              {busyId === pkg.identifier ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.planBtnLabel}>
                  <Text style={styles.planBtnTitle}>{pkg.product.title}</Text>
                  <Text style={styles.planBtnBilling}>{billingPeriodLabel(pkg)}</Text>
                  <Text style={styles.planBtnPrice}>{pkg.product.priceString}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.secondaryBtn, { marginBottom: 24 }, tierSyncPolling && { opacity: 0.6 }]}
        disabled={busyId === 'restore' || tierSyncPolling}
        onPress={() => void handleRestore()}
      >
        {busyId === 'restore' ? (
          <ActivityIndicator color={t.accent} />
        ) : (
          <Text style={styles.secondaryBtnText}>Restore purchases</Text>
        )}
      </TouchableOpacity>
    </>
  );

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: t.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: headerHeight + spacing.md }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={t.accent} />}
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your plan</Text>
        {tierLoading ? (
          <ActivityIndicator color={t.accent} />
        ) : tierError ? (
          <Text style={styles.warn}>{tierErr instanceof Error ? tierErr.message : 'Could not load plan.'}</Text>
        ) : (
          <Text style={styles.planValue}>{tierLabel(resolvedTier)}</Text>
        )}
        <Text style={styles.caption}>
          Server status can lag the App Store by up to a minute after you subscribe. Pull to refresh to update.
        </Text>
      </View>

      {tierSyncPolling ? (
        <View style={styles.syncBanner} accessibilityRole="progressbar" accessibilityLabel="Updating subscription status">
          <ActivityIndicator color={t.accent} style={styles.syncSpinner} />
          <View style={styles.syncBannerTextWrap}>
            <Text style={styles.syncBannerTitle}>Updating your plan</Text>
            <Text style={styles.caption}>
              Checking for your subscription for up to 45 seconds. You can leave this screen; pull to refresh anytime.
            </Text>
          </View>
        </View>
      ) : null}

      {featureHint ? (
        <View style={[styles.card, { borderColor: t.accent, borderWidth: 1 }]}>
          <Text style={styles.cardTitle}>Why you are here</Text>
          <Text style={styles.p}>{featureHint.benefit}</Text>
        </View>
      ) : null}

      {resolvedTier !== 'free' && !tierLoading ? (
        <View style={styles.card}>
          <Text style={styles.p}>
            You are on <Text style={{ fontWeight: '700' }}>{tierLabel(resolvedTier)}</Text>.
            {resolvedTier === 'family'
              ? ' Upgrade to Care Team for pro-focused exports and priority support when those tools ship.'
              : ' Thank you for supporting Kin.'}
          </Text>
        </View>
      ) : null}

      {Platform.OS === 'web' ? webBody : nativePlans}

      <Text style={[styles.caption, { marginBottom: 32 }]}>
        Manage or cancel in the App Store or Google Play subscriptions settings. Kin does not process refunds in-app.
      </Text>
    </ScrollView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    screen: { flex: 1 },
    content: { paddingHorizontal: spacing.lg, paddingBottom: 48 },
    card: {
      backgroundColor: t.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      gap: spacing.sm,
    },
    cardTitle: { ...typography.heading, color: t.text },
    planValue: { ...typography.title, color: t.accent, marginTop: 4 },
    p: { ...typography.body, color: t.textSecondary },
    caption: { ...typography.caption, color: t.textTertiary },
    warn: { ...typography.body, color: t.error },
    warnTitle: { ...typography.subhead, color: t.error },
    primaryBtn: {
      marginTop: spacing.sm,
      backgroundColor: t.accent,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    planBtnLabel: {
      alignSelf: 'stretch',
      alignItems: 'center',
      gap: spacing.xs,
    },
    planBtnTitle: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
      width: '100%',
    },
    planBtnBilling: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      width: '100%',
    },
    planBtnPrice: {
      color: 'rgba(255,255,255,0.92)',
      fontSize: 15,
      fontWeight: '600',
      textAlign: 'center',
      width: '100%',
    },
    secondaryBtn: {
      marginTop: spacing.sm,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
    },
    secondaryBtnText: { color: t.accent, fontSize: 15, fontWeight: '600' },
    syncBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      backgroundColor: t.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
    },
    syncSpinner: { marginTop: 2 },
    syncBannerTextWrap: { flex: 1, gap: spacing.xs },
    syncBannerTitle: { ...typography.subhead, color: t.text, fontWeight: '600' },
  });
}
