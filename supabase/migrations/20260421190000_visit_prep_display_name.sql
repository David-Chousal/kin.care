-- Optional user-defined name for each visit prep summary (date/time always stored separately on generated_at).

alter table public.visit_prep_summaries
  add column if not exists display_name text;

drop policy if exists "visit prep creator can update visit prep summaries" on public.visit_prep_summaries;
create policy "visit prep creator can update visit prep summaries"
  on public.visit_prep_summaries for update
  using (created_by = auth.uid());

drop policy if exists "family admins can update visit prep summaries" on public.visit_prep_summaries;
create policy "family admins can update visit prep summaries"
  on public.visit_prep_summaries for update
  using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = visit_prep_summaries.family_id
        and fm.user_id = auth.uid()
        and fm.role = 'admin'
    )
  );

notify pgrst, 'reload schema';
