import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useFamilyStore } from '../../../store/family';
import type { Document, DocumentCategory } from '../../../types';

export const DOCUMENTS_BUCKET = 'documents';

/** Short-lived signed URLs for opening files; do not use getPublicUrl for this bucket. */
export const DOCUMENTS_SIGNED_URL_EXPIRY_SEC = 300;

export function useDocuments() {
  const family = useFamilyStore((s) => s.family);

  return useQuery({
    queryKey: ['documents', family?.id],
    enabled: !!family?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('family_id', family!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Document[];
    },
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);

  return useMutation({
    mutationFn: async (input: {
      name: string;
      fileUri: string;
      fileType: string;
      fileSize: number;
      category: DocumentCategory;
      uploaded_by: string;
    }) => {
      const ext = input.fileType.split('/')[1] ?? 'bin';
      const filePath = `${family!.id}/${Date.now()}.${ext}`;

      const response = await fetch(input.fileUri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(filePath, blob, { contentType: input.fileType });
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('documents').insert({
        family_id: family!.id,
        name: input.name,
        file_path: filePath,
        file_type: input.fileType,
        file_size: input.fileSize,
        category: input.category,
        uploaded_by: input.uploaded_by,
      });
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', family?.id] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const family = useFamilyStore((s) => s.family);

  return useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath: string }) => {
      const { error: storageError } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([filePath]);
      if (storageError) throw storageError;
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', family?.id] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', family?.id] });
    },
  });
}
