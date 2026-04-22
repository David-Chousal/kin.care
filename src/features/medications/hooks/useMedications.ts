import { useQuery, useMutation, useQueryClient, type Query } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../../lib/supabase';
import { useFamilyStore } from '../../../store/family';
import type { Medication, MedicationLog } from '../../../types';
import { inferFrequencyTypeFromLegacyFrequency } from '../scheduleUtils';

async function scheduleRefillAlert(medicationName: string, quantityRemaining: number) {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Refill reminder',
      body: `${medicationName} is running low — only ${quantityRemaining} left.`,
      sound: true,
    },
    trigger: null, // fire immediately
  });
}

// ─── Schedule helpers ────────────────────────────────────────────────────────

export type DoseStatusKey = 'taken' | 'partial' | 'missed' | 'pending' | 'as_needed';

export interface MedSchedule {
  dosesRequired: number;
  periodType: 'daily' | 'weekly' | 'as_needed';
}

export type RawMedLog = { status: string; scheduled_at: string };
export type MedLogsMap = Record<string, RawMedLog[]>;

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

export function computeDoseStatus(med: Medication, logs: RawMedLog[] | undefined): DoseStatusKey {
  const { dosesRequired, periodType } = parseMedicationSchedule(med);
  if (periodType === 'as_needed') return 'as_needed';

  const now = new Date();
  const windowStart = new Date(now);
  if (periodType === 'daily') {
    windowStart.setHours(0, 0, 0, 0);
  } else {
    windowStart.setDate(windowStart.getDate() - 7);
    windowStart.setHours(0, 0, 0, 0);
  }

  const inWindow = (logs ?? []).filter((l) => new Date(l.scheduled_at) >= windowStart);
  const taken = inWindow.filter((l) => l.status === 'taken').length;
  const missed = inWindow.filter((l) => l.status === 'missed').length;

  if (taken >= dosesRequired) return 'taken';
  if (taken > 0) return 'partial';
  if (missed > 0) return 'missed';
  return 'pending';
}

/** Expected dose slots for “today” summary (daily = doses per day; weekly = 1 rolling slot). */
export function scheduledDoseSlotsToday(med: Medication): number {
  const { dosesRequired, periodType } = parseMedicationSchedule(med);
  if (periodType === 'as_needed') return 0;
  if (periodType === 'weekly') return 1;
  return dosesRequired;
}

/**
 * How many of today’s expected slots are satisfied.
 * Daily: count of `taken` logs since local midnight, capped at `dosesRequired`.
 * Weekly: 1 if the rolling week window is fully satisfied (same rule as {@link computeDoseStatus}).
 */
export function takenDoseSlotsToday(
  med: Medication,
  logs: RawMedLog[] | undefined,
  todayStart: Date
): number {
  const { dosesRequired, periodType } = parseMedicationSchedule(med);
  if (periodType === 'as_needed') return 0;
  if (periodType === 'weekly') {
    return computeDoseStatus(med, logs) === 'taken' ? 1 : 0;
  }
  const taken = (logs ?? []).filter(
    (l) => new Date(l.scheduled_at) >= todayStart && l.status === 'taken'
  ).length;
  return Math.min(taken, dosesRequired);
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
      notes?: string;
      created_by: string;
      quantity_remaining?: number | null;
      refill_threshold?: number | null;
    }) => {
      const familyId = useFamilyStore.getState().family?.id;
      if (!familyId) throw new Error('No family selected. Join or create a family first.');
      const { error } = await supabase.from('medications').insert({
        family_id: familyId,
        name: input.name,
        dosage: input.dosage,
        frequency: input.frequency,
        times: input.times,
        notes: input.notes ?? null,
        created_by: input.created_by,
        quantity_remaining: input.quantity_remaining ?? null,
        refill_threshold: input.refill_threshold ?? null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ predicate: isMedicationsListQuery });
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
      notes?: string;
      quantity_remaining?: number | null;
      refill_threshold?: number | null;
    }) => {
      const { id, ...rest } = input;
      const { error } = await supabase.from('medications').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ predicate: isMedicationsListQuery });
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

        if (refill_threshold !== null && newQty <= refill_threshold) {
          await scheduleRefillAlert(input.medication_name, newQty);
        }
      }
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ['medication_logs_today', family?.id] });
      const prev = queryClient.getQueryData<MedLogsMap>(['medication_logs_today', family?.id]);
      queryClient.setQueryData<MedLogsMap>(
        ['medication_logs_today', family?.id],
        (old) => {
          const existing = old ?? {};
          const current = existing[vars.medication_id] ?? [];
          return {
            ...existing,
            [vars.medication_id]: [
              ...current,
              { status: vars.status, scheduled_at: vars.scheduled_at },
            ],
          };
        }
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev !== undefined) {
        queryClient.setQueryData(['medication_logs_today', family?.id], context.prev);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: isMedicationsListQuery });
    },
  });
}
