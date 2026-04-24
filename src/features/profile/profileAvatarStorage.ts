import { supabase } from '../../lib/supabase';

export const PROFILE_AVATARS_BUCKET = 'profile-avatars';

export function profileAvatarPublicUrl(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  const { data } = supabase.storage.from(PROFILE_AVATARS_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

function extFromMime(mimeType: string): string {
  const raw = mimeType.split('/')[1]?.toLowerCase() ?? 'jpg';
  if (raw === 'jpeg') return 'jpg';
  return raw;
}

export async function uploadProfileAvatar(
  userId: string,
  uri: string,
  mimeType: string,
): Promise<string> {
  const ext = extFromMime(mimeType);
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const response = await fetch(uri);
  const blob = await response.blob();
  const { error } = await supabase.storage
    .from(PROFILE_AVATARS_BUCKET)
    .upload(filePath, blob, { contentType: mimeType, upsert: false });
  if (error) throw error;
  return filePath;
}

export async function removeProfileAvatarPaths(paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return;
  const { error } = await supabase.storage.from(PROFILE_AVATARS_BUCKET).remove(unique);
  if (error) throw error;
}
