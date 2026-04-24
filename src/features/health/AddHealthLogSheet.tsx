import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { FormSheet } from '../../components/FormSheet';
import { FormError } from '../../components/FormError';
import { useAuthStore } from '../../store/auth';
import {
  useAddHealthLog,
  useUpdateHealthLog,
  useHealthLogPhotoUrl,
  type HealthLogPhotoPatch,
} from './hooks/useHealthLogs';
import { useTheme, type Theme } from '../../theme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { HealthLog, HealthLogCategory } from '../../types';
import { errorMessageFromUnknown } from '../../lib/errorMessage';

interface Props {
  visible: boolean;
  onClose: () => void;
  editing?: HealthLog;
  /** Increment when opening the sheet to add/change a photo from the log list; triggers the image picker once. */
  photoPickerNonce?: number;
}

const CATEGORIES: { key: HealthLogCategory; label: string; mci: string }[] = [
  { key: 'symptom', label: 'Symptom', mci: 'thermometer' },
  { key: 'vital',   label: 'Vital',   mci: 'heart-pulse' },
  { key: 'mood',    label: 'Mood',    mci: 'emoticon-happy-outline' },
  { key: 'note',    label: 'Note',    mci: 'note-text-outline' },
];

const VITAL_PRESETS = ['Blood pressure', 'Heart rate', 'Temperature', 'Blood sugar', 'Weight', 'O2 saturation'];
const SYMPTOM_PRESETS = ['Pain', 'Nausea', 'Dizziness', 'Fatigue', 'Shortness of breath', 'Confusion'];
const MOOD_PRESETS = ['Cheerful', 'Calm', 'Anxious', 'Low mood', 'Irritable', 'Restless', 'Withdrawn'];

/** Caregiver quick-note starters (category Note); plain text in title + notes only. */
const NOTE_CAREGIVER_TEMPLATES = [
  { label: 'Energy Level', title: 'Energy Level', notesPrefix: 'Energy level: ' },
  { label: 'Pain', title: 'Pain', notesPrefix: 'Pain: ' },
  { label: 'Appetite', title: 'Appetite', notesPrefix: 'Appetite: ' },
] as const;

export function AddHealthLogSheet({ visible, onClose, editing, photoPickerNonce = 0 }: Props) {
  const t = useTheme();
  const styles = makeStyles(t);
  const { user } = useAuthStore();
  const userId = user?.id ?? null;
  const addLog = useAddHealthLog();
  const updateLog = useUpdateHealthLog();
  const lastHandledPhotoPickerNonce = useRef(0);

  const [category, setCategory] = useState<HealthLogCategory>('symptom');
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [pickedPhoto, setPickedPhoto] = useState<{ uri: string; mimeType: string } | null>(null);
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { data: existingPhotoUri } = useHealthLogPhotoUrl(
    editing?.photo_path && !removeExistingPhoto ? editing.photo_path : null
  );

  useEffect(() => {
    if (!visible) {
      lastHandledPhotoPickerNonce.current = 0;
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setFormError(null);
      setPickedPhoto(null);
      setRemoveExistingPhoto(false);
      if (editing) {
        setCategory(editing.category);
        setTitle(editing.title);
        setValue(editing.value ?? '');
        setUnit(editing.unit ?? '');
        setNotes(editing.notes ?? '');
      } else {
        setCategory('symptom'); setTitle(''); setValue(''); setUnit(''); setNotes('');
      }
    }
  }, [visible, editing?.id]);

  function reset() {
    setCategory('symptom'); setTitle(''); setValue(''); setUnit(''); setNotes('');
    setPickedPhoto(null);
    setRemoveExistingPhoto(false);
    setFormError(null);
  }

  const handlePickPhoto = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    setPickedPhoto({ uri: asset.uri, mimeType });
    setRemoveExistingPhoto(false);
  }, []);

  useEffect(() => {
    if (!visible || !editing || !photoPickerNonce || photoPickerNonce <= lastHandledPhotoPickerNonce.current) {
      return;
    }
    lastHandledPhotoPickerNonce.current = photoPickerNonce;
    const id = requestAnimationFrame(() => {
      void handlePickPhoto();
    });
    return () => cancelAnimationFrame(id);
  }, [visible, editing?.id, photoPickerNonce, handlePickPhoto]);

  async function handleSubmit() {
    setFormError(null);
    if (!title.trim()) {
      setFormError('Please enter a title.');
      return;
    }
    if (!editing && !user?.id) {
      Alert.alert('Session expired', 'Please sign in again to save this entry.');
      return;
    }

    try {
      if (editing) {
        let photo: HealthLogPhotoPatch;
        if (pickedPhoto) {
          photo = {
            mode: 'upload',
            uri: pickedPhoto.uri,
            mimeType: pickedPhoto.mimeType,
            replacePath: editing.photo_path ?? null,
          };
        } else if (removeExistingPhoto && editing.photo_path) {
          photo = { mode: 'clear', storagePath: editing.photo_path };
        } else {
          photo = { mode: 'unchanged' };
        }
        await updateLog.mutateAsync({
          id: editing.id,
          category,
          title: title.trim(),
          value: value.trim() || undefined,
          unit: unit.trim() || undefined,
          notes: notes.trim() || undefined,
          photo,
        });
      } else {
        await addLog.mutateAsync({
          category,
          title: title.trim(),
          value: value.trim() || undefined,
          unit: unit.trim() || undefined,
          notes: notes.trim() || undefined,
          logged_by: userId!,
          photo: pickedPhoto ?? undefined,
        });
      }

      reset();
      onClose();
    } catch (e) {
      setFormError(`Could not save. ${errorMessageFromUnknown(e)}`);
    }
  }

  const isPending = addLog.isPending || updateLog.isPending;
  const presets =
    category === 'vital' ? VITAL_PRESETS
    : category === 'symptom' ? SYMPTOM_PRESETS
    : category === 'mood' ? MOOD_PRESETS
    : [];

  return (
    <FormSheet
      visible={visible}
      title={editing ? 'Edit Entry' : 'Log Entry'}
      isSubmitting={isPending}
      onClose={() => { reset(); onClose(); }}
      onSubmit={handleSubmit}
    >
        <View style={styles.form}>
          <FormError message={formError} />
          <Text style={styles.label}>Category</Text>
          <View style={styles.chips}>
            {CATEGORIES.map(({ key, label, mci }) => {
              const active = category === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => { setCategory(key); if (!editing) setTitle(''); }}
                >
                  <MaterialCommunityIcons
                    name={mci as never}
                    size={16}
                    color={active ? t.surface : t.textSecondary}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {presets.length > 0 && !editing ? (
            <>
              <Text style={styles.label}>Quick Select</Text>
              <View style={styles.presetRow}>
                {presets.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.preset, title === p && styles.presetActive]}
                    onPress={() => setTitle(p)}
                  >
                    <Text style={[styles.presetText, title === p && styles.presetTextActive]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : category === 'note' && !editing ? (
            <>
              <Text style={styles.label}>Quick templates</Text>
              <View style={styles.presetRow}>
                {NOTE_CAREGIVER_TEMPLATES.map((tmpl) => (
                  <TouchableOpacity
                    key={tmpl.label}
                    style={[styles.preset, title === tmpl.title && styles.presetActive]}
                    onPress={() => {
                      setTitle(tmpl.title);
                      setNotes(tmpl.notesPrefix);
                      setValue('');
                      setUnit('');
                    }}
                  >
                    <Text style={[styles.presetText, title === tmpl.title && styles.presetTextActive]}>
                      {tmpl.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Lower back pain"
            value={title}
            onChangeText={(v) => { setTitle(v); setFormError(null); }}
            accessibilityLabel="Title"
            accessibilityHint={formError ?? undefined}
          />

          {(category === 'vital' || category === 'symptom') ? (
            <>
              <Text style={styles.label}>
                {category === 'vital' ? 'Reading' : 'Severity (1–10)'}
              </Text>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 2 }]}
                  placeholder={category === 'vital' ? 'e.g. 120/80' : 'e.g. 7'}
                  value={value}
                  onChangeText={setValue}
                  keyboardType="numbers-and-punctuation"
                />
                {category === 'vital' ? (
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Unit"
                    value={unit}
                    onChangeText={setUnit}
                  />
                ) : null}
              </View>
            </>
          ) : null}

          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Optional details…"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>Photo</Text>
          <Text style={styles.hint}>Optional — e.g. wound or skin changes to show a clinician.</Text>
          <View style={styles.photoRow}>
            <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto}>
              <MaterialCommunityIcons name="camera-plus-outline" size={20} color={t.accent} />
              <Text style={styles.photoBtnText}>{pickedPhoto ? 'Replace image' : 'Choose image'}</Text>
            </TouchableOpacity>
            {(pickedPhoto || (editing?.photo_path && !removeExistingPhoto)) ? (
              <TouchableOpacity
                onPress={() => {
                  if (pickedPhoto) setPickedPhoto(null);
                  else if (editing?.photo_path) setRemoveExistingPhoto(true);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.photoRemove}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {pickedPhoto ? (
            <Image source={{ uri: pickedPhoto.uri }} style={styles.photoPreview} resizeMode="cover" />
          ) : existingPhotoUri ? (
            <Image
              source={{ uri: existingPhotoUri }}
              style={styles.photoPreview}
              resizeMode="cover"
            />
          ) : null}
        </View>
    </FormSheet>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    form: { padding: 20, gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: t.textSecondary, marginTop: 12 },
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
    row: { flexDirection: 'row', gap: 10 },
    chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
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
    presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    preset: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: t.surfaceAlt },
    presetActive: { backgroundColor: t.accentLight },
    presetText: { fontSize: 13, color: t.textSecondary },
    presetTextActive: { color: t.accent, fontWeight: '600' },
    hint: { fontSize: 12, color: t.textTertiary, marginTop: 2, marginBottom: 4 },
    photoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    photoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    photoBtnText: { fontSize: 15, fontWeight: '600', color: t.accent },
    photoRemove: { fontSize: 15, fontWeight: '600', color: t.error },
    photoPreview: {
      width: '100%',
      height: 160,
      borderRadius: 12,
      marginTop: 10,
      backgroundColor: t.surfaceAlt,
    },
  });
}
