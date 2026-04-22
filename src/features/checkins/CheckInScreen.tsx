import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Modal,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
  Animated,
} from 'react-native';
import { showActionSheet } from '../../lib/actionSheet';
import { Swipeable } from 'react-native-gesture-handler';
import { SkeletonList } from '../../components/SkeletonCard';
import { hapticImpact, hapticNotification, ImpactFeedbackStyle, NotificationFeedbackType } from '../../lib/haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurredHeaderBar } from '../../components/BlurredHeaderBar';
import { Toast } from '../../components/Toast';
import { useAuthStore } from '../../store/auth';
import { useFamilyStore } from '../../store/family';
import { useCheckIns, useAddCheckIn, useDeleteCheckIn, useUpdateCheckIn } from './hooks/useCheckIns';
import {
  useTheme,
  type Theme,
  navigationTitleTextStyle,
  spacing,
  typography,
  NAVIGATION_HEADER_TOOLBAR,
  NAVIGATION_HEADER_CHROME_PAD,
} from '../../theme';
import { Icon } from '../../components/Icon';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { CheckIn, CheckInMood } from '../../types';
import { MOODS, moodMeta } from './moods';
import type { MainStackParamList } from '../../navigation/types';
import { NativeHeaderTextButton } from '../../navigation/NativeHeaderTextButton';

function CheckInCard({ item, onMenu }: { item: CheckIn; onMenu: () => void }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const meta = moodMeta(item.mood);
  const d = new Date(item.created_at);
  return (
    <View style={[styles.card, { borderLeftColor: meta.color }]}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name={meta.mci as never} size={24} color={meta.color} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.moodLabel, { color: meta.color }]}>{meta.label}</Text>
          <Text style={styles.cardDate}>
            {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
            {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
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

function SwipeableCheckInCard({ item, onDelete, onMenu }: { item: CheckIn; onDelete: () => void; onMenu: () => void }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const swipeableRef = useRef<Swipeable>(null);
  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>) => {
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });
    return (
      <Animated.View style={[styles.swipeDeleteAction, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={styles.swipeDeleteBtn}
          onPress={() => { swipeableRef.current?.close(); onDelete(); }}
        >
          <Icon name="trash" size={20} color={t.surface} />
          <Text style={styles.swipeDeleteText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };
  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} rightThreshold={40}>
      <CheckInCard item={item} onMenu={onMenu} />
    </Swipeable>
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

  useEffect(() => {
    if (visible) {
      if (editing) {
        setMood(editing.mood);
        setSummary(editing.summary);
        setNotes(editing.notes ?? '');
      } else {
        setMood('good'); setSummary(''); setNotes('');
      }
    }
  }, [visible, editing?.id]);

  function reset() {
    setMood('good'); setSummary(''); setNotes('');
    onClose();
  }

  async function handleSubmit() {
    if (!summary.trim()) { Alert.alert('Required', 'Please write a brief summary.'); return; }
    hapticNotification(NotificationFeedbackType.Success);
    if (editing) {
      await updateCheckIn.mutateAsync({ id: editing.id, mood, summary: summary.trim(), notes: notes.trim() || undefined });
    } else {
      await addCheckIn.mutateAsync({ mood, summary: summary.trim(), notes: notes.trim() || undefined, submitted_by: user!.id });
    }
    reset();
    onSubmitted();
  }

  const isPending = addCheckIn.isPending || updateCheckIn.isPending;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.dragHandle} />
        <BlurredHeaderBar style={styles.modalHeader} contentStyle={styles.modalHeaderInner}>
          <TouchableOpacity onPress={reset}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{editing ? 'Edit Check-In' : 'New Check-In'}</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isPending}>
            <Text style={[styles.modalSave, isPending && styles.disabledText]}>
              {isPending ? 'Saving…' : 'Submit'}
            </Text>
          </TouchableOpacity>
        </BlurredHeaderBar>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.formLabel}>
            How is {careRecipientName} doing today?
          </Text>

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
            onChangeText={setSummary}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function CheckInScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const family = useFamilyStore((s) => s.family);
  const { data: checkins, isLoading, isFetching, refetch } = useCheckIns();
  const deleteCheckIn = useDeleteCheckIn();
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
    Alert.alert('Delete Check-In', 'Delete this check-in? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCheckIn.mutate(item.id) },
    ]);
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
          contentContainerStyle={[styles.list, { paddingTop: 12 }]}
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Icon name="checkin" size={48} color={t.borderLight} />
                <Text style={styles.emptyTitle}>No check-ins yet</Text>
                <Text style={styles.emptyDesc}>Tap New to submit a daily status update.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <SwipeableCheckInCard
                item={item}
                onDelete={() => confirmDelete(item)}
                onMenu={() => showMenu(item)}
              />
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
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    modalContainer: { flex: 1, backgroundColor: t.bg },
    dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: t.borderLight, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
    modalHeader: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: NAVIGATION_HEADER_CHROME_PAD,
    },
    modalHeaderInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: NAVIGATION_HEADER_TOOLBAR,
    },
    modalTitle: { ...navigationTitleTextStyle(t), flex: 1, textAlign: 'center' },
    modalCancel: { ...typography.callout, color: t.textSecondary, minWidth: 56 },
    modalSave: { ...typography.callout, color: t.accent, fontWeight: '700', minWidth: 56, textAlign: 'right' },
    disabledText: { opacity: 0.4 },
    form: { padding: 20, paddingBottom: 48 },
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
    emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: t.text },
    emptyDesc: { fontSize: 14, color: t.textTertiary, textAlign: 'center', paddingHorizontal: 40 },
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
    swipeDeleteAction: {
      width: 80, justifyContent: 'center', alignItems: 'center',
      backgroundColor: t.error, borderRadius: 14,
    },
    swipeDeleteBtn: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', gap: 4 },
    swipeDeleteText: { color: t.surface, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  });
}
