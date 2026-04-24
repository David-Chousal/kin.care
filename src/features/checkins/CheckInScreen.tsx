import { useEffect, useState, useCallback, useLayoutEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert,
} from 'react-native';
import { showActionSheet } from '../../lib/actionSheet';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { SkeletonList } from '../../components/SkeletonCard';
import { hapticImpact, hapticNotification, ImpactFeedbackStyle, NotificationFeedbackType } from '../../lib/haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FormSheet } from '../../components/FormSheet';
import { Toast } from '../../components/Toast';
import { UndoSnackbar } from '../../components/UndoSnackbar';
import { useUndoDelete } from '../../hooks/useUndoDelete';
import { FormError } from '../../components/FormError';
import { useAuthStore } from '../../store/auth';
import { useFamilyStore } from '../../store/family';
import { useCheckIns, useAddCheckIn, useDeleteCheckIn, useUpdateCheckIn } from './hooks/useCheckIns';
import { errorMessageFromUnknown } from '../../lib/errorMessage';
import { useTheme, type Theme } from '../../theme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { CheckIn, CheckInMood } from '../../types';
import { MOODS, moodMeta } from './moods';
import type { MainStackParamList } from '../../navigation/types';
import { NativeHeaderTextButton } from '../../navigation/NativeHeaderTextButton';
import { EmptyState } from '../../components/EmptyState';
import { useFormatLocaleTag } from '../../i18n/useFormatLocaleTag';

function CheckInCard({ item, onMenu }: { item: CheckIn; onMenu: () => void }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const formatLocale = useFormatLocaleTag();
  const meta = moodMeta(item.mood);
  const d = new Date(item.created_at);
  return (
    <View style={[styles.card, { borderLeftColor: meta.color }]}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name={meta.mci as never} size={24} color={meta.color} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.moodLabel, { color: meta.color }]}>{meta.label}</Text>
          <Text style={styles.cardDate}>
            {d.toLocaleDateString(formatLocale, { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
            {d.toLocaleTimeString(formatLocale, { hour: 'numeric', minute: '2-digit' })}
          </Text>
        </View>
        <TouchableOpacity onPress={onMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.menuDots}>···</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.cardSummary}>{item.summary}</Text>
      {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}
    </View>
  );
}

interface CheckInFormProps {
  visible: boolean;
  careRecipientName: string;
  onClose: () => void;
  onSubmitted: () => void;
  editing?: CheckIn;
}

function CheckInFormModal({ visible, careRecipientName, onClose, onSubmitted, editing }: CheckInFormProps) {
  const t = useTheme();
  const styles = makeStyles(t);
  const { user } = useAuthStore();
  const addCheckIn = useAddCheckIn();
  const updateCheckIn = useUpdateCheckIn();
  const [mood, setMood] = useState<CheckInMood>('good');
  const [summary, setSummary] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setFormError(null);
      if (editing) {
        setMood(editing.mood);
        setSummary(editing.summary);
        setNotes(editing.notes ?? '');
      } else {
        setMood('good'); setSummary(''); setNotes('');
      }
    }
  }, [visible, editing?.id]);

  function resetFields() {
    setMood('good');
    setSummary('');
    setNotes('');
    setFormError(null);
  }

  function handleCancel() {
    resetFields();
    onClose();
  }

  async function handleSubmit() {
    setFormError(null);
    if (!summary.trim()) {
      setFormError('Please write a brief summary.');
      return;
    }
    if (!editing && !user) {
      Alert.alert('Session expired', 'Please sign in again to submit a check-in.');
      return;
    }
    try {
      if (editing) {
        await updateCheckIn.mutateAsync({
          id: editing.id,
          mood,
          summary: summary.trim(),
          notes: notes.trim() || undefined,
        });
      } else {
        await addCheckIn.mutateAsync({
          mood,
          summary: summary.trim(),
          notes: notes.trim() || undefined,
          submitted_by: user!.id,
        });
      }
      hapticNotification(NotificationFeedbackType.Success);
      resetFields();
      onClose();
      onSubmitted();
    } catch (err: unknown) {
      setFormError(`Could not save check-in. ${errorMessageFromUnknown(err)}`);
    }
  }

  const isPending = addCheckIn.isPending || updateCheckIn.isPending;

  return (
    <FormSheet
      visible={visible}
      title={editing ? 'Edit Check-In' : 'New Check-In'}
      submitLabel="Submit"
      isSubmitting={isPending}
      onClose={handleCancel}
      onSubmit={handleSubmit}
    >
      <Text style={styles.formLabel}>
        How is {careRecipientName} doing today?
      </Text>
      <FormError message={formError} />

      <View style={styles.moodGrid}>
        {MOODS.map(({ key, label, mci, color }) => {
          const active = mood === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.moodChip, active && { backgroundColor: color, borderColor: color }]}
              onPress={() => { hapticImpact(ImpactFeedbackStyle.Light); setMood(key); }}
            >
              <MaterialCommunityIcons
                name={mci as never}
                size={20}
                color={active ? t.surface : color}
              />
              <Text style={[styles.moodChipLabel, active && styles.moodChipLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.formLabel}>Summary *</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Brief description of how they're doing…"
        placeholderTextColor={t.textTertiary}
        value={summary}
        onChangeText={(v) => { setSummary(v); setFormError(null); }}
        multiline
        numberOfLines={4}
      />

      <Text style={styles.formLabel}>Additional Notes</Text>
      <TextInput
        style={[styles.input, styles.multilineSmall]}
        placeholder="Any specific observations, concerns, or updates…"
        placeholderTextColor={t.textTertiary}
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />
    </FormSheet>
  );
}

export function CheckInScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const family = useFamilyStore((s) => s.family);
  const { data: checkins, isLoading, isFetching, refetch } = useCheckIns();
  const deleteCheckIn = useDeleteCheckIn();
  const undoDelete = useUndoDelete();
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<CheckIn | undefined>(undefined);
  const [toast, setToast] = useState({ visible: false, message: '' });

  const openNew = useCallback(() => {
    setEditingItem(undefined);
    setShowForm(true);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <NativeHeaderTextButton label="New" onPress={openNew} />,
    });
  }, [navigation, openNew]);

  function showMenu(item: CheckIn) {
    showActionSheet(
      { options: ['Cancel', 'Edit', 'Delete'], destructiveButtonIndex: 2, cancelButtonIndex: 0 },
      (i) => {
        if (i === 1) { setEditingItem(item); setShowForm(true); }
        if (i === 2) confirmDelete(item);
      }
    );
  }

  function confirmDelete(item: CheckIn) {
    undoDelete.scheduleDelete('Check-in removed', () =>
      deleteCheckIn.mutate(item.id, {
        onError: (err) => {
          setToast({ visible: true, message: `Could not delete check-in. ${errorMessageFromUnknown(err)}` });
        },
      }),
    );
  }

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={{ flex: 1, paddingTop: 12 }}>
          <SkeletonList count={4} lines={2} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={checkins ?? []}
          keyExtractor={(c) => c.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[
            styles.list,
            { paddingTop: 12 },
            (checkins?.length ?? 0) === 0 && { flexGrow: 1 },
          ]}
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
          ListEmptyComponent={(
            <EmptyState
              icon="checkin"
              title="No check-ins yet"
              message="Share a daily status update so the family stays on the same page."
              actionLabel="New check-in"
              onAction={openNew}
            />
          )}
            renderItem={({ item }) => (
              <SwipeToDelete
                onDelete={() => confirmDelete(item)}
                accessibilityLabel={item.summary?.trim() || 'Check-in'}
              >
                <CheckInCard item={item} onMenu={() => showMenu(item)} />
              </SwipeToDelete>
            )}
        />
      )}

      <CheckInFormModal
        visible={showForm}
        editing={editingItem}
        careRecipientName={family?.care_recipient_name ?? 'your care recipient'}
        onClose={() => { setShowForm(false); setEditingItem(undefined); }}
        onSubmitted={() => {
          setShowForm(false);
          setEditingItem(undefined);
          setToast({ visible: true, message: editingItem ? 'Check-in updated' : 'Check-in submitted' });
        }}
      />
      <Toast message={toast.message} visible={toast.visible} onHide={() => setToast({ visible: false, message: '' })} />
      <UndoSnackbar
        message={undoDelete.message}
        visible={undoDelete.visible}
        onUndo={undoDelete.undo}
        onSwipeDismiss={undoDelete.dismissAndCommit}
      />
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    formLabel: { fontSize: 14, fontWeight: '600', color: t.textSecondary, marginTop: 20, marginBottom: 10 },
    moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    moodChip: {
      width: '47%', flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
      borderWidth: 1.5, borderColor: t.border, backgroundColor: t.surface,
    },
    moodChipLabel: { fontSize: 14, color: t.textSecondary, fontWeight: '500' },
    moodChipLabelActive: { color: t.surface, fontWeight: '700' },
    input: {
      backgroundColor: t.surface, borderRadius: 12, borderWidth: 1,
      borderColor: t.border, paddingHorizontal: 16, paddingVertical: 12,
      fontSize: 15, color: t.text,
    },
    multiline: { height: 100, textAlignVertical: 'top' },
    multilineSmall: { height: 72, textAlignVertical: 'top' },
    list: { padding: 16, gap: 12, paddingBottom: 40 },
    card: {
      backgroundColor: t.surface, borderRadius: 14, padding: 14, borderLeftWidth: 4,
      shadowColor: t.shadow, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
      gap: 8,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    moodLabel: { fontSize: 14, fontWeight: '700' },
    cardDate: { fontSize: 12, color: t.textTertiary, marginTop: 1 },
    cardSummary: { fontSize: 14, color: t.text, lineHeight: 20 },
    cardNotes: { fontSize: 13, color: t.textSecondary, lineHeight: 18 },
    menuDots: { fontSize: 18, color: t.textTertiary },
  });
}
