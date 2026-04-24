import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Task } from '../../../types';

const TASK_SELECT = `
  *,
  assigned_profile:profiles!assigned_to(id, full_name, email, avatar_url)
`;

async function fetchTasks(familyId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .eq('family_id', familyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Task[];
}

export function useUpdateTask(familyId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      title,
      description,
      due_date,
      assigned_to,
    }: {
      id: string;
      title: string;
      description?: string;
      due_date?: string;
      assigned_to?: string | null;
    }) => {
      const patch: Record<string, unknown> = {
        title,
        description: description || null,
        due_date: due_date || null,
      };
      if (assigned_to !== undefined) patch.assigned_to = assigned_to;
      const { error } = await supabase.from('tasks').update(patch).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, title, description, due_date, assigned_to }) => {
      const key = ['tasks', familyId] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<Task[]>(key);
      queryClient.setQueryData<Task[]>(key, (old) =>
        old?.map((t) => {
          if (t.id !== id) return t;
          return {
            ...t,
            title,
            ...(description !== undefined ? { description: description || null } : {}),
            ...(due_date !== undefined ? { due_date: due_date || null } : {}),
            ...(assigned_to !== undefined ? { assigned_to } : {}),
          };
        }) ?? []
      );
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined && ctx.key) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', familyId] });
    },
  });
}

export function useDeleteTask(familyId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      const key = ['tasks', familyId] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<Task[]>(key);
      queryClient.setQueryData<Task[]>(key, (old) => old?.filter((t) => t.id !== id) ?? []);
      return { prev, key };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev !== undefined && ctx.key) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', familyId] });
    },
  });
}

export function useCompleteTask(familyId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from('tasks')
        .update({ completed, completed_at: completed ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', familyId] });
      const prev = queryClient.getQueryData<Task[]>(['tasks', familyId]);
      queryClient.setQueryData<Task[]>(['tasks', familyId], (old) =>
        old?.map((t) => t.id === id
          ? { ...t, completed, completed_at: completed ? new Date().toISOString() : null }
          : t
        ) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['tasks', familyId], context.prev);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', familyId] });
    },
  });
}

export function useTasks(familyId: string | null) {
  return useQuery({
    queryKey: ['tasks', familyId],
    queryFn: () => fetchTasks(familyId!),
    enabled: !!familyId,
    staleTime: 30 * 1000,
  });
}
