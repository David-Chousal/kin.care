import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Modal,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { showActionSheet } from '../../lib/actionSheet';
import { Swipeable } from 'react-native-gesture-handler';
import { Animated } from 'react-native';
import { SkeletonList } from '../../components/SkeletonCard';
import { hapticImpact, hapticNotification, ImpactFeedbackStyle, NotificationFeedbackType } from '../../lib/haptics';
import { BlurredHeaderBar } from '../../components/BlurredHeaderBar';
import { Toast } from '../../components/Toast';
import { useAuthStore } from '../../store/auth';
import { useNotes, useAddNote, useUpdateNote, useDeleteNote } from './hooks/useNotes';
import {
  useTheme, type Theme,
  navigationTitleTextStyle, spacing, typography,
  NAVIGATION_HEADER_TOOLBAR, NAVIGATION_HEADER_CHROME_PAD,
} from '../../theme';
import { Icon } from '../../components/Icon';
import type { FamilyNote } from '../../types';
import type { MainStackParamList } from '../../navigation/types';
import { NativeHeaderTextButton } from '../../navigation/NativeHeaderTextButton';

function NoteCard({ item, onMenu, isOwn }: { item: FamilyNote; onMenu: () => void; isOwn: boolean }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const d = new Date(item.created_at);
  const edited = item.updated_at !== item.created_at;
  return (
    <View style={styles.card}>
      <View style={styles.cardMeta}>
        <Text style={styles.cardAuthor}>{item.author_name ?? 'Family member'}</Text>
        <Text style={styles.cardDate}>
          {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
          {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          {edited ? ' · edited' : ''}
        </Text>
        {isOwn && (
          <TouchableOpacity onPress={onMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.menuDots}>···</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.cardBody}>{item.body}</Text>
    </View>
  );
}

function SwipeableNoteCard({
  item, isOwn, onDelete, onMenu,
}: { item: FamilyNote; isOwn: boolean; onDelete: () => void; onMenu: () => void }) {
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
  if (!isOwn) return <NoteCard item={item} onMenu={onMenu} isOwn={false} />;
  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} rightThreshold={40}>
      <NoteCard item={item} onMenu={onMenu} isOwn />
    </Swipeable>
  );
}

interface NoteFormProps {
  visible: boolean;
  editing?: FamilyNote;
  onClose: () => void;
  onSubmitted: () => void;
}

function NoteFormModal({ visible, editing, onClose, onSubmitted }: NoteFormProps) {
  const t = useTheme();
  const styles = makeStyles(t);
  const { user } = useAuthStore();
  const addNote = useAddNote();
  const updateNote = useUpdateNote();
  const [body, setBody] = useState('');

  useEffect(() => {
    if (visible) setBody(editing?.body ?? '');
  }, [visible, editing?.id]);

  function reset() { setBody(''); onClose(); }

  async function handleSubmit() {
    if (!body.trim()) { Alert.alert('Required', 'Please write a note.'); return; }
    hapticNotification(NotificationFeedbackType.Success);
    if (editing) {
      await updateNote.mutateAsync({ id: editing.id, body: body.trim() });
    } else {
      await addNote.mutateAsync({ body: body.trim(), created_by: user!.id });
    }
    reset();
    onSubmitted();
  }

  const isPending = addNote.isPending || updateNote.isPending;

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
          <Text style={styles.modalTitle}>{editing ? 'Edit Note' : 'New Note'}</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isPending}>
            <Text style={[styles.modalSave, isPending && styles.disabledText]}>
              {isPending ? 'Saving…' : 'Post'}
            </Text>
          </TouchableOpacity>
        </BlurredHeaderBar>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.formLabel}>Note</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Write a note for the family…"
            placeholderTextColor={t.textTertiary}
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={6}
            autoFocus
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function NotesScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user } = useAuthStore();
  const { data: notes, isLoading, isFetching, refetch } = useNotes();
  const deleteNote = useDeleteNote();
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<FamilyNote | undefined>(undefined);
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

  function showMenu(item: FamilyNote) {
    showActionSheet(
      { options: ['Cancel', 'Edit', 'Delete'], destructiveButtonIndex: 2, cancelButtonIndex: 0 },
      (i) => {
        if (i === 1) { setEditingItem(item); setShowForm(true); }
        if (i === 2) confirmDelete(item);
      },
    );
  }

  function confirmDelete(item: FamilyNote) {
    Alert.alert('Delete Note', 'Delete this note? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteNote.mutate(item.id) },
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
          data={notes ?? []}
          keyExtractor={(n) => n.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.list, { paddingTop: 12 }]}
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="notes" size={48} color={t.borderLight} />
              <Text style={styles.emptyTitle}>No notes yet</Text>
              <Text style={styles.emptyDesc}>Tap New to share an update with your family.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <SwipeableNoteCard
              item={item}
              isOwn={item.created_by === user?.id}
              onDelete={() => confirmDelete(item)}
              onMenu={() => showMenu(item)}
            />
          )}
        />
      )}

      <NoteFormModal
        visible={showForm}
        editing={editingItem}
        onClose={() => { setShowForm(false); setEditingItem(undefined); }}
        onSubmitted={() => {
          setShowForm(false);
          setEditingItem(undefined);
          setToast({ visible: true, message: editingItem ? 'Note updated' : 'Note posted' });
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
    input: {
      backgroundColor: t.surface, borderRadius: 12, borderWidth: 1,
      borderColor: t.border, paddingHorizontal: 16, paddingVertical: 12,
      fontSize: 15, color: t.text,
    },
    multiline: { height: 140, textAlignVertical: 'top' },
    list: { padding: 16, gap: 12, paddingBottom: 40 },
    emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: t.text },
    emptyDesc: { fontSize: 14, color: t.textTertiary, textAlign: 'center', paddingHorizontal: 40 },
    card: {
      backgroundColor: t.surface, borderRadius: 14, padding: 14,
      shadowColor: t.shadow, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
      gap: 8,
    },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardAuthor: { fontSize: 13, fontWeight: '700', color: t.text },
    cardDate: { flex: 1, fontSize: 12, color: t.textTertiary },
    cardBody: { fontSize: 15, color: t.text, lineHeight: 22 },
    menuDots: { fontSize: 18, color: t.textTertiary },
    swipeDeleteAction: {
      width: 80, justifyContent: 'center', alignItems: 'center',
      backgroundColor: t.error, borderRadius: 14,
    },
    swipeDeleteBtn: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', gap: 4 },
    swipeDeleteText: { color: t.surface, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  });
}
