import { useQuery, useMutation, useQueryClient, type Query } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import {
  scheduleMedicationRefillNotification,
  shouldFireRefillBecameLow,
} from '../../../lib/medicationRefillNotifications';
import { useFamilyStore } from '../../../store/family';
import type { Medication, MedicationFrequencyType, MedicationLog } from '../../../types';
import { inferFrequencyTypeFromLegacyFrequency } from '../scheduleUtils';

// ─── Schedule helpers ────────────────────────────────────────────────────────

export type DoseStatusKey = 'taken' | 'partial' | 'missed' | 'pending' | 'as_needed';

export interface MedSchedule {
  dosesRequired: number;
  periodType: 'daily' | 'weekly' | 'as_needed';
}

export type RawMedLog = { status: string; scheduled_at: string };
export type MedLogsMap = Record<string, RawMedLog[]>;

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function isWeeklyScheduledForDate(med: Medication, date: Date): boolean {
  const ft = med.frequency_type ?? inferFrequencyTypeFromLegacyFrequency(med.frequency);
  if (ft !== 'weekly') return false;

  const days = med.days_of_week ?? [];
  if (days.length === 0) return false;

  const dow = new Date(date).getDay(); // 0=Sun..6=Sat
  return days.includes(dow);
}

/** Invalidate every `useMedications` query (any family id). Avoids stale `family?.id` in mutation closures. */
function isMedicationsListQuery(q: Query): boolean {
  return Array.isArray(q.queryKey) && q.queryKey[0] === 'medications' && q.queryKey.length === 2;
}

export function parseMedicationSchedule(med: Medication): MedSchedule {
  const ft = med.frequency_type ?? inferFrequencyTypeFromLegacyFrequency(med.frequency);
  if (ft === 'as_needed') return { dosesRequired: 0, periodType: 'as_needed' };
  if (ft === 'weekly') return { dosesRequired: 1, periodType: 'weekly' };
  const doses = med.times_per_day ?? (med.times?.length ?? 1);
  return { dosesRequired: doses, periodType: 'daily' };
}

export function computeDoseStatusForDate(
  med: Medication,
  logs: RawMedLog[] | undefined,
  date: Date
): DoseStatusKey {
  const { dosesRequired, periodType } = parseMedicationSchedule(med);
  if (periodType === 'as_needed') return 'as_needed';

  const dayStart = startOfLocalDay(date);
  const dayEnd = endOfLocalDay(date);

  if (periodType === 'daily') {
    const inDay = (logs ?? []).filter((l) => {
      const t = new Date(l.scheduled_at);
      return t >= dayStart && t <= dayEnd;
    });
    const taken = inDay.filter((l) => l.status === 'taken').length;
    const missed = inDay.filter((l) => l.status === 'missed').length;

    if (taken >= dosesRequired) return 'taken';
    if (taken > 0) return 'partial';
    if (missed > 0) return 'missed';
    return 'pending';
  }

  // Weekly: due only on selected weekday(s), satisfied per scheduled day.
  if (!isWeeklyScheduledForDate(med, date)) return 'taken';

  const inDay = (logs ?? []).filter((l) => {
    const t = new Date(l.scheduled_at);
    return t >= dayStart && t <= dayEnd;
  });
  const taken = inDay.filter((l) => l.status === 'taken').length;
  const missed = inDay.filter((l) => l.status === 'missed').length;

  if (taken >= dosesRequired) return 'taken';
  if (taken > 0) return 'partial';
  if (missed > 0) return 'missed';
  return 'pending';
}

export function computeDoseStatus(med: Medication, logs: RawMedLog[] | undefined): DoseStatusKey {
  return computeDoseStatusForDate(med, logs, new Date());
}

/** Expected dose slots for “today” summary (daily = doses per day; weekly = 1 rolling slot). */
export function scheduledDoseSlotsForDate(med: Medication, date: Date): number {
  const { dosesRequired, periodType } = parseMedicationSchedule(med);
  if (periodType === 'as_needed') return 0;
  if (periodType === 'weekly') return isWeeklyScheduledForDate(med, date) ? 1 : 0;
  return dosesRequired;
}

/** Expected dose slots for “today” summary (daily = doses per day; weekly = 1 if scheduled today). */
export function scheduledDoseSlotsToday(med: Medication): number {
  return scheduledDoseSlotsForDate(med, new Date());
}

/**
 * How many of today’s expected slots are satisfied.
 * Daily: count of `taken` logs since local midnight, capped at `dosesRequired`.
 * Weekly: 1 if scheduled today and a `taken` log exists today.
 */
export function takenDoseSlotsForDate(
  med: Medication,
  logs: RawMedLog[] | undefined,
  date: Date
): number {
  const { dosesRequired, periodType } = parseMedicationSchedule(med);
  if (periodType === 'as_needed') return 0;
  if (periodType === 'weekly') {
    if (!isWeeklyScheduledForDate(med, date)) return 0;
    const dayStart = startOfLocalDay(date);
    const dayEnd = endOfLocalDay(date);
    const taken = (logs ?? []).some((l) => {
      const t = new Date(l.scheduled_at);
      return t >= dayStart && t <= dayEnd && l.status === 'taken';
    });
    return taken ? 1 : 0;
  }
  const dayStart = startOfLocalDay(date);
  const taken = (logs ?? []).filter((l) => new Date(l.scheduled_at) >= dayStart && l.status === 'taken')
    .length;
  return Math.min(taken, dosesRequired);
}

export function takenDoseSlotsToday(
  med: Medication,
  logs: RawMedLog[] | undefined,
  todayStart: Date
): number {
  // Back-compat: prior callers already passed a day-start date; treat that as “the date”.
  return takenDoseSlotsForDate(med, logs, todayStart);
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useMedications() {
  const family = useFamilyStore((s) => s.family);

  return useQuery({
    queryKey: ['medications', family?.id],
    enabled: !!family?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('family_id', family!.id)
        .eq('active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Medication[];
    },
  });
}

export function useAddMedication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      dosage: string;
      frequency: string;
      times: string[] | null;
      frequency_type: MedicationFrequencyType;
      times_per_day: number | null;
      days_of_week: number[] | null;
      notes?: string;
      created_by: string;
      quantity_remaining?: number | null;
      refill_threshold?: number | null;
    }) => {
      const familyId = useFamilyStore.getState().family?.id;
      if (!familyId) throw new Error('No family selected. Join or create a family first.');
      const { data, error } = await supabase
        .from('medications')
        .insert({
          family_id: familyId,
          name: input.name,
          dosage: input.dosage,
          frequency: input.frequency,
          times: input.times,
          frequency_type: input.frequency_type,
          times_per_day: input.times_per_day,
          days_of_week: input.days_of_week,
          notes: input.notes ?? null,
          created_by: input.created_by,
          quantity_remaining: input.quantity_remaining ?? null,
          refill_threshold: input.refill_threshold ?? null,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as Medication;
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ predicate: isMedicationsListQuery });
      if (
        created &&
        shouldFireRefillBecameLow(null, {
          quantity_remaining: created.quantity_remaining,
          refill_threshold: created.refill_threshold,
        })
      ) {
        await scheduleMedicationRefillNotification(
          created.name,
          created.quantity_remaining!,
          created.id,
        );
      }
    },
  });
}

export function useUpdateMedication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      dosage: string;
      frequency: string;
      times: string[] | null;
      frequency_type: MedicationFrequencyType;
      times_per_day: number | null;
      days_of_week: number[] | null;
      notes?: string;
      quantity_remaining?: number | null;
      refill_threshold?: number | null;
    }) => {
      const familyId = useFamilyStore.getState().family?.id;
      const prevList = familyId
        ? queryClient.getQueryData<Medication[]>(['medications', familyId])
        : undefined;
      const prevMed = prevList?.find((m) => m.id === input.id) ?? null;
      const { id, ...rest } = input;
      const { error } = await supabase.from('medications').update(rest).eq('id', id);
      if (error) throw error;
      const next = {
        quantity_remaining: input.quantity_remaining ?? null,
        refill_threshold: input.refill_threshold ?? null,
      };
      return {
        prevMed,
        next,
        name: input.name,
        medicationId: id,
      };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ predicate: isMedicationsListQuery });
      const prevLevel = result?.prevMed
        ? {
            quantity_remaining: result.prevMed.quantity_remaining,
            refill_threshold: result.prevMed.refill_threshold,
          }
        : null;
      if (result && shouldFireRefillBecameLow(prevLevel, result.next)) {
        const q = result.next.quantity_remaining;
        if (q != null) {
          await scheduleMedicationRefillNotification(result.name, q, result.medicationId);
        }
      }
    },
  });
}

export function useDeactivateMedication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('medications')
        .update({ active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      const familyId = useFamilyStore.getState().family?.id;
      if (!familyId) return {};
      const key = ['medications', familyId] as const;
      await queryClient.cancelQueries({ predicate: isMedicationsListQuery });
      const prev = queryClient.getQueryData<Medication[]>(key);
      queryClient.setQueryData<Medication[]>(key, (old) => old?.filter((m) => m.id !== id) ?? []);
      return { prev, key };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev !== undefined && ctx.key) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ predicate: isMedicationsListQuery });
    },
  });
}

export function useTodayMedLogs() {
  const family = useFamilyStore((s) => s.family);
  return useQuery({
    queryKey: ['medication_logs_today', family?.id],
    enabled: !!family?.id,
    staleTime: 60_000,
    queryFn: async () => {
      // Fetch 7 days to cover both daily (since midnight) and weekly windows
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('medication_logs')
        .select('medication_id, status, scheduled_at')
        .eq('family_id', family!.id)
        .gte('scheduled_at', weekStart.toISOString());
      if (error) throw error;

      const grouped: MedLogsMap = {};
      for (const log of data ?? []) {
        if (!grouped[log.medication_id]) grouped[log.medication_id] = [];
        grouped[log.medication_id].push({ status: log.status, scheduled_at: log.scheduled_at });
      }
      return grouped;
    },
  });
}

export function useMedicationLogs(medicationId: string) {
  return useQuery({
    queryKey: ['medication_logs', medicationId],
    enabled: !!medicationId,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medication_logs')
        .select('*')
        .eq('medication_id', medicationId)
        .order('scheduled_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as MedicationLog[];
    },
  });
}

export function useLogDose() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);

  return useMutation({
    mutationFn: async (input: {
      medication_id: string;
      medication_name: string;
      scheduled_at: string;
      status: 'taken' | 'missed';
      logged_by: string;
      notes?: string;
      /** Current quantity before this dose — used to decrement. NULL = tracking disabled. */
      quantity_remaining: number | null;
      refill_threshold: number | null;
    }) => {
      const { medication_name: _name, quantity_remaining, refill_threshold, ...logFields } = input;
      const { error } = await supabase.from('medication_logs').insert({
        ...logFields,
        family_id: family!.id,
        taken_at: input.status === 'taken' ? new Date().toISOString() : null,
      });
      if (error) throw error;

      if (input.status === 'taken' && quantity_remaining !== null && quantity_remaining > 0) {
        const newQty = quantity_remaining - 1;
        const { error: qErr } = await supabase
          .from('medications')
          .update({ quantity_remaining: newQty })
          .eq('id', input.medication_id);
        if (qErr) throw qErr;

        const prevLevel = { quantity_remaining, refill_threshold };
        const nextLevel = { quantity_remaining: newQty, refill_threshold };
        if (shouldFireRefillBecameLow(prevLevel, nextLevel)) {
          await scheduleMedicationRefillNotification(
            input.medication_name,
            newQty,
            input.medication_id,
          );
        }
      }
    },
    onMutate: async (vars) => {
      const familyId = family?.id;
      if (!familyId) return {};

      const logsKey = ['medication_logs_today', familyId] as const;
      const medsKey = ['medications', familyId] as const;

      await queryClient.cancelQueries({ queryKey: logsKey });
      await queryClient.cancelQueries({ predicate: isMedicationsListQuery });

      const prevLogs = queryClient.getQueryData<MedLogsMap>(logsKey);
      const prevMeds =
        vars.status === 'taken' && vars.quantity_remaining !== null && vars.quantity_remaining > 0
          ? queryClient.getQueryData<Medication[]>(medsKey)
          : undefined;

      queryClient.setQueryData<MedLogsMap>(logsKey, (old) => {
        const existing = old ?? {};
        const current = existing[vars.medication_id] ?? [];
        return {
          ...existing,
          [vars.medication_id]: [
            ...current,
            { status: vars.status, scheduled_at: vars.scheduled_at },
          ],
        };
      });

      if (
        vars.status === 'taken' &&
        vars.quantity_remaining !== null &&
        vars.quantity_remaining > 0
      ) {
        queryClient.setQueryData<Medication[]>(medsKey, (old) =>
          old?.map((m) =>
            m.id === vars.medication_id
              ? { ...m, quantity_remaining: vars.quantity_remaining! - 1 }
              : m
          ) ?? []
        );
      }

      return { prevLogs, prevMeds, logsKey, medsKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevLogs !== undefined && context.logsKey) {
        queryClient.setQueryData(context.logsKey, context.prevLogs);
      }
      if (context?.prevMeds !== undefined && context.medsKey) {
        queryClient.setQueryData(context.medsKey, context.prevMeds);
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['medication_logs', vars.medication_id] });
      queryClient.invalidateQueries({ queryKey: ['medication_logs_today', family?.id] });
      queryClient.invalidateQueries({ predicate: isMedicationsListQuery });
    },
  });
}

export function useRefillMedication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; quantity: number }) => {
      const { error } = await supabase
        .from('medications')
        .update({ quantity_remaining: input.quantity })
        .eq('id', input.id);
      if (error) throw error;
    },
    onMutate: async (input) => {
      const familyId = useFamilyStore.getState().family?.id;
      if (!familyId) return {};
      const key = ['medications', familyId] as const;
      await queryClient.cancelQueries({ predicate: isMedicationsListQuery });
      const prev = queryClient.getQueryData<Medication[]>(key);
      queryClient.setQueryData<Medication[]>(key, (old) =>
        old?.map((m) => (m.id === input.id ? { ...m, quantity_remaining: input.quantity } : m)) ?? []
      );
      return { prev, key };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev !== undefined && ctx.key) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: isMedicationsListQuery });
    },
  });
}
