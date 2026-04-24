import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useFamilyStore } from '../store/family';
import { useSyncConnectivityStore } from '../store/syncConnectivity';

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
    if (!familyId) {
      useSyncConnectivityStore.getState().setFamilyRealtimeUi('inactive');
      return;
    }

    let cancelled = false;
    const setUi = useSyncConnectivityStore.getState().setFamilyRealtimeUi;
    setUi('inactive');

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

    channel.subscribe((status) => {
      if (cancelled) return;
      switch (status) {
        case REALTIME_SUBSCRIBE_STATES.SUBSCRIBED:
          setUi('subscribed');
          break;
        case REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR:
        case REALTIME_SUBSCRIBE_STATES.TIMED_OUT:
        case REALTIME_SUBSCRIBE_STATES.CLOSED:
          setUi('syncPaused');
          break;
        default:
          break;
      }
    });

    return () => {
      cancelled = true;
      setUi('inactive');
      supabase.removeChannel(channel);
    };
  }, [familyId, queryClient]);
}
