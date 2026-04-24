import { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { SkeletonList } from '../../components/SkeletonCard';
import { hapticImpact, ImpactFeedbackStyle } from '../../lib/haptics';
import { showActionSheet } from '../../lib/actionSheet';
import { useFamilyStore } from '../../store/family';
import { useAuthStore } from '../../store/auth';
import { Toast } from '../../components/Toast';
import { UndoSnackbar } from '../../components/UndoSnackbar';
import { useUndoDelete } from '../../hooks/useUndoDelete';
import { Task } from '../../types';
import { useTasks, useDeleteTask, useCompleteTask } from './hooks/useTasks';
import { AddTaskSheet } from './AddTaskSheet';
import { useTheme, typography, type Theme } from '../../theme';
import { Icon } from '../../components/Icon';
import type { MainStackParamList } from '../../navigation/types';
import { NativeHeaderTextButton } from '../../navigation/NativeHeaderTextButton';
import { EmptyState } from '../../components/EmptyState';
import { UserAvatar } from '../../components/UserAvatar';
import { useFormatLocaleTag } from '../../i18n/useFormatLocaleTag';

type AssigneeFilter = 'all' | 'mine' | 'others';

function filterTasks(tasks: Task[], filter: AssigneeFilter, userId: string): Task[] {
  switch (filter) {
    case 'mine':
      return tasks.filter((t) => t.assigned_to === userId);
    case 'others':
      return tasks.filter((t) => t.assigned_to !== null && t.assigned_to !== userId);
    case 'all':
    default:
      return tasks;
  }
}

function assigneeInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function AssigneeChip({ task }: { task: Task }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const { t: tx } = useTranslation();

  if (!task.assigned_to || !task.assigned_profile) {
    return <Text style={styles.unassignedText}>{tx('tasks.board.unassigned')}</Text>;
  }

  const name =
    task.assigned_profile.full_name ??
    task.assigned_profile.email ??
    tx('tasks.board.memberFallback');
  const initials = assigneeInitials(name);

  return (
    <View style={styles.assigneeChip}>
      <UserAvatar
        size={18}
        avatarStoragePath={task.assigned_profile.avatar_url}
        initials={initials}
        backgroundColor={t.accentLight}
        textColor={t.accent}
      />
      <Text style={styles.assigneeName} numberOfLines={1}>{name}</Text>
    </View>
  );
}

function SwipeableTaskRow({ task, onToggle, onDelete, onEdit }: {
  task: Task;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
}) {
  const t = useTheme();
  const styles = makeStyles(t);
  const { t: tx } = useTranslation();
  const formatLocale = useFormatLocaleTag();
  const swipeableRef = useRef<Swipeable>(null);
  const isOverdue = !task.completed && task.due_date && new Date(task.due_date) < new Date();
  const taskLabel = task.title?.trim()
    ? tx('tasks.board.a11y.taskLabel', { title: task.title.trim() })
    : tx('tasks.board.a11y.taskLabelNoTitle');

  function renderLeftActions(progress: Animated.AnimatedInterpolation<number>) {
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] });
    return (
      <Animated.View style={[styles.swipeAction, { backgroundColor: t.success, transform: [{ translateX }] }]}>
        <Icon name="check" size={22} color={t.surface} />
        <Text style={styles.swipeActionText}>{tx('tasks.board.swipe.done')}</Text>
      </Animated.View>
    );
  }

  function renderRightActions(progress: Animated.AnimatedInterpolation<number>) {
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });
    return (
      <Animated.View style={[styles.swipeDeleteAction, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={styles.swipeActionBtn}
          onPress={() => { swipeableRef.current?.close(); onDelete(task); }}
        >
          <Icon name="trash" size={20} color={t.surface} />
          <Text style={styles.swipeActionText}>{tx('common.delete')}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  const accessibilityActions = [
    ...(!task.completed ? [{ name: 'markdone', label: tx('tasks.board.a11y.actionMarkDone') }] : []),
    { name: 'edit', label: tx('common.edit') },
    { name: 'delete', label: tx('common.delete') },
  ];

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      leftThreshold={60}
      rightThreshold={60}
      renderLeftActions={task.completed ? undefined : renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={(direction) => {
        if (direction === 'left') {
          swipeableRef.current?.close();
          onToggle(task);
        }
      }}
    >
      <View
        style={styles.taskCard}
        accessible
        accessibilityLabel={taskLabel}
        accessibilityHint={tx('tasks.board.a11y.actionsHint')}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={(e) => {
          const action = e.nativeEvent.actionName;
          if (action === 'markdone') {
            onToggle(task);
            return;
          }
          if (action === 'delete') {
            onDelete(task);
            return;
          }
          if (action === 'edit') {
            onEdit(task);
          }
        }}
      >
        <TouchableOpacity
          style={[styles.checkbox, task.completed && styles.checkboxDone]}
          onPress={() => onToggle(task)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={
            task.completed
              ? tx('tasks.board.a11y.markNotDone', { taskLabel })
              : tx('tasks.board.a11y.markDone', { taskLabel })
          }
        >
          {task.completed && <Icon name="check" size={13} color={t.surface} />}
        </TouchableOpacity>
        <View style={styles.taskContent}>
          <Text style={[styles.taskTitle, task.completed && styles.taskTitleDone]}>
            {task.title}
          </Text>
          {task.description ? (
            <Text style={styles.taskDesc} numberOfLines={1}>{task.description}</Text>
          ) : null}
          <View style={styles.taskMeta}>
            {task.due_date ? (
              <View style={styles.dueRow}>
                {isOverdue && <Icon name="warning" size={12} color={t.error} />}
                <Text style={[styles.dueDate, isOverdue && styles.dueDateOverdue]}>
                  {tx('tasks.board.due', {
                    date: new Date(task.due_date).toLocaleDateString(formatLocale, {
                      month: 'short',
                      day: 'numeric',
                    }),
                  })}
                </Text>
              </View>
            ) : null}
            <AssigneeChip task={task} />
          </View>
        </View>
        <TouchableOpacity
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => {
            showActionSheet(
              {
                options: [tx('common.cancel'), tx('common.edit'), tx('common.delete')],
                destructiveButtonIndex: 2,
                cancelButtonIndex: 0,
              },
              (i) => { if (i === 1) onEdit(task); if (i === 2) onDelete(task); }
            );
          }}
          accessibilityRole="button"
          accessibilityLabel={tx('tasks.board.a11y.moreActions', { taskLabel })}
        >
          <Text style={styles.menuDots}>···</Text>
        </TouchableOpacity>
      </View>
    </Swipeable>
  );
}

function FilterBar({ selected, onChange }: {
  selected: AssigneeFilter;
  onChange: (f: AssigneeFilter) => void;
}) {
  const t = useTheme();
  const styles = makeStyles(t);
  const { t: tx } = useTranslation();
  const filters: AssigneeFilter[] = ['all', 'mine', 'others'];
  const filterLabels: Record<AssigneeFilter, string> = {
    all: tx('tasks.board.filters.all'),
    mine: tx('tasks.board.filters.mine'),
    others: tx('tasks.board.filters.others'),
  };
  return (
    <View style={styles.filterBar}>
      {filters.map((f) => (
        <TouchableOpacity
          key={f}
          style={[styles.filterChip, selected === f && styles.filterChipActive]}
          onPress={() => onChange(f)}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterChipText, selected === f && styles.filterChipTextActive]}>
            {filterLabels[f]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function TaskBoardScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { t: tx } = useTranslation();
  const family = useFamilyStore((s) => s.family);
  const { user } = useAuthStore();
  const { data: tasks, isLoading, isFetching, refetch } = useTasks(family?.id ?? null);
  const deleteTask = useDeleteTask(family?.id ?? null);
  const completeTask = useCompleteTask(family?.id ?? null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [toast, setToast] = useState({ visible: false, message: '' });
  const undoDelete = useUndoDelete();
  const [filter, setFilter] = useState<AssigneeFilter>('all');
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const clearFilter = useCallback(() => setFilter('all'), []);

  useEffect(() => {
    setShowAllCompleted(false);
  }, [filter]);
  const togglingTaskIdsRef = useRef(new Set<string>());

  const openAdd = useCallback(() => setSheetVisible(true), []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <NativeHeaderTextButton label={tx('common.add')} onPress={openAdd} />,
    });
  }, [navigation, openAdd, tx]);

  function showToast(message: string) {
    setToast({ visible: true, message });
  }

  function handleToggle(task: Task) {
    if (togglingTaskIdsRef.current.has(task.id)) return;

    hapticImpact(ImpactFeedbackStyle.Light);
    const nowCompleted = !task.completed;
    togglingTaskIdsRef.current.add(task.id);

    completeTask.mutate(
      { id: task.id, completed: nowCompleted },
      {
        onError: () => showToast(tx('tasks.board.toast.updateFailed')),
        onSuccess: (_data, vars) => {
          if (vars.completed) showToast(tx('tasks.board.toast.completed'));
        },
        onSettled: () => {
          togglingTaskIdsRef.current.delete(task.id);
        },
      }
    );
  }

  function handleDelete(task: Task) {
    const title = task.title?.trim() || 'Task';
    undoDelete.scheduleDelete(`Removed: ${title}`, () => deleteTask.mutate(task.id));
  }

  const allTasks = tasks ?? [];
  const filteredTasks = user ? filterTasks(allTasks, filter, user.id) : allTasks;
  const todo = filteredTasks.filter((t) => !t.completed);
  const completedTasks = filteredTasks.filter((t) => t.completed);
  const completedTotal = completedTasks.length;
  const done =
    showAllCompleted || completedTotal <= 5
      ? completedTasks
      : completedTasks.slice(0, 5);
  const completedHidden = Math.max(0, completedTotal - 5);
  const totalTasks = allTasks.length;
  const firstTimeEmpty = totalTasks === 0;

  const listData = [
    { type: 'filters' as const },
    {
      type: 'header' as const,
      label: `${tx('tasks.board.sections.todo')}${todo.length > 0 ? tx('tasks.board.countSuffix', { count: todo.length }) : ''}`,
    },
    ...todo.map((t) => ({ type: 'task' as const, task: t })),
    ...(todo.length === 0 ? [{ type: 'empty' as const }] : []),
    ...(completedTotal > 0
      ? [{ type: 'header' as const, label: tx('tasks.board.sections.completed', { count: completedTotal }) }]
      : []),
    ...done.map((t) => ({ type: 'task' as const, task: t })),
    ...(completedTotal > 5 && !showAllCompleted
      ? [{ type: 'completedExpand' as const, hiddenCount: completedHidden }]
      : []),
    ...(completedTotal > 5 && showAllCompleted
      ? [{ type: 'completedCollapse' as const }]
      : []),
  ];

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={{ flex: 1, paddingTop: 12 }}>
          <SkeletonList count={5} lines={2} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={listData}
          keyExtractor={(item, i) =>
            item.type === 'task'
              ? item.task!.id
              : `${item.type}-${i}`
          }
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.list, { paddingTop: 8 }, firstTimeEmpty && { flexGrow: 1 }]}
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
          renderItem={({ item }) => {
            if (item.type === 'filters') {
              return <FilterBar selected={filter} onChange={setFilter} />;
            }
            if (item.type === 'header') return <Text style={styles.sectionLabel}>{item.label}</Text>;
            if (item.type === 'completedExpand') {
              return (
                <TouchableOpacity
                  style={styles.completedToggle}
                  onPress={() => {
                    hapticImpact(ImpactFeedbackStyle.Light);
                    setShowAllCompleted(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={tx('tasks.board.a11y.showAllCompleted', {
                    completedTotal,
                    hiddenCount: item.hiddenCount,
                  })}
                >
                  <Text style={styles.completedToggleText}>{tx('tasks.board.completed.showAll')}</Text>
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedBadgeText}>{item.hiddenCount}</Text>
                  </View>
                  <Icon name="chevron" size={18} color={t.accent} style={{ transform: [{ rotate: '90deg' }] }} />
                </TouchableOpacity>
              );
            }
            if (item.type === 'completedCollapse') {
              return (
                <TouchableOpacity
                  style={styles.completedToggle}
                  onPress={() => {
                    hapticImpact(ImpactFeedbackStyle.Light);
                    setShowAllCompleted(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={tx('tasks.board.a11y.showFewerCompleted')}
                >
                  <Text style={styles.completedToggleText}>{tx('tasks.board.completed.showLess')}</Text>
                  <Icon name="chevron" size={18} color={t.accent} style={{ transform: [{ rotate: '-90deg' }] }} />
                </TouchableOpacity>
              );
            }
            if (item.type === 'empty') {
              if (filter !== 'all' && totalTasks > 0) {
                return (
                  <EmptyState
                    icon="checkCircle"
                    title={tx('tasks.board.empty.filtered.title')}
                    message={filter === 'mine' ? tx('tasks.board.empty.filtered.mine') : tx('tasks.board.empty.filtered.others')}
                    actionLabel={tx('tasks.board.empty.filtered.action')}
                    onAction={clearFilter}
                  />
                );
              }
              return firstTimeEmpty ? (
                <EmptyState
                  icon="tasks"
                  title={tx('tasks.board.empty.first.title')}
                  message={tx('tasks.board.empty.first.message')}
                  actionLabel={tx('tasks.board.empty.first.action')}
                  onAction={openAdd}
                />
              ) : (
                <EmptyState
                  icon="checkCircle"
                  iconColor={t.success}
                  title={tx('tasks.board.empty.caughtUp.title')}
                  message={tx('tasks.board.empty.caughtUp.message')}
                  actionLabel={tx('tasks.board.empty.caughtUp.action')}
                  onAction={openAdd}
                />
              );
            }
            return (
              <SwipeableTaskRow
                task={item.task!}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onEdit={(t) => { setEditingTask(t); setSheetVisible(true); }}
              />
            );
          }}
        />
      )}

      {family && (
        <AddTaskSheet
          familyId={family.id}
          visible={sheetVisible}
          editing={editingTask}
          onClose={() => { setSheetVisible(false); setEditingTask(undefined); }}
          onAdded={() => showToast(editingTask ? tx('tasks.board.toast.updated') : tx('tasks.board.toast.added'))}
        />
      )}
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
    list: { padding: 16, paddingBottom: 40 },
    filterBar: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
      flexWrap: 'wrap',
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: t.surfaceAlt,
    },
    filterChipActive: {
      backgroundColor: t.accentLight,
    },
    filterChipText: { ...typography.caption, fontWeight: '500', color: t.textSecondary },
    filterChipTextActive: {
      color: t.accent,
      fontWeight: '600',
    },
    sectionLabel: { ...typography.overline, color: t.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 8, marginBottom: 8 },
    completedToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 8,
      marginTop: 4,
      marginBottom: 8,
      paddingVertical: 8,
      paddingRight: 4,
    },
    completedToggleText: { ...typography.subhead, color: t.accent, fontWeight: '600' },
    completedBadge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 11,
      backgroundColor: t.accentLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    completedBadgeText: { ...typography.caption, fontWeight: '700', color: t.accent, fontVariant: ['tabular-nums'] },
    swipeAction: {
      width: 80, justifyContent: 'center', alignItems: 'center', gap: 4,
      borderRadius: 14, marginBottom: 8,
    },
    swipeDeleteAction: {
      width: 80, justifyContent: 'center', alignItems: 'center',
      backgroundColor: t.error, borderRadius: 14, marginBottom: 8,
    },
    swipeActionBtn: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', gap: 4 },
    swipeActionText: { ...typography.footnote, color: t.surface, fontWeight: '700', textAlign: 'center' },
    taskCard: {
      backgroundColor: t.surface, borderRadius: 14, padding: 14, marginBottom: 8,
      flexDirection: 'row', alignItems: 'flex-start',
      shadowColor: t.shadow, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    },
    checkbox: {
      width: 24, height: 24, borderRadius: 12, borderWidth: 2,
      borderColor: t.borderLight, marginRight: 12, marginTop: 1,
      alignItems: 'center', justifyContent: 'center',
    },
    checkboxDone: { backgroundColor: t.accent, borderColor: t.accent },
    taskContent: { flex: 1 },
    taskTitle: { ...typography.body, color: t.text, fontWeight: '500' },
    taskTitleDone: { opacity: 0.4, textDecorationLine: 'line-through' },
    taskDesc: { ...typography.caption, color: t.textSecondary, marginTop: 2 },
    taskMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
    dueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dueDate: { ...typography.footnote, color: t.textSecondary },
    dueDateOverdue: { color: t.error, fontWeight: '600' },
    assigneeChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    assigneeName: { ...typography.footnote, color: t.textSecondary, maxWidth: 120 },
    unassignedText: { ...typography.footnote, color: t.textTertiary, fontStyle: 'italic' },
    menuDots: { ...typography.heading, color: t.textTertiary, paddingLeft: 8 },
  });
}
