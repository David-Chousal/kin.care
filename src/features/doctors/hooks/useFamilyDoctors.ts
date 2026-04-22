import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useFamilyStore } from '../../../store/family';
import type { FamilyDoctor } from '../../../types';

export function useFamilyDoctors() {
  const family = useFamilyStore((s) => s.family);

  return useQuery({
    queryKey: ['family_doctors', family?.id],
    enabled: !!family?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('family_doctors')
        .select('*')
        .eq('family_id', family!.id)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(normalizeDoctor) as FamilyDoctor[];
    },
  });
}

function normalizeDoctor(row: Record<string, unknown>): FamilyDoctor {
  const ids = row.linked_medication_ids;
  return {
    ...row,
    linked_medication_ids: Array.isArray(ids) ? (ids as string[]) : [],
  } as FamilyDoctor;
}

export function useAddFamilyDoctor() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);

  return useMutation({
    mutationFn: async (input: {
      name: string;
      specialty?: string;
      phone?: string;
      address?: string;
      next_appointment_at?: string | null;
      linked_medication_ids: string[];
      created_by: string;
    }) => {
      const { error } = await supabase.from('family_doctors').insert({
        family_id: family!.id,
        name: input.name,
        specialty: input.specialty?.trim() || null,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        next_appointment_at: input.next_appointment_at ?? null,
        linked_medication_ids: input.linked_medication_ids,
        created_by: input.created_by,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family_doctors', family?.id] });
    },
  });
}

export function useUpdateFamilyDoctor() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);

  return useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      specialty?: string;
      phone?: string;
      address?: string;
      next_appointment_at?: string | null;
      linked_medication_ids: string[];
    }) => {
      const { id, ...fields } = input;
      const { error } = await supabase.from('family_doctors').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family_doctors', family?.id] });
    },
  });
}

export function useDeleteFamilyDoctor() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('family_doctors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family_doctors', family?.id] });
    },
  });
}
