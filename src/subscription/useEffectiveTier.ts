import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { parseEffectiveTier, type EffectiveTier } from './types';
import { subscriptionQueryKeys } from './queryKeys';

const STALE_MS = 60_000;

async function fetchMyEffectiveTier(): Promise<EffectiveTier> {
  const { data, error } = await supabase.rpc('get_my_effective_tier');
  if (error) throw error;
  return parseEffectiveTier(data);
}

export function useEffectiveTier() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: subscriptionQueryKeys.effectiveTier(userId),
    queryFn: fetchMyEffectiveTier,
    enabled: !!userId,
    staleTime: STALE_MS,
    retry: 1,
  });
}

export function useInvalidateEffectiveTier() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return () =>
    queryClient.invalidateQueries({
      queryKey: subscriptionQueryKeys.effectiveTier(userId),
    });
}

export function useRemoveEffectiveTierQueries() {
  const queryClient = useQueryClient();
  return () => queryClient.removeQueries({ queryKey: ['subscription', 'effectiveTier'] });
}
