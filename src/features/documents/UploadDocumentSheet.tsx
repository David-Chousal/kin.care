import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useAuthStore } from '../../store/auth';
import { useUploadDocument } from './hooks/useDocuments';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { DocumentCategory } from '../../types';
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
import { errorMessageFromUnknown } from '../../lib/errorMessage';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function UploadProgressBar({ active }: { active: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      progress.setValue(0);
      Animated.timing(progress, { toValue: 0.85, duration: 2000, useNativeDriver: false }).start();
    } else {
      Animated.timing(progress, { toValue: 1, duration: 200, useNativeDriver: false }).start(() => {
        progress.setValue(0);
      });
    }
  }, [active]);

  if (!active) return null;

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={progressStyles.track}>
      <Animated.View style={[progressStyles.bar, { width }]} />
      <Text style={progressStyles.label}>Uploading…</Text>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  track: { height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginHorizontal: 20, marginBottom: 8, overflow: 'hidden' },
  bar: { height: 4, backgroundColor: '#4F6BED', borderRadius: 2 },
  label: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 6, marginBottom: 4 },
});

const CATEGORIES: { key: DocumentCategory; label: string; mci: string }[] = [
  { key: 'medical', label: 'Medical', mci: 'medical-bag' },
  { key: 'legal', label: 'Legal', mci: 'scale-balance' },
  { key: 'insurance', label: 'Insurance', mci: 'shield-check' },
  { key: 'general', label: 'General', mci: 'folder-outline' },
];

export function UploadDocumentSheet({ visible, onClose }: Props) {
  const t = useTheme();
  const styles = makeStyles(t);
  const { user } = useAuthStore();
  const upload = useUploadDocument();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('medical');
  const [formError, setFormError] = useState<string | null>(null);
  const [pickedFile, setPickedFile] = useState<{
    uri: string;
    name: string;
    mimeType: string;
    size: number;
  } | null>(null);

  function reset() {
    setName('');
    setCategory('medical');
    setPickedFile(null);
    setFormError(null);
  }

  useEffect(() => {
    if (visible) setFormError(null);
  }, [visible]);

  async function handlePick() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFormError(null);
    setPickedFile({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      size: asset.size ?? 0,
    });
    if (!name) setName(asset.name.replace(/\.[^.]+$/, ''));
  }

  async function handleSubmit() {
    setFormError(null);
    if (!pickedFile) {
      setFormError('Please select a file first.');
      return;
    }
    if (!name.trim()) {
      setFormError('Please enter a document name.');
      return;
    }

    try {
      await upload.mutateAsync({
        name: name.trim(),
        fileUri: pickedFile.uri,
        fileType: pickedFile.mimeType,
        fileSize: pickedFile.size,
        category,
        uploaded_by: user!.id,
      });
      reset();
      onClose();
    } catch (e) {
      setFormError(`Upload failed. ${errorMessageFromUnknown(e)}`);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.dragHandle} />
        <BlurredHeaderBar style={styles.header} contentStyle={styles.headerInner}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Upload Document</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={upload.isPending}>
            <Text style={[styles.save, upload.isPending && styles.disabled]}>
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </Text>
          </TouchableOpacity>
        </BlurredHeaderBar>

        <UploadProgressBar active={upload.isPending} />

        <View style={styles.form}>
          <FormError message={formError} />
          <TouchableOpacity style={styles.filePicker} onPress={handlePick}>
            {pickedFile ? (
              <>
                <MaterialCommunityIcons name="file-document-outline" size={36} color={t.accent} />
                <Text style={styles.fileName} numberOfLines={1}>{pickedFile.name}</Text>
                <Text style={styles.fileSize}>
                  {pickedFile.size > 0 ? `${(pickedFile.size / 1024).toFixed(0)} KB` : ''}
                </Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="paperclip" size={36} color={t.textTertiary} />
                <Text style={styles.filePrompt}>Tap to select a PDF or image</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Document Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Lab Results May 2026"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.chips}>
            {CATEGORIES.map(({ key, label, mci }) => {
              const active = category === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCategory(key)}
                >
                  <MaterialCommunityIcons
                    name={mci as never}
                    size={14}
                    color={active ? t.surface : t.textSecondary}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
    filePicker: {
      backgroundColor: t.surface,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: t.border,
      borderStyle: 'dashed',
      padding: 24,
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    filePrompt: { fontSize: 15, color: t.textTertiary },
    fileName: { fontSize: 15, color: t.text, fontWeight: '600', maxWidth: 260 },
    fileSize: { fontSize: 12, color: t.textTertiary },
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
  });
}
