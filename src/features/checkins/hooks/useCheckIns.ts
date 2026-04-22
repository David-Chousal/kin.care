import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useFamilyStore } from '../../../store/family';
import type { CheckIn, CheckInMood } from '../../../types';

export function useCheckIns() {
  const family = useFamilyStore((s) => s.family);

  return useQuery({
    queryKey: ['checkins', family?.id],
    enabled: !!family?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .eq('family_id', family!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as CheckIn[];
    },
  });
}

export function useDeleteCheckIn() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checkins').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkins', family?.id] });
    },
  });
}

export function useUpdateCheckIn() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);
  return useMutation({
    mutationFn: async (input: { id: string; mood: CheckInMood; summary: string; notes?: string }) => {
      const { id, ...fields } = input;
      const { error } = await supabase.from('checkins').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkins', family?.id] });
    },
  });
}

export function useAddCheckIn() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);

  return useMutation({
    mutationFn: async (input: {
      mood: CheckInMood;
      summary: string;
      notes?: string;
      submitted_by: string;
    }) => {
      const { error } = await supabase.from('checkins').insert({
        ...input,
        family_id: family!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkins', family?.id] });
    },
  });
}
