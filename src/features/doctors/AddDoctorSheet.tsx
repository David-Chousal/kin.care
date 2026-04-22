import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FormSheet } from '../../components/FormSheet';
import { FormError } from '../../components/FormError';
import { useAuthStore } from '../../store/auth';
import { useMedications } from '../medications/hooks/useMedications';
import {
  useAddFamilyDoctor,
  useUpdateFamilyDoctor,
} from './hooks/useFamilyDoctors';
import { useTheme, type Theme } from '../../theme';
import { Icon } from '../../components/Icon';
import type { FamilyDoctor } from '../../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  editing?: FamilyDoctor;
}

export function AddDoctorSheet({ visible, onClose, editing }: Props) {
  const t = useTheme();
  const styles = makeStyles(t);
  const { user } = useAuthStore();
  const { data: medications = [] } = useMedications();
  const addDoctor = useAddFamilyDoctor();
  const updateDoctor = useUpdateFamilyDoctor();

  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [hasNextAppt, setHasNextAppt] = useState(false);
  const [apptDate, setApptDate] = useState(new Date());
  const [includeTime, setIncludeTime] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(() => new Set());
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setFormError(null);
    setShowDatePicker(false);
    setShowTimePicker(false);
    if (editing) {
      setName(editing.name);
      setSpecialty(editing.specialty ?? '');
      setPhone(editing.phone ?? '');
      setAddress(editing.address ?? '');
      if (editing.next_appointment_at) {
        setHasNextAppt(true);
        const d = new Date(editing.next_appointment_at);
        setApptDate(d);
        setIncludeTime(d.getHours() !== 0 || d.getMinutes() !== 0);
      } else {
        setHasNextAppt(false);
        setApptDate(new Date());
        setIncludeTime(true);
      }
      setLinkedIds(new Set(editing.linked_medication_ids ?? []));
    } else {
      setName('');
      setSpecialty('');
      setPhone('');
      setAddress('');
      setHasNextAppt(false);
      setApptDate(new Date());
      setIncludeTime(true);
      setLinkedIds(new Set());
    }
  }, [visible, editing?.id]);

  function reset() {
    setName('');
    setSpecialty('');
    setPhone('');
    setAddress('');
    setHasNextAppt(false);
    setApptDate(new Date());
    setIncludeTime(true);
    setLinkedIds(new Set());
    setShowDatePicker(false);
    setShowTimePicker(false);
    setFormError(null);
  }

  function toggleMed(id: string) {
    setLinkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    setFormError(null);
    if (!name.trim()) {
      setFormError("Please enter the doctor's name.");
      return;
    }
    const nextIso = hasNextAppt
      ? (includeTime
        ? apptDate.toISOString()
        : new Date(apptDate.getFullYear(), apptDate.getMonth(), apptDate.getDate()).toISOString())
      : null;
    const medIds = [...linkedIds];

    if (editing) {
      await updateDoctor.mutateAsync({
        id: editing.id,
        name: name.trim(),
        specialty: specialty.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        next_appointment_at: nextIso,
        linked_medication_ids: medIds,
      });
    } else {
      await addDoctor.mutateAsync({
        name: name.trim(),
        specialty: specialty.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        next_appointment_at: nextIso,
        linked_medication_ids: medIds,
        created_by: user!.id,
      });
    }
    reset();
    onClose();
  }

  const isPending = addDoctor.isPending || updateDoctor.isPending;
  const dateLabel = apptDate.toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });
  const timeLabel = apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <FormSheet
      visible={visible}
      title={editing ? 'Edit Doctor' : 'Add Doctor'}
      isSubmitting={isPending}
      submitDisabled={!name.trim()}
      onClose={() => { reset(); onClose(); }}
      onSubmit={handleSubmit}
    >
      <View style={styles.form}>
          <FormError message={formError} />
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Dr. Rivera"
            placeholderTextColor={t.textTertiary}
            value={name}
            onChangeText={(v) => { setName(v); setFormError(null); }}
            autoCapitalize="words"
            accessibilityLabel="Doctor name"
            accessibilityState={formError ? { invalid: true } : undefined}
          />

          <Text style={styles.label}>Specialty</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Cardiology"
            placeholderTextColor={t.textTertiary}
            value={specialty}
            onChangeText={setSpecialty}
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="Office or after-hours line"
            placeholderTextColor={t.textTertiary}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Address</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Practice address (optional)"
            placeholderTextColor={t.textTertiary}
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={3}
          />

          <View style={styles.row}>
            <Text style={styles.labelInline}>Next appointment</Text>
            <TouchableOpacity
              style={[styles.toggle, hasNextAppt && styles.toggleOn]}
              onPress={() => setHasNextAppt(!hasNextAppt)}
              accessibilityRole="switch"
              accessibilityState={{ checked: hasNextAppt }}
            >
              <View style={[styles.toggleThumb, hasNextAppt && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>

          {hasNextAppt ? (
            <>
              <TouchableOpacity style={styles.pickerButton} onPress={() => setShowDatePicker(true)}>
                <Icon name="calendar" size={18} color={t.textSecondary} />
                <Text style={styles.pickerText}>{dateLabel}</Text>
              </TouchableOpacity>
              {showDatePicker ? (
                <DateTimePicker
                  value={apptDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(_, selected) => {
                    if (Platform.OS === 'android') setShowDatePicker(false);
                    if (selected) setApptDate(selected);
                  }}
                />
              ) : null}
              {Platform.OS === 'ios' && showDatePicker ? (
                <TouchableOpacity style={styles.pickerDone} onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.row}>
                <Text style={styles.labelInline}>Include time</Text>
                <TouchableOpacity
                  style={[styles.toggle, includeTime && styles.toggleOn]}
                  onPress={() => setIncludeTime(!includeTime)}
                >
                  <View style={[styles.toggleThumb, includeTime && styles.toggleThumbOn]} />
                </TouchableOpacity>
              </View>

              {includeTime ? (
                <>
                  <TouchableOpacity style={styles.pickerButton} onPress={() => setShowTimePicker(true)}>
                    <Icon name="clock" size={18} color={t.textSecondary} />
                    <Text style={styles.pickerText}>{timeLabel}</Text>
                  </TouchableOpacity>
                  {showTimePicker ? (
                    <DateTimePicker
                      value={apptDate}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(_, selected) => {
                        if (Platform.OS === 'android') setShowTimePicker(false);
                        if (selected) setApptDate(selected);
                      }}
                    />
                  ) : null}
                  {Platform.OS === 'ios' && showTimePicker ? (
                    <TouchableOpacity style={styles.pickerDone} onPress={() => setShowTimePicker(false)}>
                      <Text style={styles.pickerDoneText}>Done</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}

          <Text style={styles.label}>Linked medications</Text>
          <Text style={styles.hint}>
            Tap meds this doctor manages (e.g. cardiologist for blood pressure medication).
          </Text>
          {medications.length === 0 ? (
            <Text style={styles.emptyMeds}>No active medications yet — add some under Medications first.</Text>
          ) : (
            <View style={styles.medChips}>
              {medications.map((m) => {
                const on = linkedIds.has(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.medChip, on && styles.medChipOn]}
                    onPress={() => toggleMed(m.id)}
                  >
                    <Text style={[styles.medChipText, on && styles.medChipTextOn]} numberOfLines={1}>
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
    </FormSheet>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    form: { paddingBottom: 24, gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: t.textSecondary, marginTop: 14 },
    labelInline: { fontSize: 13, fontWeight: '600', color: t.textSecondary },
    hint: { fontSize: 12, color: t.textTertiary, marginTop: 4, lineHeight: 17 },
    emptyMeds: { fontSize: 13, color: t.textTertiary, marginTop: 8, fontStyle: 'italic' },
    input: {
      backgroundColor: t.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: t.text,
      marginTop: 6,
    },
    multiline: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
    },
    toggle: {
      width: 48,
      height: 28,
      borderRadius: 14,
      backgroundColor: t.border,
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    toggleOn: { backgroundColor: t.accent },
    toggleThumb: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: t.surface,
      shadowColor: t.shadow,
      shadowOpacity: 0.15,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    },
    toggleThumbOn: { alignSelf: 'flex-end' },
    pickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: t.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 16,
      paddingVertical: 13,
      marginTop: 8,
    },
    pickerText: { fontSize: 15, color: t.text },
    pickerDone: { alignItems: 'flex-end', paddingTop: 8 },
    pickerDoneText: { fontSize: 15, color: t.accent, fontWeight: '600' },
    medChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    medChip: {
      maxWidth: '100%',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    medChipOn: { backgroundColor: t.accentLight, borderColor: t.accent },
    medChipText: { fontSize: 13, color: t.textSecondary, fontWeight: '500' },
    medChipTextOn: { color: t.accent, fontWeight: '700' },
  });
}
