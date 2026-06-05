create table if not exists public.tlb_employee_off_days (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  office_id uuid not null references public.company_offices(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  off_date date not null,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tlb_employee_off_days_unique unique (organization_id, office_id, user_id, off_date)
);

create index if not exists tlb_employee_off_days_org_office_date_idx
  on public.tlb_employee_off_days (organization_id, office_id, off_date);

alter table public.tlb_employee_off_days enable row level security;

create or replace function public.is_tlb_office(target_office_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.company_offices co
    where co.id = target_office_id
      and co.slug = 'three-little-birds'
  );
$$;

create or replace function public.location_planner_tlb_office_id(target_organization_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select co.id
  from public.company_offices co
  where co.organization_id = target_organization_id
    and co.slug = 'three-little-birds'
  limit 1;
$$;

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
    join public.company_offices co on co.id = p.office_id
    where p.id = auth.uid()
      and p.organization_id = target_organization_id
      and co.organization_id = target_organization_id
      and co.slug = 'three-little-birds'
      and coalesce(p.account_status, 'active') = 'active'
      and coalesce(p.is_suspended, false) = false
      and p.primary_role::text in ('admin', 'org_admin', 'super_admin', 'superadmin')
  );
$$;

create or replace function public.can_read_location_planner(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.can_manage_location_planner(target_organization_id);
$$;

grant execute on function public.is_tlb_office(uuid) to authenticated;
grant execute on function public.location_planner_tlb_office_id(uuid) to authenticated;
grant execute on function public.can_manage_location_planner(uuid) to authenticated;
grant execute on function public.can_read_location_planner(uuid) to authenticated;

drop policy if exists tlb_employee_off_days_select on public.tlb_employee_off_days;
create policy tlb_employee_off_days_select
on public.tlb_employee_off_days for select
to authenticated
using (
  public.can_manage_location_planner(organization_id)
  and public.is_tlb_office(office_id)
);

drop policy if exists tlb_employee_off_days_manage on public.tlb_employee_off_days;
create policy tlb_employee_off_days_manage
on public.tlb_employee_off_days for all
to authenticated
using (
  public.can_manage_location_planner(organization_id)
  and public.is_tlb_office(office_id)
)
with check (
  public.can_manage_location_planner(organization_id)
  and public.is_tlb_office(office_id)
);

create or replace function public.tlb_employee_off_days_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tlb_employee_off_days_updated_at on public.tlb_employee_off_days;
create trigger trg_tlb_employee_off_days_updated_at
before update on public.tlb_employee_off_days
for each row execute function public.tlb_employee_off_days_touch_updated_at();

create or replace function public.detect_assignment_conflicts(
  p_organization_id uuid,
  p_employee_id uuid,
  p_location_id uuid,
  p_slot_id uuid,
  p_start_date date,
  p_end_date date,
  p_start_time time default null,
  p_end_time time default null,
  p_exclude_assignment_id uuid default null,
  p_required_skills text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  conflicts jsonb := '[]'::jsonb;
  profile_record public.profiles%rowtype;
  overlap_count integer;
  slot_fill integer;
  slot_required integer;
  missing_skills text[];
  tlb_office_id uuid;
begin
  if not public.can_read_location_planner(p_organization_id) then
    raise exception 'Not allowed to read location planner for this organization';
  end if;

  tlb_office_id := public.location_planner_tlb_office_id(p_organization_id);

  select * into profile_record
  from public.profiles
  where id = p_employee_id
    and organization_id = p_organization_id
  limit 1;

  if not found then
    conflicts := conflicts || jsonb_build_array(jsonb_build_object(
      'code', 'employee_not_found',
      'message', 'Employee was not found in this organization.'
    ));
  elsif profile_record.office_id is distinct from tlb_office_id then
    conflicts := conflicts || jsonb_build_array(jsonb_build_object(
      'code', 'wrong_office',
      'message', 'Only Three Little Birds staff can be assigned in Location Planner.'
    ));
  elsif coalesce(profile_record.account_status, 'active') <> 'active'
    or coalesce(profile_record.is_suspended, false) then
    conflicts := conflicts || jsonb_build_array(jsonb_build_object(
      'code', 'employee_unavailable',
      'message', 'Employee is inactive or suspended.'
    ));
  end if;

  if exists (
    select 1
    from public.leave_requests lr
    where lr.organization_id = p_organization_id
      and lr.user_id = p_employee_id
      and lr.status = 'approved'
      and lr.start_date::date <= p_end_date
      and lr.end_date::date >= p_start_date
  ) then
    conflicts := conflicts || jsonb_build_array(jsonb_build_object(
      'code', 'on_leave',
      'message', 'Employee is on approved leave during these dates.'
    ));
  end if;

  if exists (
    select 1
    from public.tlb_employee_off_days od
    where od.organization_id = p_organization_id
      and od.office_id = tlb_office_id
      and od.user_id = p_employee_id
      and od.off_date between p_start_date and p_end_date
  ) then
    conflicts := conflicts || jsonb_build_array(jsonb_build_object(
      'code', 'off_day',
      'message', 'Employee has a Three Little Birds off day during these dates.'
    ));
  end if;

  if exists (
    select 1
    from public.location_status_events e
    where e.organization_id = p_organization_id
      and e.location_id = p_location_id
      and e.status in ('closed', 'limited')
      and e.start_date <= p_end_date
      and e.end_date >= p_start_date
  ) then
    conflicts := conflicts || jsonb_build_array(jsonb_build_object(
      'code', 'location_restricted',
      'message', 'Destination location has a closure or restriction during these dates.'
    ));
  end if;

  if p_slot_id is not null then
    select s.required_count into slot_required
    from public.assignment_slots s
    where s.id = p_slot_id
      and s.organization_id = p_organization_id;

    select count(*)::integer into slot_fill
    from public.employee_assignments a
    where a.slot_id = p_slot_id
      and a.organization_id = p_organization_id
      and a.status <> 'cancelled'
      and (p_exclude_assignment_id is null or a.id <> p_exclude_assignment_id);

    if slot_required is not null and slot_fill >= slot_required then
      conflicts := conflicts || jsonb_build_array(jsonb_build_object(
        'code', 'slot_full',
        'message', 'This slot is already at capacity.'
      ));
    end if;
  end if;

  select count(*)::integer into overlap_count
  from public.employee_assignments a
  where a.organization_id = p_organization_id
    and a.employee_id = p_employee_id
    and a.status <> 'cancelled'
    and (p_exclude_assignment_id is null or a.id <> p_exclude_assignment_id)
    and a.start_date <= p_end_date
    and a.end_date >= p_start_date;

  if overlap_count > 0 then
    conflicts := conflicts || jsonb_build_array(jsonb_build_object(
      'code', 'schedule_overlap',
      'message', 'Employee already has an assignment during this period.'
    ));
  end if;

  if coalesce(array_length(p_required_skills, 1), 0) > 0 then
    select coalesce(array_agg(req.skill), '{}')
    into missing_skills
    from unnest(p_required_skills) as req(skill)
    where not exists (
      select 1
      from public.employee_skills es
      where es.organization_id = p_organization_id
        and es.employee_id = p_employee_id
        and lower(es.skill) = lower(req.skill)
    );

    if coalesce(array_length(missing_skills, 1), 0) > 0 then
      conflicts := conflicts || jsonb_build_array(jsonb_build_object(
        'code', 'missing_skills',
        'message', 'Employee is missing required skills.',
        'skills', missing_skills
      ));
    end if;
  end if;

  return jsonb_build_object(
    'ok', jsonb_array_length(conflicts) = 0,
    'conflicts', conflicts
  );
end;
$$;

create or replace function public.location_planner_availability(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with tlb as (
    select public.location_planner_tlb_office_id(p_organization_id) as office_id
  ),
  leave_rows as (
    select jsonb_build_object(
      'id', lr.id,
      'user_id', lr.user_id,
      'kind', 'leave',
      'start_date', lr.start_date::date,
      'end_date', lr.end_date::date,
      'title', 'On leave',
      'reason', lr.reason,
      'employee_name', p.full_name,
      'employee_email', p.email
    ) as item
    from public.leave_requests lr
    join public.profiles p on p.id = lr.user_id
    join tlb on tlb.office_id = p.office_id
    where lr.organization_id = p_organization_id
      and lr.status = 'approved'
      and lr.start_date::date <= p_end_date
      and lr.end_date::date >= p_start_date
  ),
  off_rows as (
    select jsonb_build_object(
      'id', od.id,
      'user_id', od.user_id,
      'kind', 'off_day',
      'start_date', od.off_date,
      'end_date', od.off_date,
      'title', 'Off day',
      'reason', od.reason,
      'employee_name', p.full_name,
      'employee_email', p.email
    ) as item
    from public.tlb_employee_off_days od
    join public.profiles p on p.id = od.user_id
    join tlb on tlb.office_id = od.office_id
    where od.organization_id = p_organization_id
      and od.off_date between p_start_date and p_end_date
  )
  select coalesce(jsonb_agg(item order by item->>'start_date', item->>'employee_name'), '[]'::jsonb)
  from (
    select item from leave_rows
    union all
    select item from off_rows
  ) all_rows;
$$;

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
  tlb_office_id uuid;
begin
  if not public.can_manage_location_planner(p_organization_id) then
    raise exception 'Admin access required';
  end if;

  tlb_office_id := public.location_planner_tlb_office_id(p_organization_id);

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
        and p.office_id = tlb_office_id
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
        and p.office_id = tlb_office_id
        and coalesce(p.account_status, 'active') = 'active'
        and coalesce(p.is_suspended, false) = false
        and (p_employee_id is null or p.id = p_employee_id)
    ), '[]'::jsonb),
    'availability', public.location_planner_availability(p_organization_id, p_start_date, p_end_date)
  )
  into result;

  return result;
end;
$$;

grant execute on function public.detect_assignment_conflicts(
  uuid, uuid, uuid, uuid, date, date, time, time, uuid, text[]
) to authenticated;
grant execute on function public.location_planner_availability(uuid, date, date) to authenticated;
grant execute on function public.get_admin_planner_calendar(uuid, date, date, uuid, uuid, uuid)
  to authenticated, service_role;

create or replace function public.move_assignment(
  p_organization_id uuid,
  p_assignment_id uuid,
  p_payload jsonb
)
returns public.employee_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.employee_assignments%rowtype;
  updated_row public.employee_assignments%rowtype;
  conflict_result jsonb;
  target_slot_row public.assignment_slots%rowtype;
  target_slot_id uuid;
begin
  if not public.can_manage_location_planner(p_organization_id) then
    raise exception 'Admin access required';
  end if;

  select * into current_row
  from public.employee_assignments
  where id = p_assignment_id
    and organization_id = p_organization_id;

  if not found then
    raise exception 'Assignment not found';
  end if;

  target_slot_id := nullif(p_payload->>'slot_id', '')::uuid;

  if target_slot_id is not null then
    select * into target_slot_row
    from public.assignment_slots
    where id = target_slot_id
      and organization_id = p_organization_id;

    if not found then
      raise exception 'Slot not found';
    end if;
  end if;

  conflict_result := public.detect_assignment_conflicts(
    p_organization_id,
    current_row.employee_id,
    coalesce((p_payload->>'location_id')::uuid, target_slot_row.location_id, current_row.location_id),
    target_slot_id,
    coalesce((p_payload->>'start_date')::date, target_slot_row.start_date, current_row.start_date),
    coalesce((p_payload->>'end_date')::date, target_slot_row.end_date, current_row.end_date),
    coalesce(nullif(p_payload->>'start_time', '')::time, target_slot_row.start_time, current_row.start_time),
    coalesce(nullif(p_payload->>'end_time', '')::time, target_slot_row.end_time, current_row.end_time),
    p_assignment_id,
    coalesce(target_slot_row.required_skills, '{}')
  );

  if coalesce((conflict_result->>'ok')::boolean, false) is not true then
    raise exception 'Assignment conflict: %', conflict_result::text;
  end if;

  update public.employee_assignments
  set
    slot_id = target_slot_id,
    location_id = coalesce((p_payload->>'location_id')::uuid, target_slot_row.location_id, location_id),
    start_date = coalesce((p_payload->>'start_date')::date, target_slot_row.start_date, start_date),
    end_date = coalesce((p_payload->>'end_date')::date, target_slot_row.end_date, end_date),
    start_time = coalesce(nullif(p_payload->>'start_time', '')::time, target_slot_row.start_time, start_time),
    end_time = coalesce(nullif(p_payload->>'end_time', '')::time, target_slot_row.end_time, end_time),
    temporary_role_id = coalesce(
      nullif(p_payload->>'temporary_role_id', '')::uuid,
      target_slot_row.temporary_role_id,
      temporary_role_id
    ),
    status = coalesce(p_payload->>'status', status),
    notes = coalesce(p_payload->>'notes', notes),
    confirmed_at = case
      when coalesce(p_payload->>'status', status) = 'confirmed' then coalesce(confirmed_at, now())
      else confirmed_at
    end,
    updated_at = now()
  where id = p_assignment_id
  returning * into updated_row;

  return updated_row;
end;
$$;

grant execute on function public.move_assignment(uuid, uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
