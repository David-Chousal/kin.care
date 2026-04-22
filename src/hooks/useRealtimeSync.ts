import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useFamilyStore } from '../store/family';

type TableSync = {
  table: string;
  invalidations: (familyId: string) => Array<{ queryKey: unknown[] }>;
};

const TABLE_SYNCS: TableSync[] = [
  {
    table: 'medication_logs',
    invalidations: (id) => [
      { queryKey: ['medication_logs_today', id] },
      { queryKey: ['medication_logs'] },
    ],
  },
  {
    table: 'medications',
    invalidations: (id) => [{ queryKey: ['medications', id] }],
  },
  {
    table: 'tasks',
    invalidations: (id) => [{ queryKey: ['tasks', id] }],
  },
  {
    table: 'checkins',
    invalidations: (id) => [{ queryKey: ['checkins', id] }],
  },
  {
    table: 'health_logs',
    invalidations: (id) => [{ queryKey: ['health_logs', id] }],
  },
  {
    table: 'calendar_events',
    invalidations: (id) => [{ queryKey: ['calendar_events', id] }],
  },
  {
    table: 'documents',
    invalidations: (id) => [{ queryKey: ['documents', id] }],
  },
];

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const familyId = useFamilyStore((s) => s.family?.id);

  useEffect(() => {
    if (!familyId) return;

    const channel = supabase.channel(`family-sync:${familyId}`);

    for (const { table, invalidations } of TABLE_SYNCS) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` },
        () => {
          for (const opts of invalidations(familyId)) {
            queryClient.invalidateQueries(opts);
          }
        },
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId, queryClient]);
}
