-- Add structured frequency columns to replace free-text parsing.
-- frequency_type: authoritative enum for scheduling logic
-- times_per_day: how many doses per day (null for as_needed)
-- days_of_week: jsonb array of weekday ints (0=Sun) for future weekly scheduling

alter table public.medications
  add column if not exists frequency_type text
    check (frequency_type in ('daily', 'weekly', 'as_needed')),
  add column if not exists times_per_day integer,
  add column if not exists days_of_week jsonb;

-- Backfill from existing free-text frequency column
update public.medications set
  frequency_type = case
    when lower(trim(frequency)) like '%as needed%' or lower(trim(frequency)) = 'prn' then 'as_needed'
    when lower(trim(frequency)) = 'weekly'                                             then 'weekly'
    else 'daily'
  end,
  times_per_day = case
    when lower(trim(frequency)) like '%as needed%' or lower(trim(frequency)) = 'prn' then null
    when lower(trim(frequency)) = 'weekly'                                             then 1
    when times is not null and array_length(times, 1) > 0                             then array_length(times, 1)
    when lower(trim(frequency)) in ('once daily', 'once a day', 'daily', 'qd')        then 1
    when lower(trim(frequency)) in ('twice daily', 'two times daily', 'bid')          then 2
    when lower(trim(frequency)) in ('three times daily', 'tid')                       then 3
    when lower(trim(frequency)) in ('four times daily', 'qid')                        then 4
    when lower(trim(frequency)) ~ '\d+'
      then (regexp_match(lower(trim(frequency)), '(\d+)'))[1]::integer
    else 1
  end
where frequency_type is null;

-- Lock in defaults going forward
alter table public.medications
  alter column frequency_type set not null,
  alter column frequency_type set default 'daily';
