import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Task } from '../../../types';

async function fetchTasks(familyId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Task[];
}

export function useTasks(familyId: string | null) {
  return useQuery({
    queryKey: ['tasks', familyId],
    queryFn: () => fetchTasks(familyId!),
    enabled: !!familyId,
    staleTime: 30 * 1000,
  });
}
