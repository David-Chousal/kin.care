-- Speed time-range queries for health log trends (family_id + logged_at).
create index if not exists health_logs_family_id_logged_at_idx
  on public.health_logs (family_id, logged_at desc);
