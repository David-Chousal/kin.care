import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useFamilyStore } from '../../../store/family';
import type { FamilyNote } from '../../../types';

const QUERY_KEY = (familyId: string | undefined) => ['notes', familyId];

export function useNotes() {
  const family = useFamilyStore((s) => s.family);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY(family?.id),
    enabled: !!family?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: notes, error } = await supabase
        .from('family_notes')
        .select('*')
        .eq('family_id', family!.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      if (!notes || notes.length === 0) return [] as FamilyNote[];

      const authorIds = [...new Set(notes.map((n) => n.created_by as string))];
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', authorIds);

      const nameMap = Object.fromEntries(
        (profileRows ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]),
      );

      return notes.map((n) => ({ ...n, author_name: nameMap[n.created_by] ?? null })) as FamilyNote[];
    },
  });

  useEffect(() => {
    if (!family?.id) return;
    const channel = supabase
      .channel(`family_notes:${family.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_notes', filter: `family_id=eq.${family.id}` },
        () => queryClient.invalidateQueries({ queryKey: QUERY_KEY(family.id) }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [family?.id, queryClient]);

  return query;
}

export function useAddNote() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);
  return useMutation({
    mutationFn: async ({ body, created_by }: { body: string; created_by: string }) => {
      const { error } = await supabase
        .from('family_notes')
        .insert({ body, created_by, family_id: family!.id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY(family?.id) }),
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { error } = await supabase.from('family_notes').update({ body }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY(family?.id) }),
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('family_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY(family?.id) }),
  });
}
