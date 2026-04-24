import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/auth';
import { useFamilyStore } from '../../../store/family';
import { Family } from '../../../types';

async function fetchFamilyForUser(userId: string): Promise<Family | null> {
  const { data, error } = await supabase
    .from('family_members')
    .select('families(*)')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;

  const families = data.families;
  if (!families || Array.isArray(families)) return null;

  return families as Family;
}

export function useFamily() {
  const { user } = useAuthStore();
  const setFamily = useFamilyStore((s) => s.setFamily);

  const query = useQuery<Family | null>({
    queryKey: ['family', user?.id],
    queryFn: () => (user?.id ? fetchFamilyForUser(user.id) : Promise.resolve(null)),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (query.data !== undefined) setFamily(query.data);
  }, [query.data]);

  return query;
}
