import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { errorMessageFromUnknown } from '../../../lib/errorMessage';
import { useFamilyStore } from '../../../store/family';
import type { HealthLog, HealthLogCategory } from '../../../types';

const HEALTH_LOG_PHOTOS_BUCKET = 'health-log-photos';

export function healthLogPhotoPublicUrl(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  const { data } = supabase.storage.from(HEALTH_LOG_PHOTOS_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

async function uploadHealthLogPhoto(familyId: string, uri: string, mimeType: string): Promise<string> {
  const rawExt = mimeType.split('/')[1]?.toLowerCase() ?? 'jpg';
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
  const filePath = `${familyId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const response = await fetch(uri);
  const blob = await response.blob();
  const { error } = await supabase.storage
    .from(HEALTH_LOG_PHOTOS_BUCKET)
    .upload(filePath, blob, { contentType: mimeType });
  if (error) throw error;
  return filePath;
}

async function removeHealthLogPhotos(paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return;
  const { error } = await supabase.storage.from(HEALTH_LOG_PHOTOS_BUCKET).remove(unique);
  if (error) throw error;
}

export function useHealthLogs() {
  const family = useFamilyStore((s) => s.family);

  return useQuery({
    queryKey: ['health_logs', family?.id],
    enabled: !!family?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('health_logs')
        .select('*')
        .eq('family_id', family!.id)
        .order('logged_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as HealthLog[];
    },
  });
}

export type HealthLogPhotoPatch =
  | { mode: 'unchanged' }
  | { mode: 'clear'; storagePath: string }
  | { mode: 'upload'; uri: string; mimeType: string; replacePath: string | null };

export function useUpdateHealthLog() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);
  return useMutation({
    mutationFn: async (input: {
      id: string;
      category: HealthLogCategory;
      title: string;
      value?: string;
      unit?: string;
      notes?: string;
      photo: HealthLogPhotoPatch;
    }) => {
      const { id, photo, ...rest } = input;
      const updatePayload: Record<string, unknown> = { ...rest };

      if (photo.mode === 'clear') {
        updatePayload.photo_path = null;
        const { error } = await supabase.from('health_logs').update(updatePayload).eq('id', id);
        if (error) throw error;
        await removeHealthLogPhotos([photo.storagePath]);
        return;
      }

      if (photo.mode === 'upload') {
        const newPath = await uploadHealthLogPhoto(family!.id, photo.uri, photo.mimeType);
        updatePayload.photo_path = newPath;
        const { error } = await supabase.from('health_logs').update(updatePayload).eq('id', id);
        if (error) throw error;
        if (photo.replacePath) await removeHealthLogPhotos([photo.replacePath]);
        return;
      }

      const { error } = await supabase.from('health_logs').update(updatePayload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health_logs', family?.id] });
      queryClient.invalidateQueries({ queryKey: ['health_logs_trends', family?.id] });
    },
  });
}

export function useDeleteHealthLog() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: row, error: selErr } = await supabase
        .from('health_logs')
        .select('photo_path')
        .eq('id', id)
        .maybeSingle();
      if (selErr) throw selErr;
      if (row?.photo_path) await removeHealthLogPhotos([row.photo_path]);

      const { error } = await supabase.from('health_logs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health_logs', family?.id] });
      queryClient.invalidateQueries({ queryKey: ['health_logs_trends', family?.id] });
    },
  });
}

export function useClearAllHealthLogs() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);

  return useMutation({
    mutationFn: async () => {
      if (!family?.id) throw new Error('No family selected.');

      const { data: rows, error: listErr } = await supabase
        .from('health_logs')
        .select('photo_path')
        .eq('family_id', family.id);
      if (listErr) throw new Error(errorMessageFromUnknown(listErr));

      const paths = (rows ?? []).map((r) => r.photo_path).filter((p): p is string => !!p);
      if (paths.length > 0) await removeHealthLogPhotos(paths);

      const { error } = await supabase.from('health_logs').delete().eq('family_id', family.id);
      if (error) throw new Error(errorMessageFromUnknown(error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health_logs', family?.id] });
      queryClient.invalidateQueries({ queryKey: ['health_logs_trends', family?.id] });
    },
  });
}

export function useAddHealthLog() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);

  return useMutation({
    mutationFn: async (input: {
      category: HealthLogCategory;
      title: string;
      value?: string;
      unit?: string;
      notes?: string;
      logged_by: string;
      photo?: { uri: string; mimeType: string } | null;
    }) => {
      let photo_path: string | null = null;
      if (input.photo) {
        photo_path = await uploadHealthLogPhoto(family!.id, input.photo.uri, input.photo.mimeType);
      }

      const { photo, ...row } = input;
      const { error } = await supabase.from('health_logs').insert({
        ...row,
        photo_path,
        family_id: family!.id,
        logged_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health_logs', family?.id] });
      queryClient.invalidateQueries({ queryKey: ['health_logs_trends', family?.id] });
    },
  });
}
