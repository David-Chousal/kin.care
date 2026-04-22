-- ============================================================
-- Enable RLS on Sprint 2 & 3 tables
-- Run in: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- Enable RLS
alter table public.calendar_events  enable row level security;
alter table public.medications       enable row level security;
alter table public.medication_logs   enable row level security;
alter table public.health_logs       enable row level security;
alter table public.documents         enable row level security;
alter table public.checkins          enable row level security;
alter table public.push_tokens       enable row level security;

-- ============================================================
-- Calendar Events
-- ============================================================
create policy "family members can view calendar events"
  on public.calendar_events for select
  using (public.is_family_member(family_id));

create policy "family members can create calendar events"
  on public.calendar_events for insert
  with check (public.is_family_member(family_id) and auth.uid() = created_by);

create policy "family members can update calendar events"
  on public.calendar_events for update
  using (public.is_family_member(family_id));

create policy "event creator can delete calendar events"
  on public.calendar_events for delete
  using (created_by = auth.uid());

-- ============================================================
-- Medications
-- ============================================================
create policy "family members can view medications"
  on public.medications for select
  using (public.is_family_member(family_id));

create policy "family members can create medications"
  on public.medications for insert
  with check (public.is_family_member(family_id) and auth.uid() = created_by);

create policy "family members can update medications"
  on public.medications for update
  using (public.is_family_member(family_id));

create policy "medication creator can delete medications"
  on public.medications for delete
  using (created_by = auth.uid());

-- ============================================================
-- Medication Logs
-- ============================================================
create policy "family members can view medication logs"
  on public.medication_logs for select
  using (public.is_family_member(family_id));

create policy "family members can create medication logs"
  on public.medication_logs for insert
  with check (public.is_family_member(family_id) and auth.uid() = logged_by);

create policy "family members can update medication logs"
  on public.medication_logs for update
  using (public.is_family_member(family_id));

create policy "log creator can delete medication logs"
  on public.medication_logs for delete
  using (logged_by = auth.uid());

-- ============================================================
-- Health Logs
-- ============================================================
create policy "family members can view health logs"
  on public.health_logs for select
  using (public.is_family_member(family_id));

create policy "family members can create health logs"
  on public.health_logs for insert
  with check (public.is_family_member(family_id) and auth.uid() = logged_by);

create policy "family members can update health logs"
  on public.health_logs for update
  using (public.is_family_member(family_id));

create policy "log creator can delete health logs"
  on public.health_logs for delete
  using (logged_by = auth.uid());

-- ============================================================
-- Documents
-- ============================================================
create policy "family members can view documents"
  on public.documents for select
  using (public.is_family_member(family_id));

create policy "family members can upload documents"
  on public.documents for insert
  with check (public.is_family_member(family_id) and auth.uid() = uploaded_by);

create policy "family members can update documents"
  on public.documents for update
  using (public.is_family_member(family_id));

create policy "document uploader can delete documents"
  on public.documents for delete
  using (uploaded_by = auth.uid());

-- ============================================================
-- Check-ins
-- ============================================================
create policy "family members can view checkins"
  on public.checkins for select
  using (public.is_family_member(family_id));

create policy "family members can create checkins"
  on public.checkins for insert
  with check (public.is_family_member(family_id) and auth.uid() = submitted_by);

create policy "checkin submitter can update checkins"
  on public.checkins for update
  using (submitted_by = auth.uid());

create policy "checkin submitter can delete checkins"
  on public.checkins for delete
  using (submitted_by = auth.uid());

-- ============================================================
-- Push Tokens (user-scoped, not family-scoped)
-- ============================================================
create policy "users can view own push tokens"
  on public.push_tokens for select
  using (user_id = auth.uid());

create policy "users can insert own push tokens"
  on public.push_tokens for insert
  with check (user_id = auth.uid());

create policy "users can delete own push tokens"
  on public.push_tokens for delete
  using (user_id = auth.uid());
