-- ============================================================
-- Kin — Sprint 1 Schema
-- Run in: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- 1. Profiles (mirrors auth.users, populated via trigger)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz default now()
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
  created_at timestamptz default now(),
  unique (family_id, email)
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

-- Allow first member insert (family creator)
create policy "creator can insert themselves"
  on public.family_members for insert
  with check (user_id = auth.uid());

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
  using (email = (select email from public.profiles where id = auth.uid()));
