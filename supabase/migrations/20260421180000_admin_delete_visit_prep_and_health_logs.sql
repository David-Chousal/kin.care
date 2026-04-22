-- Allow family admins to delete any visit prep summary or health log row (bulk clear in app).
-- ORs with existing creator-only delete policies.

drop policy if exists "family admins can delete visit prep summaries" on public.visit_prep_summaries;
create policy "family admins can delete visit prep summaries"
  on public.visit_prep_summaries for delete
  using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = visit_prep_summaries.family_id
        and fm.user_id = auth.uid()
        and fm.role = 'admin'
    )
  );

drop policy if exists "family admins can delete health logs" on public.health_logs;
create policy "family admins can delete health logs"
  on public.health_logs for delete
  using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = health_logs.family_id
        and fm.user_id = auth.uid()
        and fm.role = 'admin'
    )
  );

notify pgrst, 'reload schema';
