import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  LayoutAnimation,
  UIManager,
  Animated,
  Easing,
} from 'react-native';
import { FormSheet } from '../../components/FormSheet';
import { FormError } from '../../components/FormError';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { useUpdateTask } from './hooks/useTasks';
import { useMembers } from '../family/hooks/useMembers';
import { useNotificationPrefs } from '../../store/notifications';
import type { Task } from '../../types';
import { useTheme, type Theme, space, typography } from '../../theme';
import { Icon } from '../../components/Icon';
import { UserAvatar } from '../../components/UserAvatar';
import { useFormatLocaleTag } from '../../i18n/useFormatLocaleTag';

interface AddTaskSheetProps {
  familyId: string;
  visible: boolean;
  onClose: () => void;
  onAdded?: () => void;
  editing?: Task;
}

function formatDate(d: Date, locale: string) {
  return d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function memberInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

async function triggerAssigneePush(params: {
  taskId: string;
  taskTitle: string;
  assignerId: string;
  newAssigneeId: string | null;
  oldAssigneeId: string | null;
  prefsEnabled: boolean;
}) {
  const { newAssigneeId, oldAssigneeId, assignerId, prefsEnabled } = params;

  // No push if unassigning, self-assigning, no change, or pref off
  if (!newAssigneeId) return;
  if (newAssigneeId === assignerId) return;
  if (newAssigneeId === oldAssigneeId) return;
  if (!prefsEnabled) return;

  try {
    await supabase.functions.invoke('send-task-push', {
      body: {
        task_id: params.taskId,
        task_title: params.taskTitle,
        assigner_id: assignerId,
        new_assignee_id: newAssigneeId,
        old_assignee_id: oldAssigneeId,
      },
    });
  } catch {
    // Silent failure — save already succeeded
  }
}

export function AddTaskSheet({ familyId, visible, onClose, onAdded, editing }: AddTaskSheetProps) {
  const t = useTheme();
  const styles = makeStyles(t);
  const formatLocale = useFormatLocaleTag();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const updateTask = useUpdateTask(familyId);
  const { data: members = [] } = useMembers(familyId);
  const notifPrefs = useNotificationPrefs();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [assigneePickerMounted, setAssigneePickerMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assigneeAnim = useRef(new Animated.Value(0)).current;
  const assigneePickerAnimatedStyle = useMemo(() => {
    const translateY = assigneeAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] });
    return {
      opacity: assigneeAnim,
      transform: [{ translateY }],
    };
  }, [assigneeAnim]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      if (editing) {
        setTitle(editing.title);
        setDescription(editing.description ?? '');
        setDueDate(editing.due_date ? new Date(editing.due_date) : null);
        setAssignedTo(editing.assigned_to ?? null);
      } else {
        setTitle('');
        setDescription('');
        setDueDate(null);
        setAssignedTo(null);
      }
      setShowCalendar(false);
      setAssigneePickerOpen(false);
      setAssigneePickerMounted(false);
      assigneeAnim.setValue(0);
      setError(null);
    }
  }, [visible, editing?.id]);

  useEffect(() => {
    if (assigneePickerOpen) {
      setAssigneePickerMounted(true);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      Animated.timing(assigneeAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    if (!assigneePickerMounted) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(assigneeAnim, {
      toValue: 0,
      duration: 140,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setAssigneePickerMounted(false);
    });
  }, [assigneeAnim, assigneePickerMounted, assigneePickerOpen]);

  function handleClose() {
    onClose();
  }

  const assigneeName = (() => {
    if (!assignedTo) return null;
    const m = members.find((m) => m.user_id === assignedTo);
    return m?.profiles?.full_name ?? m?.profiles?.email ?? 'Member';
  })();

  async function handleSubmit() {
    if (!title.trim()) { setError('Title is required'); return; }
    if (!user?.id) {
      setError('Session expired. Please sign in again to save this task.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    const dueDateStr = dueDate ? dueDate.toISOString() : undefined;
    const assignerId = user.id;

    if (editing) {
      const oldAssigneeId = editing.assigned_to ?? null;
      await updateTask.mutateAsync({
        id: editing.id,
        title: title.trim(),
        description: description.trim() || undefined,
        due_date: dueDateStr,
        assigned_to: assignedTo,
      });
      // Fire push after successful save
      triggerAssigneePush({
        taskId: editing.id,
        taskTitle: title.trim(),
        assignerId,
        newAssigneeId: assignedTo,
        oldAssigneeId,
        prefsEnabled: notifPrefs.masterEnabled && notifPrefs.taskAssigned,
      });
    } else {
      const { data: inserted, error: insertError } = await supabase.from('tasks').insert({
        family_id: familyId,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDateStr ?? null,
        created_by: assignerId,
        completed: false,
        assigned_to: assignedTo,
      }).select('id').single();
      if (insertError || !inserted) {
        setIsSubmitting(false);
        setError(insertError?.message ?? 'Failed to create task');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['tasks', familyId] });
      // Fire push after successful save
      triggerAssigneePush({
        taskId: inserted.id,
        taskTitle: title.trim(),
        assignerId,
        newAssigneeId: assignedTo,
        oldAssigneeId: null,
        prefsEnabled: notifPrefs.masterEnabled && notifPrefs.taskAssigned,
      });
    }

    setIsSubmitting(false);
    onClose();
    onAdded?.();
  }

  return (
    <FormSheet
      visible={visible}
      transparent
      title={editing ? 'Edit Task' : 'New Task'}
      submitLabel={editing ? 'Save' : 'Add'}
      isSubmitting={isSubmitting}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <FormError message={error} />
      <TextInput
        style={styles.input}
        placeholder="Title"
        placeholderTextColor={t.textTertiary}
        value={title}
        onChangeText={(v) => { setTitle(v); if (error) setError(null); }}
        accessibilityLabel="Title"
        accessibilityState={{ invalid: !!error }}
      />

      <TextInput
        style={[styles.input, styles.inputMultiline]}
        placeholder="Description (optional)"
        placeholderTextColor={t.textTertiary}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
      />

      {/* Assignee picker row */}
      <TouchableOpacity
        style={[styles.fieldRow, assigneePickerOpen && styles.fieldRowActive]}
        onPress={() => { setAssigneePickerOpen((v) => !v); setShowCalendar(false); }}
        activeOpacity={0.7}
      >
        <View style={styles.fieldLabelWrap}>
          <Icon name="members" size={16} color={t.textSecondary} />
          <Text style={styles.fieldLabel}>Assign to</Text>
        </View>
        <View style={styles.fieldRight}>
          {assignedTo ? (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); setAssignedTo(null); setAssigneePickerOpen(false); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearBtn}
            >
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={[styles.fieldValue, !assignedTo && styles.fieldValuePlaceholder]}>
            {assigneeName ?? 'None'}
          </Text>
        </View>
      </TouchableOpacity>

      {assigneePickerMounted && (
        <Animated.View style={[styles.pickerContainer, assigneePickerAnimatedStyle]}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 200 }}>
            {members.map((m) => {
              const name = m.profiles?.full_name ?? m.profiles?.email ?? 'Member';
              const initials = memberInitials(name);
              const isSelected = m.user_id === assignedTo;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.memberRow, isSelected && styles.memberRowSelected]}
                  onPress={() => { setAssignedTo(isSelected ? null : m.user_id); setAssigneePickerOpen(false); }}
                  activeOpacity={0.7}
                >
                  <UserAvatar
                    size={32}
                    avatarStoragePath={m.profiles?.avatar_url}
                    initials={initials}
                    backgroundColor={t.accentLight}
                    textColor={t.accent}
                  />
                  <Text style={[styles.memberName, isSelected && styles.memberNameSelected]}>
                    {name}
                  </Text>
                  {isSelected && <Icon name="check" size={16} color={t.accent} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}

      {/* Due date row */}
      <TouchableOpacity
        style={[styles.fieldRow, showCalendar && styles.fieldRowActive]}
        onPress={() => { setShowCalendar((v) => !v); setAssigneePickerOpen(false); }}
        activeOpacity={0.7}
      >
        <View style={styles.fieldLabelWrap}>
          <Icon name="calendar" size={16} color={t.textSecondary} />
          <Text style={styles.fieldLabel}>Due date</Text>
        </View>
        <View style={styles.fieldRight}>
          {dueDate ? (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); setDueDate(null); setShowCalendar(false); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearBtn}
            >
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={[styles.fieldValue, !dueDate && styles.fieldValuePlaceholder]}>
            {dueDate ? formatDate(dueDate, formatLocale) : 'None'}
          </Text>
        </View>
      </TouchableOpacity>

      {showCalendar && (
        <View style={styles.calendarWrapper}>
          <DateTimePicker
            value={dueDate ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={new Date()}
            accentColor={t.accent}
            onChange={(_event, date) => {
              if (Platform.OS === 'android') setShowCalendar(false);
              if (date) setDueDate(date);
            }}
          />
        </View>
      )}

    </FormSheet>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    boxGap: { marginBottom: space[3] },
    input: {
      backgroundColor: t.surfaceAlt,
      borderRadius: 12,
      padding: space[4],
      ...typography.body,
      color: t.text,
      marginBottom: space[3],
    },
    inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
    fieldRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: t.surfaceAlt, borderRadius: 12, padding: space[4], marginBottom: space[3],
    },
    fieldRowActive: {
      backgroundColor: t.accentLight,
      borderWidth: 1, borderColor: t.accentBorder,
    },
    fieldLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
    fieldLabel: { ...typography.body, fontWeight: '500', color: t.text },
    fieldRight: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
    fieldValue: { ...typography.bodyBold, color: t.accent },
    fieldValuePlaceholder: { color: t.textTertiary, fontWeight: '400' },
    clearBtn: {
      backgroundColor: t.error + '20', borderRadius: space[2],
      paddingHorizontal: space[2], paddingVertical: space[1],
    },
    clearText: { ...typography.footnote, color: t.error, fontWeight: '600' },
    pickerContainer: {
      backgroundColor: t.surfaceDim, borderRadius: space[4],
      overflow: 'hidden', marginBottom: space[3],
    },
    memberRow: {
      flexDirection: 'row', alignItems: 'center', gap: space[3],
      paddingHorizontal: space[4], paddingVertical: space[3],
    },
    memberRowSelected: { backgroundColor: t.accentLight },
    memberName: { flex: 1, ...typography.body, color: t.text },
    memberNameSelected: { color: t.accent, fontWeight: '600' },
    calendarWrapper: {
      backgroundColor: t.surfaceDim, borderRadius: space[4],
      overflow: 'hidden', marginBottom: space[3],
    },
  });
}
