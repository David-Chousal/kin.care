import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Medication } from '../../../types';
import { useTheme, typography, type Theme } from '../../../theme';
import { useRefillMedication } from './useMedications';

export interface UseMedicationRefillPromptOptions {
  onSuccess?: (message: string) => void;
}

function refillSuccessMessage(qty: number) {
  return `Refilled — ${qty} remaining`;
}

type ApplyRefillResult = 'ok' | 'invalid' | 'error';

async function applyRefill(
  mutateAsync: (input: { id: string; quantity: number }) => Promise<unknown>,
  medication: Medication,
  raw: string | undefined,
  onSuccess?: (message: string) => void,
): Promise<ApplyRefillResult> {
  const qty = parseInt(raw ?? '', 10);
  if (Number.isNaN(qty) || qty < 0) {
    Alert.alert('Invalid quantity', 'Please enter a valid number.');
    return 'invalid';
  }
  try {
    await mutateAsync({ id: medication.id, quantity: qty });
    onSuccess?.(refillSuccessMessage(qty));
    return 'ok';
  } catch {
    Alert.alert('Refill failed', 'Could not update quantity. Please try again.');
    return 'error';
  }
}

export function useMedicationRefillPrompt({ onSuccess }: UseMedicationRefillPromptOptions = {}) {
  const mutation = useRefillMedication();
  const [androidMed, setAndroidMed] = useState<Medication | null>(null);
  const [androidDraft, setAndroidDraft] = useState('');

  const closeAndroid = useCallback(() => {
    setAndroidMed(null);
    setAndroidDraft('');
  }, []);

  const promptRefill = useCallback(
    (medication: Medication) => {
      if (medication.quantity_remaining == null) return;
      if (mutation.isPending) return;

      const defaultQty =
        medication.quantity_remaining != null ? String(medication.quantity_remaining) : '';

      if (Platform.OS === 'ios') {
        Alert.prompt(
          'Refill medication',
          `Enter the new quantity for ${medication.name}:`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Save',
              onPress: (value: string | undefined) =>
                applyRefill(mutation.mutateAsync, medication, value, onSuccess),
            },
          ],
          'plain-text',
          defaultQty,
          'number-pad',
        );
        return;
      }

      setAndroidDraft(defaultQty);
      setAndroidMed(medication);
    },
    [mutation.isPending, mutation.mutateAsync, onSuccess],
  );

  const submitAndroid = useCallback(async () => {
    if (!androidMed) return;
    const result = await applyRefill(mutation.mutateAsync, androidMed, androidDraft, onSuccess);
    if (result === 'ok') closeAndroid();
  }, [androidMed, androidDraft, closeAndroid, mutation.mutateAsync, onSuccess]);

  const refillModalElement = useMemo(() => {
    if (Platform.OS === 'ios' || !androidMed) return null;
    return (
      <AndroidRefillModal
        medicationName={androidMed.name}
        draft={androidDraft}
        onChangeDraft={setAndroidDraft}
        isPending={mutation.isPending}
        onCancel={closeAndroid}
        onSave={submitAndroid}
      />
    );
  }, [
    androidMed,
    androidDraft,
    closeAndroid,
    mutation.isPending,
    submitAndroid,
  ]);

  return {
    promptRefill,
    isPending: mutation.isPending,
    refillModalElement,
  };
}

function AndroidRefillModal({
  medicationName,
  draft,
  onChangeDraft,
  isPending,
  onCancel,
  onSave,
}: {
  medicationName: string;
  draft: string;
  onChangeDraft: (v: string) => void;
  isPending: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const t = useTheme();
  const styles = makeModalStyles(t);
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Refill medication</Text>
          <Text style={styles.body}>Enter the new quantity for {medicationName}:</Text>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={onChangeDraft}
            keyboardType="number-pad"
            editable={!isPending}
            autoFocus
          />
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onCancel} disabled={isPending}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, isPending && styles.btnDisabled]}
              onPress={onSave}
              disabled={isPending}
            >
              <Text style={styles.btnPrimaryText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeModalStyles(t: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    sheet: {
      backgroundColor: t.surface,
      borderRadius: 16,
      padding: 20,
      gap: 12,
    },
    title: { ...typography.subhead, fontWeight: '700', color: t.text },
    body: { ...typography.caption, color: t.textSecondary },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderLight,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 17,
      color: t.text,
    },
    row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
    btn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
    btnGhost: { backgroundColor: 'transparent' },
    btnGhostText: { ...typography.subhead, fontWeight: '600', color: t.textSecondary },
    btnPrimary: { backgroundColor: t.accent },
    btnPrimaryText: { ...typography.subhead, fontWeight: '700', color: t.surface },
    btnDisabled: { opacity: 0.5 },
  });
}
