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
import * as Clipboard from 'expo-clipboard';
import { Toast } from '../../components/Toast';
import { useVisitPrep } from './useVisitPrep';
import { useDeleteVisitPrepSummary, useUpdateVisitPrepSummaryDisplayName } from './useVisitPrepMutations';
import { useFamilyStore } from '../../store/family';
import { useAuthStore } from '../../store/auth';
import { useMembers } from '../family/hooks/useMembers';
import { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { useHeaderHeight } from '@react-navigation/elements';
import { useReduceMotion } from '../../navigation/useReduceMotion';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme, spacing, type Theme } from '../../theme';
import type { VisitPrepSummary } from '../../types';

function renderMarkdown(text: string, theme: Theme) {
  return text.split('\n').map((line, i) => {
    if (/^\*\*(.+)\*\*$/.test(line)) {
      return <Text key={i} style={[styles.heading, { color: theme.text }]}>{line.replace(/\*\*/g, '')}</Text>;
    }
    if (/^\d+\.\s\*\*(.+)\*\*/.test(line)) {
      const num = line.match(/^\d+/)?.[0];
      const label = line.replace(/^\d+\.\s\*\*/, '').replace(/\*\*.*$/, '');
      return <Text key={i} style={[styles.sectionTitle, { color: theme.accent }]}>{num}. {label}</Text>;
    }
    if (/^#{1,3}\s/.test(line)) {
      return <Text key={i} style={[styles.heading, { color: theme.text }]}>{line.replace(/^#{1,3}\s/, '')}</Text>;
    }
    if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
      return <Text key={i} style={[styles.bullet, { color: theme.textSecondary }]}>{'  •  '}{line.replace(/^[-•*]\s/, '')}</Text>;
    }
    if (line.trim() === '') return <View key={i} style={{ height: 8 }} />;
    return <Text key={i} style={[styles.body, { color: theme.textSecondary }]}>{line}</Text>;
  });
}

type MainTab = 'summary' | 'history';

function formatGeneratedLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
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

function historyTroubleshootHint(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes('schema cache') || m.includes('pgrst205') || m.includes('pgrst204')) {
    return [
      'PostgREST has not picked up visit_prep_summaries yet. Try in order:',
      '1) Supabase Dashboard → SQL → run the file supabase/migrations/20260421140000_visit_prep_summaries.sql (creates table, RLS policies, NOTIFY).',
      '2) Wait ~1 minute, then pull to refresh here.',
      '3) If it still fails: Dashboard → Project Settings → General → Pause project, then Resume (forces API reload).',
    ].join('\n');
  }
  if (m.includes('does not exist') || m.includes('relation') || m.includes('42p01')) {
    return 'Add the visit_prep_summaries table to your Supabase database (see .claude/schema.sql), then try again.';
  }
  return null;
}

const SCREEN_W = Dimensions.get('window').width;

export function VisitPrepScreen() {
  const t = useTheme();
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
    generatedAt,
    isLoading,
    error,
    persistError,
    generate,
    history,
    historyLoading,
    historyErrorMessage,
    historyIsFetching,
    refetchHistory,
  } = useVisitPrep();
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
    await Clipboard.setStringAsync(text);
    setToast({ visible: true, message: 'Copied to clipboard' });
  }

  function closeSummaryMenu() {
    setSummaryMenuItem(null);
  }

  function confirmDeleteSummary(item: VisitPrepSummary) {
    Alert.alert(
      'Delete this summary?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteSummary.mutate(item.id, {
              onSuccess: () => {
                if (historyDetailRef.current?.id === item.id) closeHistoryDetail();
                setToast({ visible: true, message: 'Summary deleted' });
              },
              onError: (e) => {
                Alert.alert('Could not delete', e instanceof Error ? e.message : 'Unknown error');
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
      setToast({ visible: true, message: 'Nothing to export' });
      return;
    }
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          await navigator.share({ text: trimmed, title: 'Visit prep summary' });
        } else {
          await Clipboard.setStringAsync(trimmed);
          setToast({ visible: true, message: 'Copied (browser share not available)' });
        }
        return;
      }
      await Share.share(
        Platform.OS === 'ios'
          ? { message: trimmed }
          : { message: trimmed, title: 'Visit prep summary' }
      );
    } catch {
      try {
        await Clipboard.setStringAsync(trimmed);
        setToast({ visible: true, message: 'Share unavailable — copied to clipboard instead' });
      } catch {
        setToast({ visible: true, message: 'Could not share or copy' });
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
            message: display_name ? 'Name updated' : 'Custom name removed',
          });
        },
        onError: (e) => {
          Alert.alert('Could not save', e instanceof Error ? e.message : 'Unknown error');
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
          { backgroundColor: active ? t.accent : t.surface, borderColor: active ? t.accent : t.borderLight },
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
      >
        <Text style={[styles.tabPillText, { color: active ? '#FFFFFF' : t.textSecondary }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  const summaryDateLabel =
    generatedAt != null ? formatGeneratedLabel(generatedAt) : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const historyHint = historyErrorMessage ? historyTroubleshootHint(historyErrorMessage) : null;

  const summaryContent = (
    <>
      <View style={[styles.intro, { backgroundColor: t.surface }]}>
        <MaterialCommunityIcons name="stethoscope" size={40} color={t.accent} />
        <Text style={[styles.introTitle, { color: t.text }]}>AI Visit Summary</Text>
        <Text style={[styles.introDesc, { color: t.textSecondary }]}>
          Generates a doctor visit prep sheet from{' '}
          <Text style={[styles.introName, { color: t.accent }]}>{family?.care_recipient_name}'s</Text>{' '}
          last 30 days of health logs and current medications. Each run is saved under History.
        </Text>
      </View>

      {persistError ? (
        <View style={[styles.persistBanner, { backgroundColor: t.errorSurface, borderColor: t.error }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={20} color={t.error} />
          <Text style={[styles.persistBannerText, { color: t.error }]}>{persistError}</Text>
        </View>
      ) : null}

      {!summary && !isLoading && !error ? (
        <TouchableOpacity style={[styles.generateBtn, { backgroundColor: t.accent }]} onPress={generate}>
          <Text style={styles.generateBtnText}>Generate Visit Summary</Text>
        </TouchableOpacity>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={t.accent} size="large" />
          <Text style={[styles.loadingText, { color: t.textSecondary }]}>Analyzing health data…</Text>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: t.errorSurface }]}>
          <Text style={[styles.errorText, { color: t.error }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: t.error }]} onPress={generate}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {summary ? (
        <View style={[styles.summaryBox, { backgroundColor: t.surface }]}>
          <View style={styles.summaryHeader}>
            <Text style={[styles.summaryDate, { color: t.textTertiary }]}>Generated {summaryDateLabel}</Text>
            <View style={styles.summaryActions}>
              <TouchableOpacity onPress={() => handleCopy(summary)} style={styles.actionBtn}>
                <MaterialCommunityIcons name="content-copy" size={14} color={t.accent} />
                <Text style={[styles.refreshText, { color: t.accent }]}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={generate} style={styles.actionBtn}>
                <MaterialCommunityIcons name="refresh" size={14} color={t.accent} />
                <Text style={[styles.refreshText, { color: t.accent }]}>Refresh</Text>
              </TouchableOpacity>
            </View>
          </View>
          {renderMarkdown(summary, t)}
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
        <RefreshControl refreshing={historyIsFetching} onRefresh={() => void refetchHistory()} tintColor={t.accent} />
      }
      ListEmptyComponent={
        historyLoading ? (
          <View style={styles.historyLoadingOnly}>
            <ActivityIndicator color={t.accent} size="large" />
            <Text style={[styles.loadingText, { color: t.textSecondary }]}>Loading history…</Text>
          </View>
        ) : historyErrorMessage ? (
          <View style={[styles.errorBox, { backgroundColor: t.errorSurface }]}>
            <Text style={[styles.errorText, { color: t.error }]}>{historyErrorMessage}</Text>
            {historyHint ? <Text style={[styles.hintText, { color: t.textSecondary }]}>{historyHint}</Text> : null}
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: t.error }]} onPress={() => void refetchHistory()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyHistory}>
            <MaterialCommunityIcons name="history" size={40} color={t.borderLight} />
            <Text style={[styles.emptyHistoryTitle, { color: t.text }]}>No saved summaries yet</Text>
            <Text style={[styles.emptyHistoryMsg, { color: t.textSecondary }]}>
              Generate a visit summary to save it here automatically.
            </Text>
            <TouchableOpacity style={[styles.generateBtn, { backgroundColor: t.accent, marginTop: 16 }]} onPress={() => goTab('summary')}>
              <Text style={styles.generateBtnText}>Go to Summary</Text>
            </TouchableOpacity>
          </View>
        )
      }
      renderItem={({ item }) => {
        const customName = item.display_name?.trim();
        return (
          <View style={[styles.historyCard, { backgroundColor: t.surface, borderColor: t.borderLight }]}>
            <View style={styles.historyCardHeader}>
              <View style={{ flex: 1, gap: 4 }}>
                {customName ? (
                  <Text style={[styles.historyCardName, { color: t.text }]} numberOfLines={2}>
                    {customName}
                  </Text>
                ) : null}
                <Text
                  style={[
                    customName ? styles.historyCardDateSub : styles.historyCardDate,
                    { color: customName ? t.textSecondary : t.accent },
                  ]}
                  numberOfLines={2}
                >
                  {formatGeneratedLabel(item.generated_at)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSummaryMenuItem(item)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.historyCardMenuBtn}
                accessibilityLabel="Summary options"
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="dots-vertical" size={22} color={t.textSecondary} />
              </TouchableOpacity>
            </View>
            <Pressable
              onPress={() => openHistoryDetail(item)}
              style={({ pressed }) => [pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel="Open summary"
            >
              <Text style={[styles.historyCardPreview, { color: t.textSecondary }]} numberOfLines={3}>
                {historyPreview(item.content)}
              </Text>
              <Text style={[styles.historyCardHint, { color: t.textTertiary }]}>Tap to read full summary</Text>
            </Pressable>
          </View>
        );
      }}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      {/* Clear native-stack transparent header so Summary / History tabs are not covered by glass chrome */}
      <View style={[styles.tabRowWrap, { paddingHorizontal: 20, paddingTop: headerHeight + spacing.md }]}>
        <View style={styles.tabRow}>
          <TabPill tab="summary" label="Summary" />
          <TabPill tab="history" label="History" />
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
                  { backgroundColor: t.bg, transform: [{ translateX: detailTranslateX }] },
                ]}
              >
                <ScrollView
                  style={{ flex: 1 }}
                  contentInsetAdjustmentBehavior="automatic"
                  contentContainerStyle={[styles.content, { paddingTop: spacing.sm }]}
                >
                  <TouchableOpacity style={styles.backRow} onPress={closeHistoryDetail} accessibilityRole="button">
                    <MaterialCommunityIcons name="chevron-left" size={22} color={t.accent} />
                    <Text style={[styles.backText, { color: t.accent }]}>All summaries</Text>
                  </TouchableOpacity>
                  <View style={[styles.summaryBox, { backgroundColor: t.surface }]}>
                    <View style={styles.summaryHeader}>
                      <View style={{ flex: 1, marginRight: 8, gap: 4 }}>
                        {historyDetail.display_name?.trim() ? (
                          <Text style={[styles.detailDisplayName, { color: t.text }]} numberOfLines={3}>
                            {historyDetail.display_name.trim()}
                          </Text>
                        ) : null}
                        <Text style={[styles.summaryDate, { color: t.textTertiary, flex: 0 }]}>
                          Generated {formatGeneratedLabel(historyDetail.generated_at)}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => handleCopy(historyDetail.content)} style={styles.actionBtn}>
                        <MaterialCommunityIcons name="content-copy" size={14} color={t.accent} />
                        <Text style={[styles.refreshText, { color: t.accent }]}>Copy</Text>
                      </TouchableOpacity>
                    </View>
                    {renderMarkdown(historyDetail.content, t)}
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
            <View style={[styles.menuSheet, { backgroundColor: t.surface, borderColor: t.borderLight }]}>
              {summaryMenuItem ? (
                <>
                  <Text style={[styles.menuTitle, { color: t.textTertiary }]}>Summary</Text>
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => {
                      const row = summaryMenuItem;
                      closeSummaryMenu();
                      openHistoryDetail(row);
                    }}
                  >
                    <Text style={[styles.menuRowLabel, { color: t.text }]}>Read</Text>
                  </TouchableOpacity>
                  <View style={[styles.menuDivider, { backgroundColor: t.border }]} />
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
                        <Text style={[styles.menuRowLabel, { color: t.text }]}>Rename</Text>
                      </TouchableOpacity>
                      <View style={[styles.menuDivider, { backgroundColor: t.border }]} />
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
                    <Text style={[styles.menuRowLabel, { color: t.text }]}>Copy</Text>
                  </TouchableOpacity>
                  <View style={[styles.menuDivider, { backgroundColor: t.border }]} />
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => {
                      const row = summaryMenuItem;
                      closeSummaryMenu();
                      scheduleExportAfterMenuDismiss(row.content);
                    }}
                  >
                    <Text style={[styles.menuRowLabel, { color: t.text }]}>Export</Text>
                  </TouchableOpacity>
                  <View style={[styles.menuDivider, { backgroundColor: t.border }]} />
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => {
                      const row = summaryMenuItem;
                      closeSummaryMenu();
                      if (!canEditVisitPrepSummary(row, user?.id, isFamilyAdmin)) {
                        Alert.alert(
                          'Cannot delete',
                          'Only the person who generated this summary or a family admin can delete it.'
                        );
                        return;
                      }
                      confirmDeleteSummary(row);
                    }}
                  >
                    <Text style={[styles.menuRowLabel, { color: t.error }]}>Delete</Text>
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
            <View style={[styles.renameSheet, { backgroundColor: t.surface, borderColor: t.borderLight }]}>
              <Text style={[styles.renameTitle, { color: t.text }]}>Rename summary</Text>
              <Text style={[styles.renameHint, { color: t.textSecondary }]}>
                Optional. The generated date and time below always stay the same.
              </Text>
              <TextInput
                value={renameDraft}
                onChangeText={setRenameDraft}
                placeholder="e.g. Dr. Chen — follow-up"
                placeholderTextColor={t.textTertiary}
                maxLength={120}
                style={[styles.renameInput, { color: t.text, borderColor: t.borderLight, backgroundColor: t.bg }]}
                autoFocus
                autoCorrect
                returnKeyType="done"
                onSubmitEditing={saveRename}
              />
              <Text style={[styles.renameMeta, { color: t.textTertiary }]}>
                {renameTarget ? formatGeneratedLabel(renameTarget.generated_at) : ''}
              </Text>
              <View style={styles.renameActions}>
                <TouchableOpacity
                  style={[styles.renameBtnSecondary, { borderColor: t.borderLight }]}
                  onPress={() => {
                    setRenameTarget(null);
                    setRenameDraft('');
                  }}
                >
                  <Text style={[styles.renameBtnSecondaryText, { color: t.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.renameBtnPrimary, { backgroundColor: t.accent }]}
                  onPress={saveRename}
                  disabled={updateDisplayName.isPending}
                >
                  {updateDisplayName.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.renameBtnPrimaryText}>Save</Text>
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
  heading: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginTop: 12 },
  bullet: { fontSize: 14, lineHeight: 22 },
  body: { fontSize: 14, lineHeight: 22 },
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
