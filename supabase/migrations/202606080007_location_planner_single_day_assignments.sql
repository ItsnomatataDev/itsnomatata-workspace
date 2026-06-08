create or replace function public.location_planner_enforce_single_day_assignment()
returns trigger
language plpgsql
as $$
begin
  new.end_date := new.start_date;
  return new;
end;
$$;

drop trigger if exists employee_assignments_single_day on public.employee_assignments;
create trigger employee_assignments_single_day
before insert or update on public.employee_assignments
for each row
execute function public.location_planner_enforce_single_day_assignment();

update public.employee_assignments
set
  end_date = start_date,
  updated_at = now()
where end_date is distinct from start_date;

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
  p_end_date := p_start_date;

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
      and (p_exclude_assignment_id is null or a.id <> p_exclude_assignment_id)
      and a.start_date <= p_end_date
      and a.end_date >= p_start_date;

    if slot_required is not null and slot_fill >= slot_required then
      conflicts := conflicts || jsonb_build_array(jsonb_build_object(
        'code', 'slot_full',
        'message', 'This slot is already at capacity for this day.'
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

grant execute on function public.detect_assignment_conflicts(
  uuid, uuid, uuid, uuid, date, date, time, time, uuid, text[]
) to authenticated;
