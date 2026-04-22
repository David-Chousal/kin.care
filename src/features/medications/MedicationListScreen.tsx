import { useCallback, useRef, useState, useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { showActionSheet } from '../../lib/actionSheet';
import { SkeletonList } from '../../components/SkeletonCard';
import { useMedications, useTodayMedLogs, useDeactivateMedication, computeDoseStatus, type MedLogsMap } from './hooks/useMedications';
import { useFamilyInteractionWarnings } from './hooks/useDrugInteractions';
import { AddMedicationSheet } from './AddMedicationSheet';
import { useTheme, typography, type Theme } from '../../theme';
import { Icon } from '../../components/Icon';
import type { Medication } from '../../types';
import type { MainStackParamList } from '../../navigation/types';
import { NativeHeaderTextButton } from '../../navigation/NativeHeaderTextButton';
import { EmptyState } from '../../components/EmptyState';

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

function InteractionBadge() {
  const t = useTheme();
  const styles = makeStyles(t);
  return (
    <View style={styles.interactionBadge}>
      <Icon name="warning" size={12} color={t.warning} />
    </View>
  );
}

function SwipeableMedicationCard({ med, onPress, onDelete, onMenu, todayLogs, hasInteraction }: { med: Medication; onPress: () => void; onDelete: () => void; onMenu: () => void; todayLogs: MedLogsMap; hasInteraction: boolean }) {
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
  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} rightThreshold={40}>
      <MedicationCard
        med={med}
        onPress={onPress}
        onMenu={onMenu}
        todayLogs={todayLogs}
        hasInteraction={hasInteraction}
        accessibilityLabel={medLabel}
        onA11yRemove={() => { swipeableRef.current?.close(); onDelete(); }}
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
  hasInteraction,
  accessibilityLabel,
  onA11yRemove,
}: {
  med: Medication;
  onPress: () => void;
  onMenu: () => void;
  todayLogs: MedLogsMap;
  hasInteraction: boolean;
  accessibilityLabel: string;
  onA11yRemove: () => void;
}) {
  const t = useTheme();
  const styles = makeStyles(t);
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Double tap to open details. Swipe up or down for actions."
      accessibilityActions={[
        { name: 'activate', label: 'Open details' },
        { name: 'edit', label: 'More actions' },
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
      {hasInteraction && <InteractionBadge />}
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
  const { interactingNames } = useFamilyInteractionWarnings(medications);
  const deactivate = useDeactivateMedication();
  const [showAdd, setShowAdd] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | undefined>(undefined);

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

  function showMenu(med: Medication) {
    showActionSheet(
      { options: ['Cancel', 'Edit', 'Remove'], destructiveButtonIndex: 2, cancelButtonIndex: 0 },
      (i) => {
        if (i === 1) { setEditingMed(med); setShowAdd(true); }
        if (i === 2) confirmRemove(med);
      },
    );
  }

  function confirmRemove(med: Medication) {
    Alert.alert('Remove Medication', `Remove "${med.name}" from the active list?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deactivate.mutate(med.id) },
    ]);
  }

  const legendHeader = (
    <View style={styles.legend}>
      <View style={styles.legendItem}><View style={[styles.statusDot, styles.statusDotTaken]} /><Text style={styles.legendText}>All doses taken</Text></View>
      <View style={styles.legendItem}><View style={[styles.statusDot, styles.statusDotPartial]} /><Text style={styles.legendText}>Partial</Text></View>
      <View style={styles.legendItem}><View style={[styles.statusDot, styles.statusDotMissed]} /><Text style={styles.legendText}>Missed</Text></View>
      <View style={styles.legendItem}><View style={[styles.statusDot, styles.statusDotPending]} /><Text style={styles.legendText}>Pending</Text></View>
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
              <SwipeableMedicationCard
                med={item}
                onPress={() => openDetail(item)}
                onDelete={() => confirmRemove(item)}
                onMenu={() => showMenu(item)}
                todayLogs={todayLogMap}
                hasInteraction={interactingNames.has(item.name.toLowerCase())}
              />
            )}
        />
      )}

      <AddMedicationSheet
        visible={showAdd}
        editing={editingMed}
        onClose={() => { setShowAdd(false); setEditingMed(undefined); }}
      />
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
      borderRadius: 14, padding: 14, marginBottom: 10, gap: 12,
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
    refillBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    refillBadgeOk: { backgroundColor: t.accentLight },
    refillBadgeLow: { backgroundColor: t.error + '20' },
    refillBadgeText: { ...typography.overline, fontWeight: '700' },
    refillBadgeTextOk: { color: t.accent },
    refillBadgeTextLow: { color: t.error },
    interactionBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: t.warning + '25',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
