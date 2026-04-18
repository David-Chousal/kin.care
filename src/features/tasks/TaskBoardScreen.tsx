import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useFamilyStore } from '../../store/family';
import { Task } from '../../types';
import { useTasks } from './hooks/useTasks';
import { AddTaskSheet } from './AddTaskSheet';

interface TaskBoardScreenProps {
  onBack: () => void;
}

interface TaskRowProps {
  task: Task;
  onToggle: (task: Task) => void;
}

function TaskRow({ task, onToggle }: TaskRowProps) {
  return (
    <View style={styles.taskCard}>
      <TouchableOpacity style={styles.checkbox} onPress={() => onToggle(task)}>
        {task.completed && <View style={styles.checkmark} />}
      </TouchableOpacity>
      <View style={styles.taskContent}>
        <Text
          style={[styles.taskTitle, task.completed && styles.taskTitleDone]}
        >
          {task.title}
        </Text>
        {task.due_date && (
          <Text style={styles.dueDate}>{task.due_date.slice(0, 10)}</Text>
        )}
      </View>
    </View>
  );
}

export function TaskBoardScreen({ onBack }: TaskBoardScreenProps) {
  const family = useFamilyStore((s) => s.family);
  const queryClient = useQueryClient();
  const { data: tasks, isLoading } = useTasks(family?.id ?? null);
  const [sheetVisible, setSheetVisible] = useState(false);

  async function handleToggle(task: Task) {
    const nowCompleted = !task.completed;
    await supabase
      .from('tasks')
      .update({
        completed: nowCompleted,
        completed_at: nowCompleted ? new Date().toISOString() : null,
      })
      .eq('id', task.id);

    await queryClient.invalidateQueries({ queryKey: ['tasks', family?.id] });
  }

  const todo = tasks?.filter((t) => !t.completed) ?? [];
  const done = (tasks?.filter((t) => t.completed) ?? []).slice(0, 5);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tasks</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setSheetVisible(true)}
        >
          <Text style={styles.addButtonText}>＋</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4F6BED" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.sectionHeader}>TO DO</Text>

          {todo.length === 0 ? (
            <Text style={styles.emptyText}>No tasks yet — add one above</Text>
          ) : (
            todo.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={handleToggle} />
            ))
          )}

          {done.length > 0 && (
            <>
              <Text style={[styles.sectionHeader, styles.sectionHeaderDone]}>
                DONE
              </Text>
              {done.map((task) => (
                <TaskRow key={task.id} task={task} onToggle={handleToggle} />
              ))}
            </>
          )}
        </ScrollView>
      )}

      {family && (
        <AddTaskSheet
          familyId={family.id}
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F7F4',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#F9F7F4',
  },
  backButton: {
    minWidth: 60,
  },
  backText: {
    fontSize: 15,
    color: '#4F6BED',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4F6BED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '400',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  sectionHeaderDone: {
    marginTop: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 32,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4F6BED',
    position: 'absolute',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    color: '#1A1A2E',
    fontWeight: '500',
  },
  taskTitleDone: {
    opacity: 0.5,
    textDecorationLine: 'line-through',
  },
  dueDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
});
