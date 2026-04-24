import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Pressable,
  Alert,
  Modal,
  Share,
  Platform,
  InteractionManager,
  KeyboardAvoidingView,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { Toast } from '../../components/Toast';
import { useVisitPrep } from './useVisitPrep';
import { useDeleteVisitPrepSummary, useUpdateVisitPrepSummaryDisplayName } from './useVisitPrepMutations';
import { useFamilyStore } from '../../store/family';
import { useAuthStore } from '../../store/auth';
import { useMembers } from '../family/hooks/useMembers';
import { AiHealthDisclaimer } from '../../components/AiHealthDisclaimer';
import { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useHeaderHeight } from '@react-navigation/elements';
import { useReduceMotion } from '../../navigation/useReduceMotion';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme, spacing } from '../../theme';
import type { VisitPrepSummary } from '../../types';
import type { MainStackParamList } from '../../navigation/types';
import { useEffectiveTier } from '../../subscription/useEffectiveTier';
import { featureUnlocked } from '../../subscription/featureTierConfig';
import { FeatureLockedCallout } from '../../subscription/FeatureLockedCallout';
import { useFormatLocaleTag } from '../../i18n/useFormatLocaleTag';
import { renderMinimalMarkdown } from '../../lib/renderMinimalMarkdown';
import { Sentry } from '../../lib/sentry';

type MainTab = 'summary' | 'history';

function formatGeneratedLabel(iso: string, localeTag: string) {
  return new Date(iso).toLocaleDateString(localeTag, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function historyPreview(content: string) {
  const oneLine = content.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= 140) return oneLine;
  return `${oneLine.slice(0, 140)}…`;
}

/** Creator or family admin may delete or rename. */
function canEditVisitPrepSummary(
  item: VisitPrepSummary,
  userId: string | undefined,
  isFamilyAdmin: boolean
): boolean {
  return !!userId && (item.created_by === userId || isFamilyAdmin);
}

function historyTroubleshootHint(message: string, t: (key: string) => string): string | null {
  const m = message.toLowerCase();
  if (m.includes('schema cache') || m.includes('pgrst205') || m.includes('pgrst204')) {
    return t('visitPrep.troubleshoot.postgrest');
  }
  if (m.includes('does not exist') || m.includes('relation') || m.includes('42p01')) {
    return t('visitPrep.troubleshoot.missingRelation');
  }
  return null;
}

const SCREEN_W = Dimensions.get('window').width;

export function VisitPrepScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { data: tier = 'free' } = useEffectiveTier();
  const visitPrepLocked = !featureUnlocked(tier, 'ai_visit_prep');
  const headerHeight = useHeaderHeight();
  const reduceMotion = useReduceMotion();
  const family = useFamilyStore((s) => s.family);
  const user = useAuthStore((s) => s.user);
  const { data: members = [] } = useMembers(family?.id ?? '');
  const deleteSummary = useDeleteVisitPrepSummary();
  const updateDisplayName = useUpdateVisitPrepSummaryDisplayName();
  const isFamilyAdmin = members.some((m) => m.user_id === user?.id && m.role === 'admin');
  const {
    summary,
    summaryId,
    generatedAt,
    isLoading,
    error,
    subscriptionBlocked,
    persistError,
    generate,
    history,
    historyLoading,
    historyError,
    historyErrorMessage,
    historyIsFetching,
    refetchHistory,
  } = useVisitPrep();
  const { t } = useTranslation();
  const localeTag = useFormatLocaleTag();
  const visitPrepExportPrefixText = useCallback(() => {
    return [t('visitPrep.export.line1'), t('visitPrep.export.line2'), ''].join('\n');
  }, [t]);
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [mainTab, setMainTab] = useState<MainTab>('summary');
  const [historyDetail, setHistoryDetail] = useState<VisitPrepSummary | null>(null);
  const [summaryMenuItem, setSummaryMenuItem] = useState<VisitPrepSummary | null>(null);
  const [renameTarget, setRenameTarget] = useState<VisitPrepSummary | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const historyDetailRef = useRef<VisitPrepSummary | null>(null);
  historyDetailRef.current = historyDetail;

  const summaryOpacity = useRef(new Animated.Value(1)).current;
  const historyOpacity = useRef(new Animated.Value(0)).current;
  const detailTranslateX = useRef(new Animated.Value(SCREEN_W)).current;
  const lastAnimatedDetailId = useRef<string | null>(null);

  const tabFadeMs = reduceMotion ? 1 : 240;
  const detailSlideMs = reduceMotion ? 1 : 260;

  const runTabFade = useCallback(
    (target: MainTab) => {
      const toSummary = target === 'summary';
      Animated.parallel([
        Animated.timing(summaryOpacity, {
          toValue: toSummary ? 1 : 0,
          duration: tabFadeMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(historyOpacity, {
          toValue: toSummary ? 0 : 1,
          duration: tabFadeMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [tabFadeMs, summaryOpacity, historyOpacity]
  );

  const closeHistoryDetail = useCallback(() => {
    if (!historyDetailRef.current) return;
    if (reduceMotion) {
      setHistoryDetail(null);
      lastAnimatedDetailId.current = null;
      detailTranslateX.setValue(SCREEN_W);
      return;
    }
    Animated.timing(detailTranslateX, {
      toValue: SCREEN_W,
      duration: detailSlideMs,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setHistoryDetail(null);
        lastAnimatedDetailId.current = null;
      }
    });
  }, [reduceMotion, detailSlideMs, detailTranslateX]);

  function openHistoryDetail(item: VisitPrepSummary) {
    setHistoryDetail(item);
  }

  function goTab(next: MainTab) {
    if (next === mainTab) return;
    if (next === 'summary') {
      if (historyDetail) {
        if (reduceMotion) {
          setHistoryDetail(null);
          lastAnimatedDetailId.current = null;
          detailTranslateX.setValue(SCREEN_W);
          setMainTab('summary');
          runTabFade('summary');
        } else {
          Animated.timing(detailTranslateX, {
            toValue: SCREEN_W,
            duration: Math.min(detailSlideMs, 220),
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished) {
              setHistoryDetail(null);
              lastAnimatedDetailId.current = null;
              setMainTab('summary');
              runTabFade('summary');
            }
          });
        }
      } else {
        setMainTab('summary');
        runTabFade('summary');
      }
    } else {
      setMainTab('history');
      runTabFade('history');
    }
  }

  useLayoutEffect(() => {
    if (!historyDetail) {
      detailTranslateX.setValue(SCREEN_W);
      lastAnimatedDetailId.current = null;
      return;
    }
    const id = historyDetail.id;
    if (lastAnimatedDetailId.current === id) return;
    lastAnimatedDetailId.current = id;
    if (reduceMotion) {
      detailTranslateX.setValue(0);
      return;
    }
    detailTranslateX.setValue(SCREEN_W);
    Animated.spring(detailTranslateX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 9,
      tension: 68,
    }).start();
  }, [historyDetail, reduceMotion, detailTranslateX]);

  async function handleCopy(text: string) {
    if (!text) return;
    await Clipboard.setStringAsync(visitPrepExportPrefixText() + text);
    setToast({ visible: true, message: t('visitPrep.toastCopied') });
  }

  function closeSummaryMenu() {
    setSummaryMenuItem(null);
  }

  function confirmDeleteSummary(item: VisitPrepSummary) {
    Alert.alert(
      t('visitPrep.deleteConfirmTitle'),
      t('visitPrep.deleteConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('visitPrep.delete'),
          style: 'destructive',
          onPress: () => {
            deleteSummary.mutate(item.id, {
              onSuccess: () => {
                if (historyDetailRef.current?.id === item.id) closeHistoryDetail();
                setToast({ visible: true, message: t('visitPrep.toastSummaryDeleted') });
              },
              onError: (e) => {
                Alert.alert(t('visitPrep.couldNotDelete'), e instanceof Error ? e.message : t('visitPrep.unknownError'));
              },
            });
          },
        },
      ]
    );
  }

  /** Run after the options modal is gone so UIActivityViewController can present (iOS Simulator often swallows Share if fired during modal teardown). */
  function scheduleExportAfterMenuDismiss(text: string) {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        void exportSummaryText(text);
      }, 320);
    });
  }

  async function exportSummaryText(content: string) {
    const trimmed = (content ?? '').trim();
    if (!trimmed) {
      setToast({ visible: true, message: t('visitPrep.toastNothingToExport') });
      return;
    }
    const withPrefix = (visitPrepExportPrefixText() + trimmed).trim();
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          await navigator.share({ text: withPrefix, title: t('visitPrep.shareTitle') });
        } else {
          await Clipboard.setStringAsync(withPrefix);
          setToast({ visible: true, message: t('visitPrep.toastCopiedBrowser') });
        }
        return;
      }
      await Share.share(
        Platform.OS === 'ios'
          ? { message: withPrefix }
          : { message: withPrefix, title: t('visitPrep.shareTitle') }
      );
    } catch {
      try {
        await Clipboard.setStringAsync(withPrefix);
        setToast({ visible: true, message: t('visitPrep.toastShareFallback') });
      } catch {
        setToast({ visible: true, message: t('visitPrep.toastShareCopyFailed') });
      }
    }
  }

  function saveRename() {
    if (!renameTarget) return;
    const trimmed = renameDraft.trim();
    const display_name = trimmed.length === 0 ? null : trimmed.slice(0, 120);
    const targetId = renameTarget.id;
    updateDisplayName.mutate(
      { id: targetId, display_name },
      {
        onSuccess: () => {
          setHistoryDetail((d) =>
            d?.id === targetId ? { ...d, display_name: display_name ?? null } : d
          );
          setRenameTarget(null);
          setRenameDraft('');
          setToast({
            visible: true,
            message: display_name ? t('visitPrep.toastNameUpdated') : t('visitPrep.toastNameCleared'),
          });
        },
        onError: (e) => {
          Alert.alert(t('visitPrep.couldNotSave'), e instanceof Error ? e.message : t('visitPrep.unknownError'));
        },
      }
    );
  }

  function TabPill({ tab, label }: { tab: MainTab; label: string }) {
    const active = mainTab === tab;
    return (
      <TouchableOpacity
        onPress={() => goTab(tab)}
        style={[
          styles.tabPill,
          { backgroundColor: active ? theme.accent : theme.surface, borderColor: active ? theme.accent : theme.borderLight },
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
      >
        <Text style={[styles.tabPillText, { color: active ? '#FFFFFF' : theme.textSecondary }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  const summaryDateLabel =
    generatedAt != null
      ? formatGeneratedLabel(generatedAt, localeTag)
      : new Date().toLocaleDateString(localeTag, { month: 'long', day: 'numeric', year: 'numeric' });

  const showHistoryDebug = __DEV__ && !!historyErrorMessage;
  const historyHint = showHistoryDebug && historyErrorMessage ? historyTroubleshootHint(historyErrorMessage, t) : null;

  useEffect(() => {
    if (!historyError) return;
    if (__DEV__) {
      console.error('[VisitPrep] history query failed', historyError);
      return;
    }
    if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(historyError, {
        tags: { flow: 'visit_prep' },
        extra: { stage: 'history_query' },
      });
    } else {
      console.warn('[VisitPrep] history query failed (no DSN)', historyError);
    }
  }, [historyError]);

  const summaryContent = (
    <>
      <View style={[styles.intro, { backgroundColor: theme.surface }]}>
        <MaterialCommunityIcons name="stethoscope" size={40} color={theme.accent} />
        <Text style={[styles.introTitle, { color: theme.text }]}>{t('visitPrep.introTitle')}</Text>
        <Text style={[styles.introDesc, { color: theme.textSecondary }]}>
          <Trans
            i18nKey="visitPrep.introFull"
            values={{ name: family?.care_recipient_name ?? '' }}
            components={[<Text key="0" style={[styles.introName, { color: theme.accent }]} />]}
          />
        </Text>
        <View style={{ width: '100%', marginTop: 10 }}>
          <AiHealthDisclaimer kind="visit_prep" />
        </View>
      </View>

      {visitPrepLocked ? (
        <FeatureLockedCallout
          featureId="ai_visit_prep"
          currentTier={tier}
          onUpgrade={() => navigation.navigate('Subscription', { featureId: 'ai_visit_prep' })}
          showNativePurchaseCta={Platform.OS !== 'web'}
        />
      ) : null}

      {persistError ? (
        <View style={[styles.persistBanner, { backgroundColor: theme.errorSurface, borderColor: theme.error }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={20} color={theme.error} />
          <Text style={[styles.persistBannerText, { color: theme.error }]}>{persistError}</Text>
        </View>
      ) : null}

      {!visitPrepLocked && !summary && !isLoading && !error ? (
        <TouchableOpacity
          style={[styles.generateBtn, { backgroundColor: theme.accent }]}
          onPress={() => {
            if (__DEV__) console.warn('[VisitPrep] generate pressed');
            void generate().catch((e) => {
              if (__DEV__) console.warn('[VisitPrep] generate rejected', e);
            });
          }}
        >
          <Text style={styles.generateBtnText}>{t('visitPrep.generateCta')}</Text>
        </TouchableOpacity>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.accent} size="large" />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{t('visitPrep.analyzing')}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: theme.errorSurface }]}>
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 12 }}>
            {subscriptionBlocked ? (
              <TouchableOpacity
                style={[styles.retryBtn, { backgroundColor: theme.accent }]}
                onPress={() => navigation.navigate('Subscription', { featureId: 'ai_visit_prep' })}
              >
                <Text style={styles.retryText}>{t('visitPrep.viewPlans')}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.error }]} onPress={generate}>
              <Text style={styles.retryText}>{t('visitPrep.tryAgain')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {summary ? (
        <View style={[styles.summaryBox, { backgroundColor: theme.surface }]}>
          <View style={styles.summaryHeader}>
            <Text style={[styles.summaryDate, { color: theme.textTertiary }]}>
              {t('visitPrep.generatedPrefix', { date: summaryDateLabel })}
            </Text>
            <View style={styles.summaryActions}>
              <TouchableOpacity onPress={() => handleCopy(summary)} style={styles.actionBtn}>
                <MaterialCommunityIcons name="content-copy" size={14} color={theme.accent} />
                <Text style={[styles.refreshText, { color: theme.accent }]}>{t('visitPrep.copy')}</Text>
              </TouchableOpacity>
              {!visitPrepLocked ? (
                <TouchableOpacity onPress={generate} style={styles.actionBtn}>
                  <MaterialCommunityIcons name="refresh" size={14} color={theme.accent} />
                  <Text style={[styles.refreshText, { color: theme.accent }]}>{t('visitPrep.refresh')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <AiHealthDisclaimer kind="visit_prep" />
          {renderMinimalMarkdown(summary, theme, summaryId, 'visitPrep')}
        </View>
      ) : null}
    </>
  );

  const historyList = (
    <FlatList
      style={{ flex: 1 }}
      data={history}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.historyListContent, history.length === 0 && styles.historyListEmpty]}
      refreshControl={
        <RefreshControl refreshing={historyIsFetching} onRefresh={() => void refetchHistory()} tintColor={theme.accent} />
      }
      ListEmptyComponent={
        historyLoading ? (
          <View style={styles.historyLoadingOnly}>
            <ActivityIndicator color={theme.accent} size="large" />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{t('visitPrep.loadingHistory')}</Text>
          </View>
        ) : historyErrorMessage ? (
          <View style={[styles.errorBox, { backgroundColor: theme.errorSurface }]}>
            <Text style={[styles.errorText, { color: theme.error }]}>
              {t('visitPrep.historyLoadError')}
            </Text>
            {showHistoryDebug ? (
              <Text style={[styles.hintText, { color: theme.textSecondary }]}>
                {historyErrorMessage}
                {historyHint ? `\n\n${historyHint}` : ''}
              </Text>
            ) : null}
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.error }]} onPress={() => void refetchHistory()}>
              <Text style={styles.retryText}>{t('visitPrep.tryAgain')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyHistory}>
            <MaterialCommunityIcons name="history" size={40} color={theme.borderLight} />
            <Text style={[styles.emptyHistoryTitle, { color: theme.text }]}>{t('visitPrep.emptyHistoryTitle')}</Text>
            <Text style={[styles.emptyHistoryMsg, { color: theme.textSecondary }]}>
              {t('visitPrep.emptyHistoryMsg')}
            </Text>
            <TouchableOpacity style={[styles.generateBtn, { backgroundColor: theme.accent, marginTop: 16 }]} onPress={() => goTab('summary')}>
              <Text style={styles.generateBtnText}>{t('visitPrep.goToSummary')}</Text>
            </TouchableOpacity>
          </View>
        )
      }
      renderItem={({ item }) => {
        const customName = item.display_name?.trim();
        return (
          <View style={[styles.historyCard, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
            <View style={styles.historyCardHeader}>
              <View style={{ flex: 1, gap: 4 }}>
                {customName ? (
                  <Text style={[styles.historyCardName, { color: theme.text }]} numberOfLines={2}>
                    {customName}
                  </Text>
                ) : null}
                <Text
                  style={[
                    customName ? styles.historyCardDateSub : styles.historyCardDate,
                    { color: customName ? theme.textSecondary : theme.accent },
                  ]}
                  numberOfLines={2}
                >
                  {formatGeneratedLabel(item.generated_at, localeTag)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSummaryMenuItem(item)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.historyCardMenuBtn}
                accessibilityLabel={t('visitPrep.a11ySummaryOptions')}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="dots-vertical" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Pressable
              onPress={() => openHistoryDetail(item)}
              style={({ pressed }) => [pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={t('visitPrep.a11yOpenSummary')}
            >
              <Text style={[styles.historyCardPreview, { color: theme.textSecondary }]} numberOfLines={3}>
                {historyPreview(item.content)}
              </Text>
              <Text style={[styles.historyCardHint, { color: theme.textTertiary }]}>{t('visitPrep.tapToReadFull')}</Text>
            </Pressable>
          </View>
        );
      }}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Clear native-stack transparent header so Summary / History tabs are not covered by glass chrome */}
      <View style={[styles.tabRowWrap, { paddingHorizontal: 20, paddingTop: headerHeight + spacing.md }]}>
        <View style={styles.tabRow}>
          <TabPill tab="summary" label={t('visitPrep.tabs.summary')} />
          <TabPill tab="history" label={t('visitPrep.tabs.history')} />
        </View>
      </View>

      <View style={styles.tabBody}>
        <Animated.View
          style={[
            styles.tabLayer,
            { opacity: summaryOpacity, zIndex: mainTab === 'summary' ? 2 : 0 },
          ]}
          pointerEvents={mainTab === 'summary' ? 'auto' : 'none'}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={[styles.content, { paddingTop: spacing.sm }]}
          >
            {summaryContent}
          </ScrollView>
        </Animated.View>

        <Animated.View
          style={[
            styles.tabLayer,
            { opacity: historyOpacity, zIndex: mainTab === 'history' ? 2 : 0 },
          ]}
          pointerEvents={mainTab === 'history' ? 'auto' : 'none'}
        >
          <View style={{ flex: 1 }}>
            {historyList}
            {historyDetail ? (
              <Animated.View
                style={[
                  StyleSheet.absoluteFillObject,
                  { backgroundColor: theme.bg, transform: [{ translateX: detailTranslateX }] },
                ]}
              >
                <ScrollView
                  style={{ flex: 1 }}
                  contentInsetAdjustmentBehavior="automatic"
                  contentContainerStyle={[styles.content, { paddingTop: spacing.sm }]}
                >
                  <TouchableOpacity style={styles.backRow} onPress={closeHistoryDetail} accessibilityRole="button">
                    <MaterialCommunityIcons name="chevron-left" size={22} color={theme.accent} />
                    <Text style={[styles.backText, { color: theme.accent }]}>{t('visitPrep.allSummaries')}</Text>
                  </TouchableOpacity>
                  <View style={[styles.summaryBox, { backgroundColor: theme.surface }]}>
                    <View style={styles.summaryHeader}>
                      <View style={{ flex: 1, marginRight: 8, gap: 4 }}>
                        {historyDetail.display_name?.trim() ? (
                          <Text style={[styles.detailDisplayName, { color: theme.text }]} numberOfLines={3}>
                            {historyDetail.display_name.trim()}
                          </Text>
                        ) : null}
                        <Text style={[styles.summaryDate, { color: theme.textTertiary, flex: 0 }]}>
                          {t('visitPrep.generatedPrefix', { date: formatGeneratedLabel(historyDetail.generated_at, localeTag) })}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => handleCopy(historyDetail.content)} style={styles.actionBtn}>
                        <MaterialCommunityIcons name="content-copy" size={14} color={theme.accent} />
                        <Text style={[styles.refreshText, { color: theme.accent }]}>{t('visitPrep.copy')}</Text>
                      </TouchableOpacity>
                    </View>
                    <AiHealthDisclaimer kind="visit_prep" />
                    {renderMinimalMarkdown(historyDetail.content, theme, historyDetail.id, 'visitPrep')}
                  </View>
                </ScrollView>
              </Animated.View>
            ) : null}
          </View>
        </Animated.View>
      </View>

      <Modal
        visible={summaryMenuItem != null}
        transparent
        animationType="fade"
        onRequestClose={closeSummaryMenu}
      >
        <View style={styles.menuRoot}>
          <Pressable style={styles.menuBackdropFill} onPress={closeSummaryMenu} />
          <View style={styles.menuCenterWrap} pointerEvents="box-none">
            <View style={[styles.menuSheet, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
              {summaryMenuItem ? (
                <>
                  <Text style={[styles.menuTitle, { color: theme.textTertiary }]}>{t('visitPrep.menuTitle')}</Text>
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => {
                      const row = summaryMenuItem;
                      closeSummaryMenu();
                      openHistoryDetail(row);
                    }}
                  >
                    <Text style={[styles.menuRowLabel, { color: theme.text }]}>{t('visitPrep.read')}</Text>
                  </TouchableOpacity>
                  <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
                  {canEditVisitPrepSummary(summaryMenuItem, user?.id, isFamilyAdmin) ? (
                    <>
                      <TouchableOpacity
                        style={styles.menuRow}
                        onPress={() => {
                          const row = summaryMenuItem;
                          closeSummaryMenu();
                          setRenameDraft(row.display_name?.trim() ?? '');
                          setRenameTarget(row);
                        }}
                      >
                        <Text style={[styles.menuRowLabel, { color: theme.text }]}>{t('visitPrep.rename')}</Text>
                      </TouchableOpacity>
                      <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
                    </>
                  ) : null}
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={async () => {
                      const row = summaryMenuItem;
                      closeSummaryMenu();
                      await handleCopy(row.content);
                    }}
                  >
                    <Text style={[styles.menuRowLabel, { color: theme.text }]}>{t('visitPrep.copy')}</Text>
                  </TouchableOpacity>
                  <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => {
                      const row = summaryMenuItem;
                      closeSummaryMenu();
                      scheduleExportAfterMenuDismiss(row.content);
                    }}
                  >
                    <Text style={[styles.menuRowLabel, { color: theme.text }]}>{t('visitPrep.exportAction')}</Text>
                  </TouchableOpacity>
                  <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => {
                      const row = summaryMenuItem;
                      closeSummaryMenu();
                      if (!canEditVisitPrepSummary(row, user?.id, isFamilyAdmin)) {
                        Alert.alert(
                          t('visitPrep.cannotDeleteTitle'),
                          t('visitPrep.cannotDeleteMessage')
                        );
                        return;
                      }
                      confirmDeleteSummary(row);
                    }}
                  >
                    <Text style={[styles.menuRowLabel, { color: theme.error }]}>{t('visitPrep.delete')}</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={renameTarget != null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setRenameTarget(null);
          setRenameDraft('');
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.menuRoot}>
            <Pressable
              style={styles.menuBackdropFill}
              onPress={() => {
                setRenameTarget(null);
                setRenameDraft('');
              }}
            />
            <View style={styles.renameCenterWrap} pointerEvents="box-none">
            <View style={[styles.renameSheet, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
              <Text style={[styles.renameTitle, { color: theme.text }]}>{t('visitPrep.renameModalTitle')}</Text>
              <Text style={[styles.renameHint, { color: theme.textSecondary }]}>
                {t('visitPrep.renameModalHint')}
              </Text>
              <TextInput
                value={renameDraft}
                onChangeText={setRenameDraft}
                placeholder={t('visitPrep.renamePlaceholder')}
                placeholderTextColor={theme.textTertiary}
                maxLength={120}
                style={[styles.renameInput, { color: theme.text, borderColor: theme.borderLight, backgroundColor: theme.bg }]}
                autoFocus
                autoCorrect
                returnKeyType="done"
                onSubmitEditing={saveRename}
              />
              <Text style={[styles.renameMeta, { color: theme.textTertiary }]}>
                {renameTarget ? formatGeneratedLabel(renameTarget.generated_at, localeTag) : ''}
              </Text>
              <View style={styles.renameActions}>
                <TouchableOpacity
                  style={[styles.renameBtnSecondary, { borderColor: theme.borderLight }]}
                  onPress={() => {
                    setRenameTarget(null);
                    setRenameDraft('');
                  }}
                >
                  <Text style={[styles.renameBtnSecondaryText, { color: theme.textSecondary }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.renameBtnPrimary, { backgroundColor: theme.accent }]}
                  onPress={saveRename}
                  disabled={updateDisplayName.isPending}
                >
                  {updateDisplayName.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.renameBtnPrimaryText}>{t('common.save')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Toast message={toast.message} visible={toast.visible} type="info" onHide={() => setToast({ visible: false, message: '' })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBody: { flex: 1, position: 'relative' },
  tabLayer: { ...StyleSheet.absoluteFillObject },
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  tabRowWrap: {},
  tabRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  tabPillText: { fontSize: 14, fontWeight: '700' },
  intro: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  introTitle: { fontSize: 20, fontWeight: '700' },
  introDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  introName: { fontWeight: '600' },
  generateBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  generateBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  loadingBox: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  loadingText: { fontSize: 14 },
  errorBox: {
    borderRadius: 14,
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  errorText: { fontSize: 14, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  summaryBox: {
    borderRadius: 16,
    padding: 20,
    gap: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryActions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryDate: { fontSize: 12, flex: 1, marginRight: 8 },
  refreshText: { fontSize: 14, fontWeight: '600' },
  historyListContent: { padding: 20, gap: 12, paddingBottom: 32 },
  historyListEmpty: { flexGrow: 1, justifyContent: 'center' },
  historyLoadingOnly: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  historyCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyCardMenuBtn: { marginTop: -4, padding: 4 },
  historyCardName: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  historyCardDate: { fontSize: 13, fontWeight: '700' },
  historyCardDateSub: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  detailDisplayName: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  historyCardPreview: { fontSize: 14, lineHeight: 20 },
  historyCardHint: { fontSize: 12 },
  emptyHistory: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyHistoryTitle: { fontSize: 17, fontWeight: '700', marginTop: 8 },
  emptyHistoryMsg: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
  persistBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  persistBannerText: { flex: 1, fontSize: 14, lineHeight: 20 },
  hintText: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 4 },
  menuRoot: { flex: 1 },
  menuBackdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  menuCenterWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  menuSheet: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  menuRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuRowLabel: { fontSize: 17, fontWeight: '500' },
  menuDivider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  renameCenterWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  renameSheet: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 12,
  },
  renameTitle: { fontSize: 18, fontWeight: '700' },
  renameHint: { fontSize: 14, lineHeight: 20 },
  renameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  renameMeta: { fontSize: 13, fontWeight: '600' },
  renameActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  renameBtnSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  renameBtnSecondaryText: { fontSize: 16, fontWeight: '600' },
  renameBtnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  renameBtnPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
