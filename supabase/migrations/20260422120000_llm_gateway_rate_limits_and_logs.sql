-- ============================================================
-- LLM Gateway: rate limiting + logging tables (server-side)
-- ============================================================

create table if not exists public.llm_rate_limits (
  user_id         uuid not null references auth.users(id) on delete cascade,
  purpose         text not null,
  window_seconds  integer not null check (window_seconds > 0),
  window_start    timestamptz not null default now(),
  count           integer not null default 0 check (count >= 0),
  updated_at      timestamptz not null default now(),
  primary key (user_id, purpose, window_seconds)
);

-- Server-owned table; keep RLS on with no public policies.
alter table public.llm_rate_limits enable row level security;

create index if not exists llm_rate_limits_updated_at_idx
  on public.llm_rate_limits (updated_at desc);

-- Atomic rate-limit consume helper
create or replace function public.llm_rate_limit_consume(
  p_user_id uuid,
  p_purpose text,
  p_window_seconds integer,
  p_max integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
begin
  if p_user_id is null or p_purpose is null or length(trim(p_purpose)) = 0 then
    raise exception 'invalid arguments';
  end if;
  if p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'invalid window';
  end if;
  if p_max is null or p_max <= 0 then
    raise exception 'invalid max';
  end if;

  -- Ensure row exists
  insert into public.llm_rate_limits (user_id, purpose, window_seconds, window_start, count, updated_at)
  values (p_user_id, p_purpose, p_window_seconds, v_now, 0, v_now)
  on conflict (user_id, purpose, window_seconds) do nothing;

  -- Lock the row for atomic update
  select window_start, count
    into v_window_start, v_count
  from public.llm_rate_limits
  where user_id = p_user_id
    and purpose = p_purpose
    and window_seconds = p_window_seconds
  for update;

  if v_window_start is null then
    v_window_start := v_now;
    v_count := 0;
  end if;

  -- Reset window if expired
  if v_now >= (v_window_start + make_interval(secs => p_window_seconds)) then
    v_window_start := v_now;
    v_count := 0;
  end if;

  if v_count + 1 > p_max then
    allowed := false;
    remaining := 0;
    reset_at := v_window_start + make_interval(secs => p_window_seconds);

    update public.llm_rate_limits
      set window_start = v_window_start,
          count = v_count,
          updated_at = v_now
    where user_id = p_user_id
      and purpose = p_purpose
      and window_seconds = p_window_seconds;

    return next;
    return;
  end if;

  v_count := v_count + 1;

  update public.llm_rate_limits
    set window_start = v_window_start,
        count = v_count,
        updated_at = v_now
  where user_id = p_user_id
    and purpose = p_purpose
    and window_seconds = p_window_seconds;

  allowed := true;
  remaining := greatest(p_max - v_count, 0);
  reset_at := v_window_start + make_interval(secs => p_window_seconds);
  return next;
end;
$$;

revoke all on function public.llm_rate_limit_consume(uuid, text, integer, integer) from public;
grant execute on function public.llm_rate_limit_consume(uuid, text, integer, integer) to service_role;

-- ============================================================
-- LLM request logging
-- ============================================================

do $$ begin
  create type public.llm_request_status as enum ('started', 'ok', 'error');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.llm_requests (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  family_id      uuid references public.families(id) on delete set null,
  purpose        text not null,
  provider       text not null,
  model          text not null,
  temperature    real not null default 0,
  max_tokens     integer not null default 0,
  request_chars  integer not null default 0,
  response_chars integer,
  prompt_hash    text,
  ip             text,
  status         public.llm_request_status not null default 'started',
  latency_ms     integer,
  error_message  text
);

create index if not exists llm_requests_user_created_idx
  on public.llm_requests (user_id, created_at desc);

create index if not exists llm_requests_family_created_idx
  on public.llm_requests (family_id, created_at desc);

alter table public.llm_requests enable row level security;

drop policy if exists "users can view own llm requests" on public.llm_requests;
create policy "users can view own llm requests"
  on public.llm_requests for select
  using (user_id = auth.uid());

-- No insert/update policies: only Edge Functions using service_role should write.

notify pgrst, 'reload schema';
