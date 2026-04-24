-- Public bucket for store submission legal pages (Privacy Policy + Terms).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'legal',
  'legal',
  true,
  1048576,
  array['text/html', 'text/plain']
)
on conflict (id) do nothing;

notify pgrst, 'reload schema';

