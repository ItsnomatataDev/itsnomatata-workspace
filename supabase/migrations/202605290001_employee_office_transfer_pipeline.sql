

create or replace function public.normalize_company_office_slug(input_slug text)
returns text
language sql
immutable
as $$
  select case
    when input_slug is null or btrim(input_slug) = '' then null
    when lower(replace(replace(btrim(input_slug), '_', '-'), ' ', '-')) in (
      'itsnomatata',
      'its-nomatata',
      'its-no-matata',
      'it-s-no-matata'
    ) then 'its-no-matata'
    when lower(replace(replace(btrim(input_slug), '_', '-'), ' ', '-')) in (
      'three-little-birds',
      'three-little-birds',
      'three-little-birds',
      'tlb'
    )
      or lower(replace(replace(btrim(input_slug), '_', '-'), ' ', '-')) like '%little-bird%'
      then 'three-little-birds'
    else lower(replace(replace(btrim(input_slug), '_', '-'), ' ', '-'))
  end;
$$;

create or replace function public.can_manage_employee_access(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.is_platform_admin()
    or public.is_active_org_admin(target_organization_id)
    or exists (
      select 1
      from public.organization_members om
      join public.profiles actor on actor.id = auth.uid()
      where om.user_id = auth.uid()
        and om.organization_id = target_organization_id
        and om.status::text = 'active'
        and coalesce(actor.account_status, 'active') = 'active'
        and coalesce(actor.is_suspended, false) = false
        and om.role::text in ('manager', 'hr', 'admin', 'org_admin')
    );
$$;

grant execute on function public.normalize_company_office_slug(text) to authenticated;
grant execute on function public.can_manage_employee_access(uuid) to authenticated;

create or replace function public.admin_transfer_employee_office(
  target_user_id uuid,
  target_office_id uuid default null,
  change_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_old_office_id uuid;
  v_old_office_name text;
  v_new_office_name text;
  v_actor_id uuid;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  v_org_id := public.current_user_organization_id();
  if v_org_id is null then
    raise exception 'No active organization context for this session';
  end if;

  if not public.can_manage_employee_access(v_org_id) then
    raise exception 'Not authorized to change employee office assignments';
  end if;

  if target_user_id = v_actor_id then
    raise exception 'You cannot change your own office assignment here';
  end if;

  select p.office_id, coalesce(co.name, 'Unassigned')
  into v_old_office_id, v_old_office_name
  from public.profiles p
  left join public.company_offices co on co.id = p.office_id
  where p.id = target_user_id
    and p.organization_id = v_org_id;

  if not found then
    raise exception 'Employee was not found in your organization';
  end if;

  if target_office_id is not null then
    select co.name
    into v_new_office_name
    from public.company_offices co
    where co.id = target_office_id
      and co.organization_id = v_org_id;

    if not found then
      raise exception 'Selected office was not found in this organization';
    end if;
  else
    v_new_office_name := 'Unassigned';
  end if;

  if v_old_office_id is not distinct from target_office_id then
    return jsonb_build_object(
      'changed', false,
      'old_office_id', v_old_office_id,
      'new_office_id', target_office_id
    );
  end if;

  update public.profiles
  set
    office_id = target_office_id,
    updated_at = now()
  where id = target_user_id
    and organization_id = v_org_id;

  insert into public.admin_audit_logs (
    organization_id,
    actor_user_id,
    target_user_id,
    action,
    reason,
    metadata
  )
  values (
    v_org_id,
    v_actor_id,
    target_user_id,
    'employee_office_updated',
    nullif(btrim(change_reason), ''),
    jsonb_build_object(
      'old_office_id', v_old_office_id,
      'new_office_id', target_office_id,
      'old_office_name', v_old_office_name,
      'new_office_name', v_new_office_name
    )
  );

  return jsonb_build_object(
    'changed', true,
    'old_office_id', v_old_office_id,
    'new_office_id', target_office_id,
    'old_office_name', v_old_office_name,
    'new_office_name', v_new_office_name
  );
end;
$$;

grant execute on function public.admin_transfer_employee_office(uuid, uuid, text) to authenticated;
