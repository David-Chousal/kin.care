-- ============================================================
-- Kin — Sprint 1 Schema
-- Run in: Supabase Dashboard > SQL Editor > New query
-- ============================================================
-- ============================================================
-- Kin — Sprint 2 Schema (run AFTER Sprint 1)
-- ============================================================

-- 6. Calendar Events
create table public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  title       text not null,
  description text,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  location    text,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz default now()
);

-- 7. Medications
create table public.medications (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  name        text not null,
  dosage      text not null,
  frequency   text not null,
  times       text[],
  notes       text,
  active      boolean not null default true,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz default now()
);

-- 8. Medication Logs
create table public.medication_logs (
  id            uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  family_id     uuid not null references public.families(id) on delete cascade,
  scheduled_at  timestamptz not null,
  taken_at      timestamptz,
  status        text not null default 'pending' check (status in ('taken', 'missed', 'pending')),
  logged_by     uuid references public.profiles(id),
  notes         text,
  created_at    timestamptz default now()
);

-- 9. Health Logs
create table public.health_logs (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  category    text not null check (category in ('symptom', 'vital', 'mood', 'note')),
  title       text not null,
  value       text,
  unit        text,
  notes       text,
  logged_by   uuid not null references public.profiles(id),
  logged_at   timestamptz not null default now(),
  created_at  timestamptz default now()
);

-- RLS: disable for development (same as Sprint 1)
alter table public.calendar_events  disable row level security;
alter table public.medications       disable row level security;
alter table public.medication_logs   disable row level security;
alter table public.health_logs       disable row level security;

-- ============================================================
-- Kin — Sprint 3 Schema (run AFTER Sprint 2)
-- ============================================================

-- 10. Documents
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  name         text not null,
  file_path    text not null,
  file_type    text,
  file_size    int,
  category     text not null default 'general'
                 check (category in ('medical', 'legal', 'insurance', 'general')),
  uploaded_by  uuid not null references public.profiles(id),
  created_at   timestamptz default now()
);

-- 11. Check-ins
create table public.checkins (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  mood          text not null check (mood in ('great', 'good', 'okay', 'concerning', 'emergency')),
  summary       text not null,
  notes         text,
  submitted_by  uuid not null references public.profiles(id),
  created_at    timestamptz default now()
);

-- 12. Push tokens
create table public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  token       text not null,
  created_at  timestamptz default now(),
  unique(user_id, token)
);

alter table public.documents    disable row level security;
alter table public.checkins     disable row level security;
alter table public.push_tokens  disable row level security;

-- 13. Visit Prep AI summaries (persisted for history / sharing)
-- Prefer applying supabase/migrations/20260421140000_visit_prep_summaries.sql via CLI or Dashboard (avoids PGRST205).
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

-- health_logs admin bulk delete: same migration file applies
-- "family admins can delete health logs" when RLS is enabled on health_logs.

notify pgrst, 'reload schema';


-- 1. Profiles (mirrors auth.users, populated via trigger)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz default now()
);

comment on column public.profiles.avatar_url is
  'Object path inside bucket profile-avatars ({user_id}/filename).';

alter table public.profiles add constraint profiles_avatar_storage_path check (
  avatar_url is null or split_part(avatar_url, '/', 1) = id::text
);

-- 2. Families
create table public.families (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  care_recipient_name  text not null,
  created_by           uuid not null references public.profiles(id),
  created_at           timestamptz default now()
);

-- 3. Family members (join table with role)
create table public.family_members (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  joined_at  timestamptz default now(),
  unique (family_id, user_id)
);

-- 4. Tasks
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  title         text not null,
  description   text,
  assigned_to   uuid references public.profiles(id),
  due_date      timestamptz,
  completed     boolean not null default false,
  completed_at  timestamptz,
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz default now()
);

-- 5. Invitations
create table public.invitations (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families(id) on delete cascade,
  email      text not null,
  role       text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  token      uuid not null default gen_random_uuid(),
  accepted   boolean not null default false,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz default now(),
  unique (family_id, email),
  constraint invitations_expires_after_created_chk check (expires_at > created_at)
);

-- ============================================================
-- Trigger: auto-create profile on sign-up
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Row-Level Security
-- ============================================================

alter table public.profiles       enable row level security;
alter table public.families       enable row level security;
alter table public.family_members enable row level security;
alter table public.tasks          enable row level security;
alter table public.invitations    enable row level security;

-- Helper: is the current user a member of a family?
create or replace function public.is_family_member(fam_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.family_members
    where family_id = fam_id and user_id = auth.uid()
  );
$$;

-- Profiles: users see their own row; family members can see each other
create policy "users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "family members can view each other"
  on public.profiles for select
  using (
    exists (
      select 1 from public.family_members fm1
      join public.family_members fm2 on fm1.family_id = fm2.family_id
      where fm1.user_id = auth.uid() and fm2.user_id = profiles.id
    )
  );

create policy "users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- Families: visible to members; created by authenticated users
create policy "family members can view family"
  on public.families for select
  using (public.is_family_member(id));

create policy "authenticated users can create family"
  on public.families for insert
  with check (auth.uid() = created_by);

create policy "admins can update family"
  on public.families for update
  using (
    exists (
      select 1 from public.family_members
      where family_id = families.id and user_id = auth.uid() and role = 'admin'
    )
  );

-- Family members: visible to members of same family
create policy "family members can view membership"
  on public.family_members for select
  using (public.is_family_member(family_id));

create policy "admins can manage membership"
  on public.family_members for insert
  with check (
    exists (
      select 1 from public.family_members
      where family_id = family_members.family_id and user_id = auth.uid() and role = 'admin'
    )
  );

-- First member row for a newly created family (creator only; not a blanket self-insert).
create policy "family creator can insert self as first member"
  on public.family_members for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.families f
      where f.id = family_members.family_id
        and f.created_by = auth.uid()
    )
    and not exists (
      select 1 from public.family_members fm
      where fm.family_id = family_members.family_id
    )
  );

-- Join via pending invitation: enforced server-side (expiry, email, role).
create policy "invitee can join via valid invitation"
  on public.family_members for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.invitations i
      where i.family_id = family_members.family_id
        and i.accepted = false
        and i.expires_at > now()
        and lower(btrim(i.email)) = lower(btrim((select p.email from public.profiles p where p.id = auth.uid())))
        and i.role = family_members.role
    )
  );

-- Tasks: visible and editable by family members
create policy "family members can view tasks"
  on public.tasks for select
  using (public.is_family_member(family_id));

create policy "family members can create tasks"
  on public.tasks for insert
  with check (public.is_family_member(family_id) and auth.uid() = created_by);

create policy "family members can update tasks"
  on public.tasks for update
  using (public.is_family_member(family_id));

create policy "task creator can delete"
  on public.tasks for delete
  using (created_by = auth.uid());

-- Invitations: admins can create; anyone with matching email can accept
create policy "family members can view invitations"
  on public.invitations for select
  using (public.is_family_member(family_id));

create policy "invitee can view own pending invitations"
  on public.invitations for select
  using (
    accepted = false
    and lower(btrim(email)) = lower(btrim((select p.email from public.profiles p where p.id = auth.uid())))
  );

create policy "admins can create invitations"
  on public.invitations for insert
  with check (
    exists (
      select 1 from public.family_members
      where family_id = invitations.family_id and user_id = auth.uid() and role = 'admin'
    )
  );

create policy "invitee can accept invitation"
  on public.invitations for update
  using (
    email = (select p.email from public.profiles p where p.id = auth.uid())
    and accepted = false
    and expires_at > now()
  )
  with check (
    email = (select p.email from public.profiles p where p.id = auth.uid())
    and accepted = true
  );

-- ============================================================
-- Storage: profile avatars (see supabase/migrations/20260424100000_profile_avatars.sql)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

drop policy if exists "profile avatars select" on storage.objects;
create policy "profile avatars select"
  on storage.objects for select
  using (
    bucket_id = 'profile-avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "profile avatars insert" on storage.objects;
create policy "profile avatars insert"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "profile avatars update" on storage.objects;
create policy "profile avatars update"
  on storage.objects for update
  using (
    bucket_id = 'profile-avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "profile avatars delete" on storage.objects;
create policy "profile avatars delete"
  on storage.objects for delete
  using (
    bucket_id = 'profile-avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );
