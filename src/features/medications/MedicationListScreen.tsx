import { useCallback, useRef, useState, useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { showActionSheet } from '../../lib/actionSheet';
import { SkeletonList } from '../../components/SkeletonCard';
import { useMedications, useTodayMedLogs, useDeactivateMedication, computeDoseStatus, type MedLogsMap } from './hooks/useMedications';
import { useFamilyInteractionWarnings } from './hooks/useDrugInteractions';
import type { InteractionSeverity } from './services/drugInteractionService';
import { AddMedicationSheet } from './AddMedicationSheet';
import { useTheme, typography, type Theme } from '../../theme';
import { Icon } from '../../components/Icon';
import { AiHealthDisclaimer } from '../../components/AiHealthDisclaimer';
import type { Medication } from '../../types';
import type { MainStackParamList } from '../../navigation/types';
import { NativeHeaderTextButton } from '../../navigation/NativeHeaderTextButton';
import { EmptyState } from '../../components/EmptyState';
import { Toast } from '../../components/Toast';
import { UndoSnackbar } from '../../components/UndoSnackbar';
import { useUndoDelete } from '../../hooks/useUndoDelete';
import { useMedicationRefillPrompt } from './hooks/useMedicationRefillPrompt';

function TodayStatusDot({ med, todayLogs }: { med: Medication; todayLogs: MedLogsMap }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const status = computeDoseStatus(med, todayLogs[med.id]);
  if (status === 'as_needed') return null;
  if (status === 'taken') return <View style={[styles.statusDot, styles.statusDotTaken]} />;
  if (status === 'partial') return <View style={[styles.statusDot, styles.statusDotPartial]} />;
  if (status === 'missed') return <View style={[styles.statusDot, styles.statusDotMissed]} />;
  return <View style={[styles.statusDot, styles.statusDotPending]} />;
}

function InteractionSeverityBadge({ severity }: { severity: InteractionSeverity }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const cfg =
    severity === 'severe'
      ? { label: 'Severe', bg: t.error + '22', fg: t.error }
      : severity === 'moderate'
        ? { label: 'Moderate', bg: t.warning + '28', fg: t.warning }
        : { label: 'Mild', bg: t.info + '22', fg: t.info };
  return (
    <View
      style={[styles.interactionSeverityBadge, { backgroundColor: cfg.bg }]}
      accessibilityRole="text"
      accessibilityLabel={`Drug interaction, ${cfg.label}`}
    >
      <Icon name="warning" size={11} color={cfg.fg} />
      <Text style={[styles.interactionSeverityBadgeText, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

function SwipeableMedicationCard({
  med,
  onPress,
  onDelete,
  onMenu,
  onRefill,
  todayLogs,
  interactionSeverity,
  hasRefillTracking,
  isRefillPending,
}: {
  med: Medication;
  onPress: () => void;
  onDelete: () => void;
  onMenu: () => void;
  onRefill: () => void;
  todayLogs: MedLogsMap;
  interactionSeverity: InteractionSeverity | null;
  hasRefillTracking: boolean;
  isRefillPending: boolean;
}) {
  const t = useTheme();
  const styles = makeStyles(t);
  const swipeableRef = useRef<Swipeable>(null);
  const medLabel = med.name?.trim() ? `Medication: ${med.name.trim()}` : 'Medication';
  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>) => {
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });
    return (
      <Animated.View style={[styles.swipeDeleteAction, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={styles.swipeDeleteBtn}
          onPress={() => { swipeableRef.current?.close(); onDelete(); }}
        >
          <Icon name="trash" size={20} color={t.surface} />
          <Text style={styles.swipeDeleteText}>Remove</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };
  const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>) => {
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-88, 0] });
    return (
      <Animated.View style={[styles.swipeRefillAction, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={[styles.swipeRefillBtn, isRefillPending && styles.swipeRefillBtnDisabled]}
          onPress={() => {
            if (isRefillPending) return;
            swipeableRef.current?.close();
            onRefill();
          }}
          disabled={isRefillPending}
        >
          <Icon name="add" size={20} color={t.surface} />
          <Text style={styles.swipeRefillText}>Refill</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };
  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      renderLeftActions={hasRefillTracking ? renderLeftActions : undefined}
      leftThreshold={40}
    >
      <MedicationCard
        med={med}
        onPress={onPress}
        onMenu={onMenu}
        todayLogs={todayLogs}
        interactionSeverity={interactionSeverity}
        accessibilityLabel={medLabel}
        hasRefillTracking={hasRefillTracking}
        onA11yRemove={() => { swipeableRef.current?.close(); onDelete(); }}
        onA11yRefill={() => { swipeableRef.current?.close(); onRefill(); }}
      />
    </Swipeable>
  );
}

function RefillBadge({ med }: { med: Medication }) {
  const t = useTheme();
  const styles = makeStyles(t);
  if (med.quantity_remaining == null) return null;
  const isLow = med.refill_threshold != null && med.quantity_remaining <= med.refill_threshold;
  return (
    <View style={[styles.refillBadge, isLow ? styles.refillBadgeLow : styles.refillBadgeOk]}>
      <Text style={[styles.refillBadgeText, isLow ? styles.refillBadgeTextLow : styles.refillBadgeTextOk]}>
        {isLow ? `Low · ${med.quantity_remaining}` : String(med.quantity_remaining)}
      </Text>
    </View>
  );
}

function MedicationCard({
  med,
  onPress,
  onMenu,
  todayLogs,
  interactionSeverity,
  accessibilityLabel,
  hasRefillTracking,
  onA11yRemove,
  onA11yRefill,
}: {
  med: Medication;
  onPress: () => void;
  onMenu: () => void;
  todayLogs: MedLogsMap;
  interactionSeverity: InteractionSeverity | null;
  accessibilityLabel: string;
  hasRefillTracking: boolean;
  onA11yRemove: () => void;
  onA11yRefill: () => void;
}) {
  const t = useTheme();
  const styles = makeStyles(t);
  const a11ySeverity =
    interactionSeverity === 'severe'
      ? 'Severe interaction.'
      : interactionSeverity === 'moderate'
        ? 'Moderate interaction.'
        : interactionSeverity === 'mild'
          ? 'Mild interaction.'
          : '';
  const accessibilityHint = hasRefillTracking
    ? 'Double tap to open details. Swipe right on the row to refill, swipe left to remove. Use custom actions for Refill, more actions, or Remove.'
    : 'Double tap to open details. Swipe left on the row to remove. Use custom actions for more actions or Remove.';
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={[accessibilityLabel, a11ySeverity].filter(Boolean).join(' ')}
      accessibilityHint={accessibilityHint}
      accessibilityActions={[
        { name: 'activate', label: 'Open details' },
        { name: 'edit', label: 'More actions' },
        ...(hasRefillTracking ? [{ name: 'refill' as const, label: 'Refill' }] : []),
        { name: 'delete', label: 'Remove' },
      ]}
      onAccessibilityAction={(e) => {
        const action = e.nativeEvent.actionName;
        if (action === 'activate') {
          onPress();
          return;
        }
        if (action === 'edit') {
          onMenu();
          return;
        }
        if (action === 'refill' && hasRefillTracking) {
          onA11yRefill();
          return;
        }
        if (action === 'delete') {
          onA11yRemove();
        }
      }}
    >
      <View style={styles.cardIcon}>
        <Icon name="medications" size={22} color={t.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardName}>{med.name}</Text>
        <Text style={styles.cardSub}>{med.dosage} · {med.frequency}</Text>
        {med.times && med.times.length > 0 ? (
          <View style={styles.cardTimesRow}>
            <Icon name="clock" size={12} color={t.textTertiary} />
            <Text style={styles.cardTimes}>{med.times.join(', ')}</Text>
          </View>
        ) : null}
      </View>
      <RefillBadge med={med} />
      {interactionSeverity ? <InteractionSeverityBadge severity={interactionSeverity} /> : null}
      <TodayStatusDot med={med} todayLogs={todayLogs} />
      <TouchableOpacity
        onPress={onMenu}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`More actions. ${accessibilityLabel}`}
      >
        <Text style={styles.menuDots}>···</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export function MedicationListScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { data: medications, isLoading, isFetching, refetch } = useMedications();
  const { data: todayLogMap = {} as MedLogsMap } = useTodayMedLogs();
  const { severityByDrugName } = useFamilyInteractionWarnings(medications);
  const deactivate = useDeactivateMedication();
  const undoDelete = useUndoDelete();
  const [toast, setToast] = useState({ visible: false, message: '' });
  const { promptRefill, isPending: isRefillPending, refillModalElement } = useMedicationRefillPrompt({
    onSuccess: (message) => setToast({ visible: true, message }),
  });
  const [showAdd, setShowAdd] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | undefined>(undefined);
  const [showInteractionInfo, setShowInteractionInfo] = useState(false);

  const openAdd = useCallback(() => setShowAdd(true), []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <NativeHeaderTextButton label="Add" onPress={openAdd} />,
    });
  }, [navigation, openAdd]);

  const openDetail = useCallback(
    (med: Medication) => {
      navigation.navigate('MedicationDetail', { medicationId: med.id });
    },
    [navigation],
  );

  const showMenu = useCallback(
    (med: Medication) => {
      const canRefill = med.quantity_remaining != null;
      const rows: { label: string; kind: 'edit' | 'refill' | 'remove' }[] = [{ label: 'Edit', kind: 'edit' }];
      if (canRefill) rows.push({ label: 'Refill', kind: 'refill' });
      rows.push({ label: 'Remove', kind: 'remove' });
      const options = ['Cancel', ...rows.map((r) => r.label)];
      showActionSheet(
        {
          options,
          cancelButtonIndex: 0,
          destructiveButtonIndex: options.length - 1,
        },
        (i) => {
          if (i <= 0) return;
          const row = rows[i - 1];
          if (!row) return;
          if (row.kind === 'edit') {
            setEditingMed(med);
            setShowAdd(true);
          } else if (row.kind === 'refill') {
            promptRefill(med);
          } else {
            confirmRemove(med);
          }
        },
      );
    },
    [promptRefill],
  );

  function confirmRemove(med: Medication) {
    const name = med.name?.trim() || 'Medication';
    undoDelete.scheduleDelete(`Removed: ${name}`, () => deactivate.mutate(med.id));
  }

  const legendHeader = (
    <View style={styles.legend}>
      <View style={styles.legendItem}><View style={[styles.statusDot, styles.statusDotTaken]} /><Text style={styles.legendText}>All doses taken</Text></View>
      <View style={styles.legendItem}><View style={[styles.statusDot, styles.statusDotPartial]} /><Text style={styles.legendText}>Partial</Text></View>
      <View style={styles.legendItem}><View style={[styles.statusDot, styles.statusDotMissed]} /><Text style={styles.legendText}>Missed</Text></View>
      <View style={styles.legendItem}><View style={[styles.statusDot, styles.statusDotPending]} /><Text style={styles.legendText}>Pending</Text></View>
      <TouchableOpacity
        style={styles.legendItem}
        onPress={() => setShowInteractionInfo(true)}
        accessibilityRole="button"
        accessibilityLabel="About drug interaction severity on the list"
      >
        <View style={styles.interactionLegendSamples}>
          <View style={[styles.interactionLegendDot, { backgroundColor: t.error }]} />
          <View style={[styles.interactionLegendDot, { backgroundColor: t.warning }]} />
          <View style={[styles.interactionLegendDot, { backgroundColor: t.info }]} />
        </View>
        <Text style={styles.legendText}>Severe · Moderate · Mild</Text>
        <Text style={styles.legendInfoText}>Info</Text>
      </TouchableOpacity>
    </View>
  );

  const isEmpty = (medications?.length ?? 0) === 0;

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={{ flex: 1, paddingTop: 12 }}>
          <SkeletonList count={5} lines={2} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={medications ?? []}
          keyExtractor={(m) => m.id}
          ListHeaderComponent={isEmpty ? undefined : legendHeader}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.list, { paddingTop: 12 }, isEmpty && { flexGrow: 1 }]}
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
            ListEmptyComponent={
              <EmptyState
                icon="medications"
                title="No medications yet"
                message="Keep doses and refills in one place for everyone on the care team."
                actionLabel="Add your first medication"
                onAction={openAdd}
              />
            }
            renderItem={({ item }) => (
              <View style={{ marginBottom: 10 }}>
                <SwipeableMedicationCard
                  med={item}
                  onPress={() => openDetail(item)}
                  onDelete={() => confirmRemove(item)}
                  onMenu={() => showMenu(item)}
                  onRefill={() => promptRefill(item)}
                  todayLogs={todayLogMap}
                  interactionSeverity={severityByDrugName.get(item.name.toLowerCase().trim()) ?? null}
                  hasRefillTracking={item.quantity_remaining != null}
                  isRefillPending={isRefillPending}
                />
              </View>
            )}
        />
      )}

      <AddMedicationSheet
        visible={showAdd}
        editing={editingMed}
        onClose={() => { setShowAdd(false); setEditingMed(undefined); }}
      />

      {showInteractionInfo ? (
        <View style={styles.interactionInfoOverlay} pointerEvents="box-none">
          <AiHealthDisclaimer kind="drug_interactions" />
          <TouchableOpacity
            onPress={() => setShowInteractionInfo(false)}
            style={styles.interactionInfoDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Text style={styles.interactionInfoDismissText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Toast message={toast.message} visible={toast.visible} onHide={() => setToast({ visible: false, message: '' })} />
      <UndoSnackbar
        message={undoDelete.message}
        visible={undoDelete.visible}
        onUndo={undoDelete.undo}
        onSwipeDismiss={undoDelete.dismissAndCommit}
      />
      {refillModalElement}
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    legend: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendText: { ...typography.overline, color: t.textTertiary, fontWeight: '500' },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusDotTaken: { backgroundColor: t.success },
    statusDotPartial: { backgroundColor: t.warning },
    statusDotMissed: { backgroundColor: t.error },
    statusDotPending: { backgroundColor: t.borderLight },
    list: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },
    card: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface,
      borderRadius: 14, padding: 14, gap: 12,
      shadowColor: t.shadow, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    },
    cardIcon: {
      width: 44, height: 44, borderRadius: 12, backgroundColor: t.accentLight,
      alignItems: 'center', justifyContent: 'center',
    },
    cardName: { ...typography.subhead, fontWeight: '700', color: t.text },
    cardSub: { ...typography.caption, color: t.textSecondary, marginTop: 2 },
    cardTimesRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    cardTimes: { ...typography.footnote, color: t.textTertiary },
    menuDots: { ...typography.heading, color: t.textTertiary, fontWeight: '700', paddingHorizontal: 4 },
    swipeDeleteAction: { justifyContent: 'center', alignItems: 'flex-end', width: 96 },
    swipeDeleteBtn: {
      flex: 1, backgroundColor: t.error, justifyContent: 'center', alignItems: 'center',
      width: 88, marginVertical: 4, borderRadius: 12, paddingHorizontal: 8, gap: 4,
    },
    swipeDeleteText: { ...typography.footnote, color: t.surface, fontWeight: '700' },
    swipeRefillAction: { justifyContent: 'center', alignItems: 'flex-start', width: 96 },
    swipeRefillBtn: {
      flex: 1, backgroundColor: t.accent, justifyContent: 'center', alignItems: 'center',
      width: 88, marginVertical: 4, borderRadius: 12, paddingHorizontal: 8, gap: 4,
    },
    swipeRefillBtnDisabled: { opacity: 0.5 },
    swipeRefillText: { ...typography.footnote, color: t.surface, fontWeight: '700' },
    refillBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    refillBadgeOk: { backgroundColor: t.accentLight },
    refillBadgeLow: { backgroundColor: t.error + '20' },
    refillBadgeText: { ...typography.overline, fontWeight: '700' },
    refillBadgeTextOk: { color: t.accent },
    refillBadgeTextLow: { color: t.error },
    interactionSeverityBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
      maxWidth: 108,
    },
    interactionSeverityBadgeText: {
      ...typography.overline,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    interactionLegendSamples: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    interactionLegendDot: { width: 8, height: 8, borderRadius: 4 },
    legendInfoText: { ...typography.overline, color: t.accent, fontWeight: '700', marginLeft: 2 },
    interactionInfoOverlay: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 16,
      gap: 10,
    },
    interactionInfoDismiss: {
      alignSelf: 'flex-end',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: t.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderLight,
    },
    interactionInfoDismissText: { ...typography.footnote, color: t.accent, fontWeight: '800' },
  });
}
