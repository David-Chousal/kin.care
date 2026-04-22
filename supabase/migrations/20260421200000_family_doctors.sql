-- Family doctor contacts (care team reference + emergency context)

create table if not exists public.family_doctors (
  id                      uuid primary key default gen_random_uuid(),
  family_id               uuid not null references public.families(id) on delete cascade,
  name                    text not null,
  specialty               text,
  phone                   text,
  address                 text,
  next_appointment_at     timestamptz,
  linked_medication_ids uuid[] not null default '{}',
  created_by              uuid not null references public.profiles(id),
  created_at              timestamptz not null default now()
);

create index if not exists family_doctors_family_idx
  on public.family_doctors (family_id, created_at desc);

alter table public.family_doctors enable row level security;

drop policy if exists "family members can view family doctors" on public.family_doctors;
drop policy if exists "family members can insert family doctors" on public.family_doctors;
drop policy if exists "family members can update family doctors" on public.family_doctors;
drop policy if exists "doctor creator can delete family doctors" on public.family_doctors;

create policy "family members can view family doctors"
  on public.family_doctors for select
  using (public.is_family_member(family_id));

create policy "family members can insert family doctors"
  on public.family_doctors for insert
  with check (public.is_family_member(family_id) and auth.uid() = created_by);

create policy "family members can update family doctors"
  on public.family_doctors for update
  using (public.is_family_member(family_id));

create policy "doctor creator can delete family doctors"
  on public.family_doctors for delete
  using (created_by = auth.uid());

notify pgrst, 'reload schema';
