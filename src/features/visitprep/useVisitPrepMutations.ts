import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useFamilyStore } from '../../store/family';
import { errorMessageFromUnknown } from '../../lib/errorMessage';

export function useDeleteVisitPrepSummary() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('visit_prep_summaries').delete().eq('id', id);
      if (error) throw new Error(errorMessageFromUnknown(error));
    },
    onSuccess: () => {
      if (family?.id) void queryClient.invalidateQueries({ queryKey: ['visitPrepSummaries', family.id] });
    },
  });
}

export function useClearAllVisitPrepSummaries() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);

  return useMutation({
    mutationFn: async () => {
      if (!family?.id) throw new Error('No family selected.');
      const { error } = await supabase.from('visit_prep_summaries').delete().eq('family_id', family.id);
      if (error) throw new Error(errorMessageFromUnknown(error));
    },
    onSuccess: () => {
      if (family?.id) void queryClient.invalidateQueries({ queryKey: ['visitPrepSummaries', family.id] });
    },
  });
}

export function useUpdateVisitPrepSummaryDisplayName() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);

  return useMutation({
    mutationFn: async (input: { id: string; display_name: string | null }) => {
      const { error } = await supabase
        .from('visit_prep_summaries')
        .update({ display_name: input.display_name })
        .eq('id', input.id);
      if (error) throw new Error(errorMessageFromUnknown(error));
    },
    onSuccess: () => {
      if (family?.id) void queryClient.invalidateQueries({ queryKey: ['visitPrepSummaries', family.id] });
    },
  });
}
