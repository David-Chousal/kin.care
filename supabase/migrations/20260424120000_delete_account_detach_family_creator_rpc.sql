-- Server-side guarantee: no family row may keep created_by pointing at a user we are deleting from auth.
-- Invoked by Edge Function delete-account (service_role) right before auth.admin.deleteUser.

create or replace function public.delete_account_detach_family_creator(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  v_succ uuid;
begin
  loop
    select f.id into fid
    from public.families f
    where f.created_by = p_user_id
    limit 1;

    exit when fid is null;

    select fm.user_id into v_succ
    from public.family_members fm
    where fm.family_id = fid
      and fm.user_id is distinct from p_user_id
    order by
      case fm.role when 'admin' then 0 when 'member' then 1 else 2 end,
      fm.joined_at
    limit 1;

    if v_succ is not null then
      update public.families set created_by = v_succ where id = fid;
    else
      delete from public.families where id = fid;
    end if;
  end loop;
end;
$$;

comment on function public.delete_account_detach_family_creator(uuid) is
  'Account deletion: reassign families.created_by to another member, or delete the family if none remain. service_role only.';

revoke all on function public.delete_account_detach_family_creator(uuid) from public;
grant execute on function public.delete_account_detach_family_creator(uuid) to service_role;

notify pgrst, 'reload schema';
