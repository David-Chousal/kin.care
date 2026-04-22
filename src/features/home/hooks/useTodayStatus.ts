import { useMemo } from 'react';
import { useTasks } from '../../tasks/hooks/useTasks';
import { useCheckIns } from '../../checkins/hooks/useCheckIns';
import {
  useMedications,
  useTodayMedLogs,
  parseMedicationSchedule,
  computeDoseStatus,
  scheduledDoseSlotsToday,
  takenDoseSlotsToday,
  type MedLogsMap,
} from '../../medications/hooks/useMedications';
import type { Task, Medication, CheckIn } from '../../../types';

export interface TodayStatus {
  tasks: {
    all: Task[];
    pending: Task[];
    overdue: Task[];
    completedCount: number;
    totalCount: number;
  };
  medications: {
    tracked: Medication[];
    pending: Medication[];
    /** Logged dose slots satisfied today (sums per-med caps). */
    takenCount: number;
    /** Expected dose slots today (e.g. 1× daily + 3× daily = 4). */
    totalCount: number;
    firstPending: Medication | undefined;
    todayLogs: MedLogsMap;
  };
  checkin: {
    today: CheckIn | undefined;
  };
  isLoading: boolean;
}

export function useTodayStatus(familyId: string | null | undefined): TodayStatus {
  const { data: tasks, isLoading: loadingTasks } = useTasks(familyId ?? null);
  const { data: checkins, isLoading: loadingCheckins } = useCheckIns();
  const { data: medications, isLoading: loadingMeds } = useMedications();
  const { data: todayLogs = {}, isLoading: loadingLogs } = useTodayMedLogs();

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const now = useMemo(() => new Date(), []);

  const taskResult = useMemo(() => {
    const all = tasks ?? [];
    const pending = all.filter((t) => !t.completed);
    return {
      all,
      pending,
      overdue: pending.filter((t) => t.due_date && new Date(t.due_date) < now),
      completedCount: all.filter((t) => t.completed).length,
      totalCount: all.length,
    };
  }, [tasks, now]);

  const medResult = useMemo(() => {
    const tracked = (medications ?? []).filter(
      (m) => parseMedicationSchedule(m).periodType !== 'as_needed'
    );
    const pending = tracked.filter(
      (m) => computeDoseStatus(m, todayLogs[m.id]) !== 'taken'
    );
    let takenCount = 0;
    let totalCount = 0;
    for (const m of tracked) {
      takenCount += takenDoseSlotsToday(m, todayLogs[m.id], todayStart);
      totalCount += scheduledDoseSlotsToday(m);
    }
    return {
      tracked,
      pending,
      takenCount,
      totalCount,
      firstPending: pending[0],
      todayLogs: todayLogs as MedLogsMap,
    };
  }, [medications, todayLogs, todayStart]);

  const checkinResult = useMemo(() => ({
    today: (checkins ?? []).find((c) => new Date(c.created_at) >= todayStart),
  }), [checkins, todayStart]);

  return {
    tasks: taskResult,
    medications: medResult,
    checkin: checkinResult,
    isLoading: loadingTasks || loadingCheckins || loadingMeds || loadingLogs,
  };
}
