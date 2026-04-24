import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { requestNotificationPermission } from '../notifications/requestNotificationPermission';
import { useAuthStore } from '../../store/auth';
import { useFamilyStore } from '../../store/family';
import { useAddMedication, useUpdateMedication, useMedications } from './hooks/useMedications';
import { useFamilyDoctors, useUpdateFamilyDoctor } from '../doctors/hooks/useFamilyDoctors';
import { checkAllInteractions, type MedicationInteractionResult } from './services/drugInteractionService';
import {
  useTheme,
  type Theme,
  navigationTitleTextStyle,
  spacing,
  typography,
  NAVIGATION_HEADER_TOOLBAR,
  NAVIGATION_HEADER_CHROME_PAD,
} from '../../theme';
import { BlurredHeaderBar } from '../../components/BlurredHeaderBar';
import { FormError } from '../../components/FormError';
import type { Medication, MedicationFrequencyType } from '../../types';
import { hapticSelection } from '../../lib/haptics';
import { DoseTimeWheelPicker } from './DoseTimeWheelPicker';
import {
  MAX_DOSE_TIMES,
  clampMinutes,
  dailyFrequencyLabel,
  inferFrequencyTypeFromLegacyFrequency,
  medicationStructuredScheduleFields,
  minutesFromTimeStrings,
  minutesToHHMM,
  sortUniqueHHMMFromMinutes,
  sortedUniqueDays,
  weeklyFrequencyLabel,
} from './scheduleUtils';

interface Props {
  visible: boolean;
  onClose: () => void;
  editing?: Medication;
}

type ScheduleMode = MedicationFrequencyType;

const WEEKDAYS: { d: number; label: string }[] = [
  { d: 0, label: 'Sun' },
  { d: 1, label: 'Mon' },
  { d: 2, label: 'Tue' },
  { d: 3, label: 'Wed' },
  { d: 4, label: 'Thu' },
  { d: 5, label: 'Fri' },
  { d: 6, label: 'Sat' },
];

const MODE_LABELS: Record<ScheduleMode, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  as_needed: 'As needed',
};

function coerceDaysFromMed(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return sortedUniqueDays(v.map((x) => Number(x)).filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6));
}

function scheduleModeFromMedication(m: Medication): ScheduleMode {
  return m.frequency_type ?? inferFrequencyTypeFromLegacyFrequency(m.frequency);
}

const DEFAULT_MINUTES = 9 * 60;

export function AddMedicationSheet({ visible, onClose, editing }: Props) {
  const t = useTheme();
  const styles = makeStyles(t);
  const { user } = useAuthStore();
  const family = useFamilyStore((s) => s.family);
  const addMedication = useAddMedication();
  const updateMedication = useUpdateMedication();
  const updateDoctor = useUpdateFamilyDoctor();
  const { data: existingMedications } = useMedications();
  const { data: doctors } = useFamilyDoctors();

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [notes, setNotes] = useState('');
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [timeMinutes, setTimeMinutes] = useState<number[]>([DEFAULT_MINUTES]);
  const [quantityRemaining, setQuantityRemaining] = useState('');
  const [refillThreshold, setRefillThreshold] = useState('');
  const [isCheckingInteractions, setIsCheckingInteractions] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [prescriberIds, setPrescriberIds] = useState<Set<string>>(() => new Set());
  const prescribersInitRef = useRef<string | null>(null);

  const hydrateFromMedication = useCallback((m: Medication) => {
    const mode = scheduleModeFromMedication(m);
    setScheduleMode(mode);
    setName(m.name);
    setDosage(m.dosage);
    setNotes(m.notes ?? '');
    setQuantityRemaining(m.quantity_remaining != null ? String(m.quantity_remaining) : '');
    setRefillThreshold(m.refill_threshold != null ? String(m.refill_threshold) : '');
    if (mode === 'as_needed') {
      setSelectedDays([]);
      setTimeMinutes([DEFAULT_MINUTES]);
    } else {
      setSelectedDays(coerceDaysFromMed(m.days_of_week));
      setTimeMinutes(minutesFromTimeStrings(m.times));
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setFormError(null);
    if (editing) {
      hydrateFromMedication(editing);
    } else {
      setName('');
      setDosage('');
      setNotes('');
      setScheduleMode('daily');
      setSelectedDays([]);
      setTimeMinutes([DEFAULT_MINUTES]);
      setQuantityRemaining('');
      setRefillThreshold('');
    }
  }, [visible, editing?.id, hydrateFromMedication]);

  useEffect(() => {
    if (!visible) {
      prescribersInitRef.current = null;
      return;
    }
    if (!editing) {
      if (prescribersInitRef.current !== 'new') {
        prescribersInitRef.current = 'new';
        setPrescriberIds(new Set());
      }
      return;
    }
    if (!doctors) return;
    if (prescribersInitRef.current === editing.id) return;
    prescribersInitRef.current = editing.id;
    setPrescriberIds(
      new Set(
        doctors
          .filter((d) => (d.linked_medication_ids ?? []).includes(editing.id))
          .map((d) => d.id),
      ),
    );
  }, [visible, editing, doctors]);

  function reset() {
    setName('');
    setDosage('');
    setNotes('');
    setScheduleMode('daily');
    setSelectedDays([]);
    setTimeMinutes([DEFAULT_MINUTES]);
    setQuantityRemaining('');
    setRefillThreshold('');
    setPrescriberIds(new Set());
    setFormError(null);
  }

  function togglePrescriber(doctorId: string) {
    hapticSelection();
    setPrescriberIds((prev) => {
      const next = new Set(prev);
      if (next.has(doctorId)) next.delete(doctorId);
      else next.add(doctorId);
      return next;
    });
  }

  async function syncPrescriberLinks(medicationId: string, selected: Set<string>) {
    const list = doctors ?? [];
    const tasks: Promise<unknown>[] = [];
    for (const doc of list) {
      const ids = doc.linked_medication_ids ?? [];
      const has = ids.includes(medicationId);
      const want = selected.has(doc.id);
      if (has === want) continue;
      const nextIds = want ? [...ids, medicationId] : ids.filter((i) => i !== medicationId);
      tasks.push(
        updateDoctor.mutateAsync({
          id: doc.id,
          name: doc.name,
          specialty: doc.specialty ?? undefined,
          phone: doc.phone ?? undefined,
          address: doc.address ?? undefined,
          next_appointment_at: doc.next_appointment_at,
          linked_medication_ids: nextIds,
        }),
      );
    }
    await Promise.all(tasks);
  }

  function toggleDay(d: number) {
    hapticSelection();
    setSelectedDays((prev) => {
      if (prev.includes(d)) return sortedUniqueDays(prev.filter((x) => x !== d));
      return sortedUniqueDays([...prev, d]);
    });
  }

  function setRowTimeParts(index: number, hour: number, minute: number) {
    setTimeMinutes((prev) => {
      const next = [...prev];
      next[index] = clampMinutes(hour * 60 + minute);
      return next;
    });
  }

  function addTimeRow() {
    hapticSelection();
    setTimeMinutes((prev) => {
      if (prev.length >= MAX_DOSE_TIMES) return prev;
      const last = prev[prev.length - 1] ?? DEFAULT_MINUTES;
      return [...prev, clampMinutes(last)];
    });
  }

  function removeTimeRow(index: number) {
    hapticSelection();
    setTimeMinutes((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

  function buildPayload(): {
    frequency: string;
    times: string[] | null;
    parsedQty: number | null;
    parsedThreshold: number | null;
  } | null {
    let frequency: string;
    let times: string[] | null;

    if (scheduleMode === 'as_needed') {
      frequency = 'As needed';
      times = null;
    } else if (scheduleMode === 'weekly') {
      const sortedTimes = sortUniqueHHMMFromMinutes(timeMinutes);
      times = sortedTimes;
      frequency = weeklyFrequencyLabel(sortedUniqueDays(selectedDays));
    } else {
      const sortedTimes = sortUniqueHHMMFromMinutes(timeMinutes);
      times = sortedTimes;
      frequency = dailyFrequencyLabel(sortedTimes.length);
    }

    const parsedQty = quantityRemaining.trim() ? parseInt(quantityRemaining.trim(), 10) : null;
    const parsedThreshold = refillThreshold.trim() ? parseInt(refillThreshold.trim(), 10) : null;

    return { frequency, times, parsedQty, parsedThreshold };
  }

  async function saveMedication(
    frequency: string,
    times: string[] | null,
    parsedQty: number | null,
    parsedThreshold: number | null,
    prescribersSnapshot: Set<string>,
  ) {
    if (!user?.id) return;
    const structured = medicationStructuredScheduleFields(scheduleMode, timeMinutes, selectedDays);
    try {
      if (editing) {
        await updateMedication.mutateAsync({
          id: editing.id,
          name: name.trim(),
          dosage: dosage.trim(),
          frequency,
          times: structured.times,
          frequency_type: structured.frequency_type,
          times_per_day: structured.times_per_day,
          days_of_week: structured.days_of_week,
          notes: notes.trim() || undefined,
          quantity_remaining: parsedQty,
          refill_threshold: parsedThreshold,
        });
        try {
          await syncPrescriberLinks(editing.id, prescribersSnapshot);
        } catch {
          Alert.alert(
            'Prescriber link',
            'Medication was saved. You can link or fix prescribers from the Doctors screen.',
          );
        }
      } else {
        const created = await addMedication.mutateAsync({
          name: name.trim(),
          dosage: dosage.trim(),
          frequency,
          times: structured.times,
          frequency_type: structured.frequency_type,
          times_per_day: structured.times_per_day,
          days_of_week: structured.days_of_week,
          notes: notes.trim() || undefined,
          created_by: user.id,
          quantity_remaining: parsedQty,
          refill_threshold: parsedThreshold,
        });
        try {
          await syncPrescriberLinks(created.id, prescribersSnapshot);
        } catch {
          Alert.alert(
            'Prescriber link',
            'Medication was saved. You can link this medication to a doctor from the Doctors screen.',
          );
        }
        // Prompt for notification permission after saving a scheduled medication.
        // Closes the sheet first so the rationale isn't buried under the modal.
        if (scheduleMode !== 'as_needed') {
          reset();
          onClose();
          await requestNotificationPermission('medication_alert');
          return;
        }
      }
      reset();
      onClose();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
          ? (e as { message: string }).message
          : 'Something went wrong. Please try again.';
      setFormError(`Could not save medication. ${msg}`);
    }
  }

  function showInteractionAlert(
    interactions: MedicationInteractionResult[],
    onProceed: () => void,
  ) {
    const hasSevere = interactions.some((i) => i.severity === 'severe');
    const title = hasSevere ? 'Severe Interaction Warning' : 'Interaction Warning';
    const lines = interactions
      .map((i) => {
        const other = i.medicationName1.toLowerCase() === name.trim().toLowerCase()
          ? i.medicationName2
          : i.medicationName1;
        const src = i.source === 'rxnorm' ? 'RxNorm' : 'AI';
        return `${other} (${i.severity}) [${src}]: ${i.description}`;
      })
      .join('\n\n');

    Alert.alert(
      title,
      [
        `${name.trim()} may interact with:`,
        '',
        lines,
        '',
        'This is a screening check, not medical advice. Verify with a pharmacist or clinician.',
        'Do not start, stop, or change medications based on this alone.',
        'If you think this may be an emergency, call local emergency services.',
      ].join('\n'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: hasSevere ? 'Add Anyway' : 'Continue',
          style: hasSevere ? 'destructive' : 'default',
          onPress: onProceed,
        },
      ],
    );
  }

  async function handleSubmit() {
    setFormError(null);
    if (!name.trim()) {
      setFormError('Medication name is required.');
      return;
    }
    if (!dosage.trim()) {
      setFormError('Dosage is required. For example: 10mg or 2 pills.');
      return;
    }
    if (scheduleMode === 'weekly' && selectedDays.length === 0) {
      setFormError('Select at least one day for a weekly schedule.');
      return;
    }
    if (scheduleMode !== 'as_needed' && timeMinutes.length === 0) {
      setFormError('Add at least one dose time.');
      return;
    }

    const payload = buildPayload();
    if (!payload) return;
    const { frequency, times, parsedQty, parsedThreshold } = payload;

    if (times !== null && times.length === 0) {
      setFormError('Add at least one dose time.');
      return;
    }

    if (!user?.id) {
      setFormError('You need to be signed in to save a medication.');
      return;
    }
    if (parsedQty !== null && (isNaN(parsedQty) || parsedQty < 0)) {
      setFormError('Quantity must be zero or a positive number.');
      return;
    }
    if (parsedThreshold !== null && (isNaN(parsedThreshold) || parsedThreshold < 0)) {
      setFormError('Refill alert threshold must be zero or a positive number.');
      return;
    }

    const prescribersSnapshot = new Set(prescriberIds);
    const proceed = () => saveMedication(frequency, times, parsedQty, parsedThreshold, prescribersSnapshot);

    // Only check interactions when adding (not editing) and there are existing meds
    if (!editing && existingMedications && existingMedications.length > 0) {
      setIsCheckingInteractions(true);
      try {
        const existingForCheck = existingMedications.map((m) => ({ id: m.id, name: m.name }));
        const fid = family?.id ?? existingMedications[0]?.family_id;
        if (!fid) {
          setIsCheckingInteractions(false);
          await proceed();
          return;
        }
        const interactions = await checkAllInteractions(name.trim(), existingForCheck, fid);
        setIsCheckingInteractions(false);
        if (interactions.length > 0) {
          showInteractionAlert(interactions, proceed);
          return;
        }
      } catch {
        setIsCheckingInteractions(false);
        // Don't block saving if the interaction check itself fails
      }
    }

    await proceed();
  }

  const isPending =
    addMedication.isPending || updateMedication.isPending || updateDoctor.isPending || isCheckingInteractions;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <ScrollView
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <View style={styles.dragHandle} />
        <BlurredHeaderBar style={styles.header} contentStyle={styles.headerInner}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{editing ? 'Edit Medication' : 'Add Medication'}</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isPending}>
            <Text style={[styles.save, isPending && styles.disabled]}>
              {isCheckingInteractions ? 'Checking…' : (addMedication.isPending || updateMedication.isPending || updateDoctor.isPending) ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </BlurredHeaderBar>

        <View style={styles.form}>
          <FormError message={formError} />
          <Text style={styles.label}>Medication Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Lisinopril"
            value={name}
            onChangeText={(v) => { setName(v); if (formError) setFormError(null); }}
            accessibilityLabel="Medication name"
          />

          <Text style={styles.label}>Dosage *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 10mg, 2 pills"
            value={dosage}
            onChangeText={(v) => { setDosage(v); if (formError) setFormError(null); }}
            accessibilityLabel="Dosage"
          />

          <Text style={styles.sectionHeader}>Refill Tracking (optional)</Text>
          <View style={styles.refillRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Current quantity</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 30"
                value={quantityRemaining}
                onChangeText={setQuantityRemaining}
                keyboardType="number-pad"
                returnKeyType="done"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Alert when below</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 7"
                value={refillThreshold}
                onChangeText={setRefillThreshold}
                keyboardType="number-pad"
                returnKeyType="done"
              />
            </View>
          </View>

          <Text style={styles.sectionHeader}>Prescriber (optional)</Text>
          <Text style={styles.reminderHint}>
            Link this medication to one or more doctors. You can also manage links from the Doctors tab.
          </Text>
          {!doctors || doctors.length === 0 ? (
            <Text style={styles.emptyDoctorsHint}>
              No doctors yet — add them under Doctors, then you can link prescribers here.
            </Text>
          ) : (
            <View style={styles.chips}>
              {doctors.map((doc) => {
                const selected = prescriberIds.has(doc.id);
                return (
                  <TouchableOpacity
                    key={doc.id}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => togglePrescriber(doc.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${doc.name}${selected ? ', selected as prescriber' : ''}`}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]} numberOfLines={1}>
                      {doc.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={styles.label}>Schedule</Text>
          <View style={styles.segmentBar}>
            {(['daily', 'weekly', 'as_needed'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.segment, scheduleMode === mode && styles.segmentActive]}
                onPress={() => {
                  hapticSelection();
                  setScheduleMode(mode);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: scheduleMode === mode }}
                accessibilityLabel={MODE_LABELS[mode]}
              >
                <Text
                  style={[styles.segmentText, scheduleMode === mode && styles.segmentTextActive]}
                  numberOfLines={1}
                >
                  {MODE_LABELS[mode]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {scheduleMode === 'weekly' ? (
            <>
              <Text style={styles.label}>Days</Text>
              <View style={styles.chips}>
                {WEEKDAYS.map(({ d, label }) => {
                  const selected = selectedDays.includes(d);
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() => toggleDay(d)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${label}${selected ? ', selected' : ''}`}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : null}

          {scheduleMode !== 'as_needed' ? (
            <>
              <Text style={styles.label}>Times</Text>
              <Text style={styles.reminderHint}>
                When medication alerts are on, we notify you at each dose time below. Change times here anytime.
              </Text>
              {timeMinutes.map((mins, index) => (
                <View key={index} style={styles.timeRow}>
                  <Text
                    style={styles.timeRowLabel}
                    accessibilityLabel={`Dose ${index + 1} time`}
                  >
                    Dose {index + 1}
                  </Text>
                  <Text style={styles.timePreviewLarge}>{minutesToHHMM(mins)}</Text>
                  <DoseTimeWheelPicker
                    minutes={mins}
                    doseIndex={index}
                    accentColor={t.accent}
                    onChange={(hour, minute) => setRowTimeParts(index, hour, minute)}
                  />
                  {timeMinutes.length > 1 ? (
                    <TouchableOpacity
                      style={styles.removeRowBtn}
                      onPress={() => removeTimeRow(index)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove dose ${index + 1}`}
                    >
                      <Text style={styles.removeRowText}>Remove</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              {timeMinutes.length < MAX_DOSE_TIMES ? (
                <TouchableOpacity
                  style={styles.addTimeBtn}
                  onPress={addTimeRow}
                  accessibilityRole="button"
                  accessibilityLabel="Add dose"
                >
                  <Text style={styles.addTimeText}>+ Add dose</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}

          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="e.g. Take with food"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>
    </Modal>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    dragHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.borderLight,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 4,
    },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: NAVIGATION_HEADER_CHROME_PAD,
    },
    headerInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: NAVIGATION_HEADER_TOOLBAR,
    },
    cancel: { ...typography.callout, color: t.textSecondary, minWidth: 56 },
    title: { ...navigationTitleTextStyle(t), flex: 1, textAlign: 'center' },
    save: { ...typography.callout, fontWeight: '700', color: t.accent, minWidth: 56, textAlign: 'right' },
    disabled: { opacity: 0.5 },
    form: { padding: 20, gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: t.textSecondary, marginTop: 12 },
    reminderHint: {
      fontSize: 12,
      lineHeight: 16,
      color: t.textTertiary,
      marginTop: 4,
      marginBottom: 2,
    },
    input: {
      backgroundColor: t.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: t.text,
    },
    multiline: { height: 80, textAlignVertical: 'top' },
    segmentBar: {
      flexDirection: 'row',
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.border,
      marginTop: 4,
    },
    segment: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 6,
      backgroundColor: t.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentActive: { backgroundColor: t.accent },
    segmentText: { ...typography.footnote, color: t.textSecondary, fontWeight: '600' },
    segmentTextActive: { color: t.surface },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    chipActive: { backgroundColor: t.accent, borderColor: t.accent },
    chipText: { fontSize: 14, color: t.textSecondary },
    chipTextActive: { color: t.surface, fontWeight: '600' },
    timeRow: {
      marginTop: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    timeRowLabel: { fontSize: 12, fontWeight: '600', color: t.textSecondary, marginBottom: 4 },
    timePreviewLarge: {
      fontSize: 22,
      fontWeight: '700',
      color: t.accent,
      marginBottom: 8,
      fontVariant: ['tabular-nums'],
      textAlign: 'center',
    },
    removeRowBtn: { alignSelf: 'flex-end', marginTop: 8 },
    removeRowText: { fontSize: 14, fontWeight: '600', color: t.error },
    addTimeBtn: { marginTop: 10, alignSelf: 'flex-start', paddingVertical: 8 },
    addTimeText: { fontSize: 15, fontWeight: '600', color: t.accent },
    sectionHeader: {
      fontSize: 13, fontWeight: '700', color: t.textTertiary,
      textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 16, marginBottom: 2,
    },
    refillRow: { flexDirection: 'row', gap: 12 },
    emptyDoctorsHint: {
      fontSize: 14,
      color: t.textTertiary,
      marginTop: 4,
      lineHeight: 20,
    },
  });
}
