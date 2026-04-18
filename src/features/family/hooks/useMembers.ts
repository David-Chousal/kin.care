import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { FamilyMember, Profile } from '../../../types';

type FamilyMemberWithProfile = FamilyMember & { profiles: Profile | null };

async function fetchMembers(familyId: string): Promise<FamilyMemberWithProfile[]> {
  const { data, error } = await supabase
    .from('family_members')
    .select('*, profiles(*)')
    .eq('family_id', familyId);

  if (error) throw error;
  return (data ?? []) as FamilyMemberWithProfile[];
}

export function useMembers(familyId: string) {
  return useQuery<FamilyMemberWithProfile[]>({
    queryKey: ['members', familyId],
    queryFn: () => fetchMembers(familyId),
    enabled: !!familyId,
    staleTime: 60 * 1000,
  });
}
