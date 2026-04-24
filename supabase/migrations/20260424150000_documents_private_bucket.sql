-- Document vault: private bucket + family-scoped object policies.
-- Open files in the app via createSignedUrl (short TTL), not getPublicUrl.
-- After deploy: confirm in Dashboard → Storage → documents → Public bucket = off.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  26214400,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update set public = false;

drop policy if exists "documents select" on storage.objects;
create policy "documents select"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and public.is_family_member(split_part(name, '/', 1)::uuid)
  );

drop policy if exists "documents insert" on storage.objects;
create policy "documents insert"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and public.is_family_member(split_part(name, '/', 1)::uuid)
  );

drop policy if exists "documents update" on storage.objects;
create policy "documents update"
  on storage.objects for update
  using (
    bucket_id = 'documents'
    and public.is_family_member(split_part(name, '/', 1)::uuid)
  );

drop policy if exists "documents delete" on storage.objects;
create policy "documents delete"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and public.is_family_member(split_part(name, '/', 1)::uuid)
  );

notify pgrst, 'reload schema';
