-- Visit Prep AI summaries (persisted for History tab)
-- Apply with: supabase db push   OR   paste into Dashboard → SQL Editor → Run

create table if not exists public.visit_prep_summaries (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  content       text not null,
  generated_at  timestamptz not null default now(),
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz default now(),
  display_name  text
);

create index if not exists visit_prep_summaries_family_generated_idx
  on public.visit_prep_summaries (family_id, generated_at desc);

alter table public.visit_prep_summaries enable row level security;

drop policy if exists "family members can view visit prep summaries" on public.visit_prep_summaries;
drop policy if exists "family members can insert visit prep summaries" on public.visit_prep_summaries;
drop policy if exists "visit prep creator can delete visit prep summaries" on public.visit_prep_summaries;

create policy "family members can view visit prep summaries"
  on public.visit_prep_summaries for select
  using (public.is_family_member(family_id));

create policy "family members can insert visit prep summaries"
  on public.visit_prep_summaries for insert
  with check (public.is_family_member(family_id) and auth.uid() = created_by);

create policy "visit prep creator can delete visit prep summaries"
  on public.visit_prep_summaries for delete
  using (created_by = auth.uid());

notify pgrst, 'reload schema';
