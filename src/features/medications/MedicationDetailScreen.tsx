import { useState, useLayoutEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { hapticNotification, NotificationFeedbackType } from '../../lib/haptics';
import { Toast } from '../../components/Toast';
import { useAuthStore } from '../../store/auth';
import { useMedicationLogs, useLogDose, useDeactivateMedication, useRefillMedication } from './hooks/useMedications';
import { useTheme, type Theme } from '../../theme';
import { Icon } from '../../components/Icon';
import type { Medication, MedicationLog } from '../../types';
import type { MainStackParamList } from '../../navigation/types';
import { NativeHeaderTextButton } from '../../navigation/NativeHeaderTextButton';

interface Props { medication: Medication; }

function LogRow({ log }: { log: MedicationLog }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const STATUS_COLOR = { taken: t.success, missed: t.error, pending: t.warning };
  const d = new Date(log.scheduled_at);
  return (
    <View style={styles.logRow}>
      <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[log.status as keyof typeof STATUS_COLOR] }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.logDate}>
          {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
          {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </Text>
        {log.notes ? <Text style={styles.logNotes}>{log.notes}</Text> : null}
      </View>
      <View style={[styles.statusPill, { backgroundColor: (STATUS_COLOR[log.status as keyof typeof STATUS_COLOR] ?? t.textTertiary) + '20' }]}>
        <Text style={[styles.statusLabel, { color: STATUS_COLOR[log.status as keyof typeof STATUS_COLOR] }]}>
          {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
        </Text>
      </View>
    </View>
  );
}

export function MedicationDetailScreen({ medication }: Props) {
  const t = useTheme();
  const styles = makeStyles(t);
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user } = useAuthStore();
  const { data: logs, isLoading, isFetching, refetch } = useMedicationLogs(medication.id);
  const logDose = useLogDose();
  const { mutateAsync: deactivateMedication } = useDeactivateMedication();
  const refillMedication = useRefillMedication();
  const [logging, setLogging] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '' });

  const confirmRemove = useCallback(() => {
    Alert.alert('Remove Medication', `Remove ${medication.name} from the active list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deactivateMedication(medication.id);
          navigation.goBack();
        },
      },
    ]);
  }, [medication.name, medication.id, navigation, deactivateMedication]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: medication.name,
      headerRight: () => (
        <NativeHeaderTextButton label="Remove" onPress={confirmRemove} destructive />
      ),
    });
  }, [navigation, medication.name, confirmRemove]);

  async function handleLogDose(status: 'taken' | 'missed') {
    hapticNotification(
      status === 'taken' ? NotificationFeedbackType.Success : NotificationFeedbackType.Warning
    );
    setLogging(true);
    await logDose.mutateAsync({
      medication_id: medication.id,
      medication_name: medication.name,
      scheduled_at: new Date().toISOString(),
      status,
      logged_by: user!.id,
      quantity_remaining: medication.quantity_remaining ?? null,
      refill_threshold: medication.refill_threshold ?? null,
    });
    setLogging(false);
    setToast({ visible: true, message: status === 'taken' ? 'Dose logged' : 'Dose marked as missed' });
  }

  function handleRefill() {
    Alert.prompt(
      'Refill medication',
      `Enter the new quantity for ${medication.name}:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (value: string | undefined) => {
            const qty = parseInt(value ?? '', 10);
            if (isNaN(qty) || qty < 0) {
              Alert.alert('Invalid quantity', 'Please enter a valid number.');
              return;
            }
            await refillMedication.mutateAsync({ id: medication.id, quantity: qty });
            setToast({ visible: true, message: `Refilled — ${qty} remaining` });
          },
        },
      ],
      'plain-text',
      medication.quantity_remaining != null ? String(medication.quantity_remaining) : '',
      'number-pad',
    );
  }

  const listHeader = (
    <View>
      <View style={styles.info}>
        <Text style={styles.infoText}>{medication.dosage} · {medication.frequency}</Text>
        {medication.times && medication.times.length > 0 ? (
          <View style={styles.infoSubRow}>
            <Icon name="clock" size={14} color={t.textSecondary} />
            <Text style={styles.infoSub}>{medication.times.join(', ')}</Text>
          </View>
        ) : null}
        {medication.notes ? (
          <View style={styles.infoSubRow}>
            <Icon name="edit" size={14} color={t.textSecondary} />
            <Text style={styles.infoSub}>{medication.notes}</Text>
          </View>
        ) : null}
        {medication.quantity_remaining != null ? (
          <View style={styles.refillRow}>
            <View style={[
              styles.quantityBadge,
              medication.refill_threshold != null && medication.quantity_remaining <= medication.refill_threshold
                ? styles.quantityBadgeLow
                : styles.quantityBadgeOk,
            ]}>
              <Text style={styles.quantityBadgeText}>
                {medication.quantity_remaining} remaining
              </Text>
            </View>
            <TouchableOpacity style={styles.refillBtn} onPress={handleRefill}>
              <Text style={styles.refillBtnText}>Refill</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={styles.logButtons}>
        <TouchableOpacity
          style={[styles.logBtn, styles.logBtnTaken, logging && styles.logBtnDisabled]}
          onPress={() => handleLogDose('taken')}
          disabled={logging}
        >
          <Icon name="check" size={16} color="#FFFFFF" />
          <Text style={styles.logBtnText}>Taken</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.logBtn, styles.logBtnMissed, logging && styles.logBtnDisabled]}
          onPress={() => handleLogDose('missed')}
          disabled={logging}
        >
          <Icon name="close" size={16} color="#FFFFFF" />
          <Text style={styles.logBtnText}>Missed</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>Recent Doses</Text>
      {isLoading ? <ActivityIndicator style={{ marginTop: 20 }} color={t.accent} /> : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        style={{ flex: 1 }}
        data={isLoading ? [] : (logs ?? [])}
        keyExtractor={(l) => l.id}
        ListHeaderComponent={listHeader}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          { paddingHorizontal: 16, paddingBottom: 40 },
          { paddingTop: 12 },
        ]}
        refreshing={isFetching && !isLoading}
        onRefresh={refetch}
        ListEmptyComponent={
          isLoading ? null : <Text style={styles.empty}>No doses logged yet.</Text>
        }
        renderItem={({ item }) => <LogRow log={item} />}
      />
      <Toast message={toast.message} visible={toast.visible} onHide={() => setToast({ visible: false, message: '' })} />
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    info: {
      backgroundColor: t.surface, padding: 16, marginHorizontal: 16, marginTop: 16,
      borderRadius: 14, gap: 6,
      shadowColor: t.shadow, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    },
    infoText: { fontSize: 16, fontWeight: '600', color: t.text },
    infoSub: { fontSize: 14, color: t.textSecondary },
    infoSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    logButtons: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 14, marginBottom: 4 },
    logBtn: { flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    logBtnTaken: { backgroundColor: t.success },
    logBtnMissed: { backgroundColor: t.error },
    logBtnDisabled: { opacity: 0.5 },
    logBtnText: { color: t.surface, fontSize: 15, fontWeight: '700' },
    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: t.textTertiary,
      textTransform: 'uppercase', letterSpacing: 0.8,
      marginHorizontal: 16, marginTop: 20, marginBottom: 10,
    },
    logRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface,
      borderRadius: 12, padding: 14, marginBottom: 8, gap: 12,
    },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    logDate: { fontSize: 14, color: t.text, fontWeight: '500' },
    logNotes: { fontSize: 12, color: t.textTertiary, marginTop: 2 },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    statusLabel: { fontSize: 12, fontWeight: '700' },
    empty: { textAlign: 'center', color: t.textTertiary, marginTop: 20, fontSize: 15 },
    refillRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
    quantityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    quantityBadgeOk: { backgroundColor: t.accentLight },
    quantityBadgeLow: { backgroundColor: t.error + '20' },
    quantityBadgeText: { fontSize: 13, fontWeight: '600', color: t.text },
    refillBtn: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: t.accent },
    refillBtnText: { fontSize: 13, fontWeight: '700', color: t.accent },
  });
}
