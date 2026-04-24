-- ============================================================
-- Family Notes
-- Replaces legacy remote version `20260422` (invalid filename pattern).
-- Idempotent: safe if family_notes already exists from an older apply.
-- ============================================================

create table if not exists public.family_notes (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  body        text not null,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists family_notes_family_id_idx on public.family_notes (family_id, created_at desc);

alter table public.family_notes enable row level security;

drop policy if exists "family members can view notes" on public.family_notes;
create policy "family members can view notes"
  on public.family_notes for select
  using (public.is_family_member(family_id));

drop policy if exists "family members can create notes" on public.family_notes;
create policy "family members can create notes"
  on public.family_notes for insert
  with check (public.is_family_member(family_id) and auth.uid() = created_by);

drop policy if exists "note author can update" on public.family_notes;
create policy "note author can update"
  on public.family_notes for update
  using (created_by = auth.uid());

drop policy if exists "note author can delete" on public.family_notes;
create policy "note author can delete"
  on public.family_notes for delete
  using (created_by = auth.uid());

-- keep updated_at current
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists family_notes_updated_at on public.family_notes;
create trigger family_notes_updated_at
  before update on public.family_notes
  for each row execute procedure public.set_updated_at();

-- enable realtime (ignore if already in publication)
do $$
begin
  alter publication supabase_realtime add table public.family_notes;
exception
  when duplicate_object then null;
end;
$$;

notify pgrst, 'reload schema';
