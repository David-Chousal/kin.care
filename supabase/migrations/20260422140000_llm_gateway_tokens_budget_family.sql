-- LLM gateway: token usage columns, monthly token budget RPC, error_message length

alter table public.llm_requests
  add column if not exists prompt_tokens integer,
  add column if not exists completion_tokens integer,
  add column if not exists total_tokens integer;

comment on column public.llm_requests.prompt_tokens is 'Provider-reported prompt tokens (nullable if unavailable)';
comment on column public.llm_requests.completion_tokens is 'Provider-reported completion tokens (nullable if unavailable)';
comment on column public.llm_requests.total_tokens is 'Provider-reported total tokens (nullable if unavailable)';

-- Cap stored error text to avoid accidental large payloads
update public.llm_requests
set error_message = left(error_message, 512)
where error_message is not null and length(error_message) > 512;

alter table public.llm_requests
  alter column error_message type varchar(512);

-- Monthly (calendar month, UTC) token budget check with row lock to reduce races
create or replace function public.llm_token_monthly_allow(
  p_user_id uuid,
  p_additional_upper_bound integer,
  p_cap integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start timestamptz := date_trunc('month', (now() at time zone 'utc')) at time zone 'utc';
  v_sum bigint;
begin
  if p_user_id is null then
    raise exception 'invalid user';
  end if;
  if p_additional_upper_bound is null or p_additional_upper_bound < 0 then
    raise exception 'invalid bound';
  end if;
  if p_cap is null or p_cap < 0 then
    raise exception 'invalid cap';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select coalesce(sum(total_tokens), 0)::bigint
    into v_sum
  from public.llm_requests
  where user_id = p_user_id
    and total_tokens is not null
    and created_at >= v_month_start;

  return (v_sum + p_additional_upper_bound::bigint <= p_cap::bigint);
end;
$$;

revoke all on function public.llm_token_monthly_allow(uuid, integer, integer) from public;
grant execute on function public.llm_token_monthly_allow(uuid, integer, integer) to service_role;

notify pgrst, 'reload schema';
