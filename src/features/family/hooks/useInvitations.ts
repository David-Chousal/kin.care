import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Invitation } from '../../../types';

async function fetchPendingInvitations(familyId: string): Promise<Invitation[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('family_id', familyId)
    .eq('accepted', false)
    .gt('expires_at', nowIso);

  if (error) throw error;
  return (data ?? []) as Invitation[];
}

export function useInvitations(familyId: string) {
  return useQuery<Invitation[]>({
    queryKey: ['invitations', familyId],
    queryFn: () => fetchPendingInvitations(familyId),
    enabled: !!familyId,
    staleTime: 60 * 1000,
  });
}
