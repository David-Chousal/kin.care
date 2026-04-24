-- Allow auth user deletion when this user appears only as operator (set_by) on others' overrides.
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.subscription_overrides'::regclass
      and c.contype = 'f'
      and a.attname = 'set_by'
  loop
    execute format('alter table public.subscription_overrides drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.subscription_overrides
  add constraint subscription_overrides_set_by_fkey
  foreign key (set_by) references auth.users (id) on delete set null;

notify pgrst, 'reload schema';
