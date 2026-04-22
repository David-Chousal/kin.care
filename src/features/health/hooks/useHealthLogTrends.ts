import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useFamilyStore } from '../../../store/family';
import type { HealthLog } from '../../../types';
import { trendRangeBounds, type HealthTrendRange } from '../healthVitalSignals';

/** Cap rows per request to keep charts responsive; covers dense year-long logging. */
export const HEALTH_LOG_TRENDS_MAX_ROWS = 2500;

export function useHealthLogTrends(range: HealthTrendRange) {
  const family = useFamilyStore((s) => s.family);

  return useQuery({
    queryKey: ['health_logs_trends', family?.id, range],
    enabled: !!family?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { start, end } = trendRangeBounds(range);
      let q = supabase.from('health_logs').select('*').eq('family_id', family!.id);
      if (range !== 'all') {
        q = q.gte('logged_at', start.toISOString());
      }
      const { data, error } = await q
        .lte('logged_at', end.toISOString())
        .order('logged_at', { ascending: true })
        .limit(HEALTH_LOG_TRENDS_MAX_ROWS);
      if (error) throw error;
      return (data ?? []) as HealthLog[];
    },
  });
}
