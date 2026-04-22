import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useFamilyStore } from '../../../store/family';
import type { CalendarEvent } from '../../../types';
import { cancelCalendarEventReminder, scheduleCalendarEventReminder } from '../../../lib/calendarEventReminders';

export function useCalendarEvents() {
  const family = useFamilyStore((s) => s.family);

  return useQuery({
    queryKey: ['calendar_events', family?.id],
    enabled: !!family?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('family_id', family!.id)
        .order('starts_at', { ascending: true });
      if (error) throw error;
      return data as CalendarEvent[];
    },
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);
  return useMutation({
    mutationFn: async (input: { id: string; title: string; description?: string; location?: string; starts_at: string }) => {
      const { id, ...fields } = input;
      const { data, error } = await supabase
        .from('calendar_events')
        .update(fields)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: async (event) => {
      queryClient.invalidateQueries({ queryKey: ['calendar_events', family?.id] });
      await scheduleCalendarEventReminder(event);
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendar_events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: async (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['calendar_events', family?.id] });
      await cancelCalendarEventReminder(id);
    },
  });
}

export function useAddCalendarEvent() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);

  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      starts_at: string;
      ends_at?: string;
      location?: string;
      created_by: string;
    }) => {
      const { data, error } = await supabase.from('calendar_events').insert({
        ...input,
        family_id: family!.id,
      }).select('*').single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: async (event) => {
      queryClient.invalidateQueries({ queryKey: ['calendar_events', family?.id] });
      await scheduleCalendarEventReminder(event);
    },
  });
}
