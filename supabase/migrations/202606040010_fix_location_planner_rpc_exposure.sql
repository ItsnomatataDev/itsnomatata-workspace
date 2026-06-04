create or replace function public.can_manage_location_planner(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = target_organization_id
      and coalesce(p.account_status, 'active') = 'active'
      and coalesce(p.is_suspended, false) = false
      and p.primary_role::text in (
        'admin',
        'org_admin',
        'super_admin',
        'superadmin',
        'manager'
      )
  );
$$;

create or replace function public.can_read_location_planner(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = target_organization_id
      and coalesce(p.account_status, 'active') = 'active'
      and coalesce(p.is_suspended, false) = false
  );
$$;

grant execute on function public.can_manage_location_planner(uuid) to authenticated;
grant execute on function public.can_read_location_planner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Drop prior signatures (with or without defaulted args)
-- ---------------------------------------------------------------------------

drop function if exists public.get_admin_planner_calendar(uuid, date, date);
drop function if exists public.get_admin_planner_calendar(uuid, date, date, uuid, uuid, uuid);

drop function if exists public.get_employee_calendar_assignments(uuid, date, date);
drop function if exists public.get_employee_calendar_assignments(uuid, date, date, uuid);

-- ---------------------------------------------------------------------------
-- Calendar RPCs (no default args — matches Supabase client RPC calls)
-- ---------------------------------------------------------------------------

create or replace function public.get_admin_planner_calendar(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date,
  p_location_id uuid,
  p_role_id uuid,
  p_employee_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result jsonb;
begin
  if not public.can_manage_location_planner(p_organization_id) then
    raise exception 'Admin access required';
  end if;

  select jsonb_build_object(
    'locations', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.name)
      from public.company_locations l
      where l.organization_id = p_organization_id
        and l.is_active = true
        and (p_location_id is null or l.id = p_location_id)
    ), '[]'::jsonb),
    'roles', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.name)
      from public.company_roles r
      where r.organization_id = p_organization_id
        and r.is_active = true
        and (p_role_id is null or r.id = p_role_id)
    ), '[]'::jsonb),
    'status_events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.start_date)
      from public.location_status_events e
      where e.organization_id = p_organization_id
        and e.end_date >= p_start_date
        and e.start_date <= p_end_date
        and (p_location_id is null or e.location_id = p_location_id)
    ), '[]'::jsonb),
    'slots', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.start_date, s.title)
      from public.assignment_slots s
      where s.organization_id = p_organization_id
        and s.end_date >= p_start_date
        and s.start_date <= p_end_date
        and (p_location_id is null or s.location_id = p_location_id)
        and (p_role_id is null or s.temporary_role_id = p_role_id)
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'assignment', to_jsonb(a),
          'employee_name', p.full_name,
          'employee_email', p.email,
          'location_name', l.name,
          'role_name', r.name
        )
        order by a.start_date, a.start_time nulls last
      )
      from public.employee_assignments a
      join public.profiles p on p.id = a.employee_id
      join public.company_locations l on l.id = a.location_id
      left join public.company_roles r on r.id = a.temporary_role_id
      where a.organization_id = p_organization_id
        and a.end_date >= p_start_date
        and a.start_date <= p_end_date
        and (p_location_id is null or a.location_id = p_location_id)
        and (p_role_id is null or a.temporary_role_id = p_role_id)
        and (p_employee_id is null or a.employee_id = p_employee_id)
    ), '[]'::jsonb),
    'employees', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'email', p.email,
          'primary_role', p.primary_role,
          'department', p.department,
          'skills', coalesce((
            select jsonb_agg(es.skill order by es.skill)
            from public.employee_skills es
            where es.employee_id = p.id
              and es.organization_id = p_organization_id
          ), '[]'::jsonb)
        )
        order by p.full_name nulls last, p.email
      )
      from public.profiles p
      where p.organization_id = p_organization_id
        and coalesce(p.account_status, 'active') <> 'deleted'
        and (p_employee_id is null or p.id = p_employee_id)
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

create or replace function public.get_employee_calendar_assignments(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date,
  p_location_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.can_read_location_planner(p_organization_id) then
    raise exception 'Not allowed';
  end if;

  return jsonb_build_object(
    'viewer_id', auth.uid(),
    'locations', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.name)
      from public.company_locations l
      where l.organization_id = p_organization_id
        and l.is_active = true
        and (p_location_id is null or l.id = p_location_id)
    ), '[]'::jsonb),
    'status_events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.start_date)
      from public.location_status_events e
      where e.organization_id = p_organization_id
        and e.end_date >= p_start_date
        and e.start_date <= p_end_date
        and (p_location_id is null or e.location_id = p_location_id)
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'assignment', to_jsonb(a),
          'employee_id', a.employee_id,
          'employee_name', p.full_name,
          'location_name', l.name,
          'location_status', l.status,
          'role_name', r.name,
          'is_mine', a.employee_id = auth.uid()
        )
        order by a.start_date, a.start_time nulls last
      )
      from public.employee_assignments a
      join public.profiles p on p.id = a.employee_id
      join public.company_locations l on l.id = a.location_id
      left join public.company_roles r on r.id = a.temporary_role_id
      where a.organization_id = p_organization_id
        and a.status <> 'cancelled'
        and a.end_date >= p_start_date
        and a.start_date <= p_end_date
        and (p_location_id is null or a.location_id = p_location_id)
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_admin_planner_calendar(uuid, date, date, uuid, uuid, uuid)
  to authenticated, service_role;

grant execute on function public.get_employee_calendar_assignments(uuid, date, date, uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';
