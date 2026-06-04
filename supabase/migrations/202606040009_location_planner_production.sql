
create or replace function public.location_planner_user_org_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select p.organization_id
  from public.profiles p
  where p.id = auth.uid()
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

create or replace function public.location_planner_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

grant execute on function public.location_planner_user_org_id() to authenticated;
grant execute on function public.can_manage_location_planner(uuid) to authenticated;
grant execute on function public.can_read_location_planner(uuid) to authenticated;


create table if not exists public.company_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  type text not null default 'department',
  status text not null default 'open',
  capacity integer,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_locations_status_check
    check (status in ('open', 'closed', 'limited')),
  constraint company_locations_type_check
    check (type in ('activity_site', 'office', 'department', 'team', 'other'))
);

create table if not exists public.company_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text,
  description text,
  required_skills text[] not null default '{}',
  is_temporary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.location_status_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.company_locations(id) on delete cascade,
  title text not null,
  reason text,
  status text not null,
  start_date date not null,
  end_date date not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint location_status_events_status_check
    check (status in ('open', 'closed', 'limited')),
  constraint location_status_events_date_check
    check (end_date >= start_date)
);

create table if not exists public.assignment_slots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.company_locations(id) on delete cascade,
  title text not null,
  temporary_role_id uuid references public.company_roles(id) on delete set null,
  required_count integer not null default 1,
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  required_skills text[] not null default '{}',
  priority text not null default 'normal',
  notes text,
  status text not null default 'open',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignment_slots_priority_check
    check (priority in ('low', 'normal', 'high')),
  constraint assignment_slots_status_check
    check (status in ('open', 'filled', 'closed')),
  constraint assignment_slots_date_check
    check (end_date >= start_date),
  constraint assignment_slots_required_count_check
    check (required_count >= 1)
);

create table if not exists public.employee_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  slot_id uuid references public.assignment_slots(id) on delete set null,
  location_id uuid not null references public.company_locations(id) on delete cascade,
  temporary_role_id uuid references public.company_roles(id) on delete set null,
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  status text not null default 'draft',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_assignments_status_check
    check (status in ('draft', 'confirmed', 'cancelled')),
  constraint employee_assignments_date_check
    check (end_date >= start_date)
);

create table if not exists public.employee_skills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  skill text not null,
  created_at timestamptz not null default now(),
  constraint employee_skills_unique unique (organization_id, employee_id, skill)
);

create index if not exists company_locations_org_idx
  on public.company_locations (organization_id, is_active, name);

create index if not exists company_roles_org_idx
  on public.company_roles (organization_id, is_active, name);

create index if not exists location_status_events_org_location_dates_idx
  on public.location_status_events (organization_id, location_id, start_date, end_date);

create index if not exists assignment_slots_org_location_dates_idx
  on public.assignment_slots (organization_id, location_id, start_date, end_date);

create index if not exists employee_assignments_org_employee_dates_idx
  on public.employee_assignments (organization_id, employee_id, start_date, end_date);

create index if not exists employee_assignments_org_location_dates_idx
  on public.employee_assignments (organization_id, location_id, start_date, end_date);

create index if not exists employee_assignments_slot_idx
  on public.employee_assignments (slot_id);

create index if not exists employee_skills_org_employee_idx
  on public.employee_skills (organization_id, employee_id);

-- updated_at triggers
drop trigger if exists trg_company_locations_updated_at on public.company_locations;
create trigger trg_company_locations_updated_at
before update on public.company_locations
for each row execute function public.location_planner_touch_updated_at();

drop trigger if exists trg_company_roles_updated_at on public.company_roles;
create trigger trg_company_roles_updated_at
before update on public.company_roles
for each row execute function public.location_planner_touch_updated_at();

drop trigger if exists trg_location_status_events_updated_at on public.location_status_events;
create trigger trg_location_status_events_updated_at
before update on public.location_status_events
for each row execute function public.location_planner_touch_updated_at();

drop trigger if exists trg_assignment_slots_updated_at on public.assignment_slots;
create trigger trg_assignment_slots_updated_at
before update on public.assignment_slots
for each row execute function public.location_planner_touch_updated_at();

drop trigger if exists trg_employee_assignments_updated_at on public.employee_assignments;
create trigger trg_employee_assignments_updated_at
before update on public.employee_assignments
for each row execute function public.location_planner_touch_updated_at();


alter table public.company_locations enable row level security;
alter table public.company_roles enable row level security;
alter table public.location_status_events enable row level security;
alter table public.assignment_slots enable row level security;
alter table public.employee_assignments enable row level security;
alter table public.employee_skills enable row level security;

drop policy if exists company_locations_select on public.company_locations;
create policy company_locations_select on public.company_locations
for select to authenticated
using (public.can_read_location_planner(organization_id));

drop policy if exists company_locations_manage on public.company_locations;
create policy company_locations_manage on public.company_locations
for all to authenticated
using (public.can_manage_location_planner(organization_id))
with check (public.can_manage_location_planner(organization_id));


drop policy if exists company_roles_select on public.company_roles;
create policy company_roles_select on public.company_roles
for select to authenticated
using (public.can_read_location_planner(organization_id));

drop policy if exists company_roles_manage on public.company_roles;
create policy company_roles_manage on public.company_roles
for all to authenticated
using (public.can_manage_location_planner(organization_id))
with check (public.can_manage_location_planner(organization_id));

drop policy if exists location_status_events_select on public.location_status_events;
create policy location_status_events_select on public.location_status_events
for select to authenticated
using (public.can_read_location_planner(organization_id));

drop policy if exists location_status_events_manage on public.location_status_events;
create policy location_status_events_manage on public.location_status_events
for all to authenticated
using (public.can_manage_location_planner(organization_id))
with check (public.can_manage_location_planner(organization_id));

drop policy if exists assignment_slots_select on public.assignment_slots;
create policy assignment_slots_select on public.assignment_slots
for select to authenticated
using (public.can_read_location_planner(organization_id));

drop policy if exists assignment_slots_manage on public.assignment_slots;
create policy assignment_slots_manage on public.assignment_slots
for all to authenticated
using (public.can_manage_location_planner(organization_id))
with check (public.can_manage_location_planner(organization_id));

drop policy if exists employee_assignments_select on public.employee_assignments;
create policy employee_assignments_select on public.employee_assignments
for select to authenticated
using (public.can_read_location_planner(organization_id));

drop policy if exists employee_assignments_manage on public.employee_assignments;
create policy employee_assignments_manage on public.employee_assignments
for all to authenticated
using (public.can_manage_location_planner(organization_id))
with check (public.can_manage_location_planner(organization_id));

drop policy if exists employee_skills_select on public.employee_skills;
create policy employee_skills_select on public.employee_skills
for select to authenticated
using (public.can_read_location_planner(organization_id));

drop policy if exists employee_skills_manage on public.employee_skills;
create policy employee_skills_manage on public.employee_skills
for all to authenticated
using (public.can_manage_location_planner(organization_id))
with check (public.can_manage_location_planner(organization_id));


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
begin
  if not public.can_read_location_planner(p_organization_id) then
    raise exception 'Not allowed to read location planner for this organization';
  end if;

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
  elsif coalesce(profile_record.account_status, 'active') <> 'active'
    or coalesce(profile_record.is_suspended, false) then
    conflicts := conflicts || jsonb_build_array(jsonb_build_object(
      'code', 'employee_unavailable',
      'message', 'Employee is inactive or suspended.'
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

grant execute on function public.detect_assignment_conflicts(
  uuid, uuid, uuid, uuid, date, date, time, time, uuid, text[]
) to authenticated;


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

grant execute on function public.get_admin_planner_calendar(uuid, date, date, uuid, uuid, uuid)
  to authenticated, service_role;

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

grant execute on function public.get_employee_calendar_assignments(uuid, date, date, uuid)
  to authenticated, service_role;


create or replace function public.create_assignment_slot(
  p_organization_id uuid,
  p_payload jsonb
)
returns public.assignment_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted public.assignment_slots;
begin
  if not public.can_manage_location_planner(p_organization_id) then
    raise exception 'Admin access required';
  end if;

  insert into public.assignment_slots (
    organization_id,
    location_id,
    title,
    temporary_role_id,
    required_count,
    start_date,
    end_date,
    start_time,
    end_time,
    required_skills,
    priority,
    notes,
    status,
    created_by
  )
  values (
    p_organization_id,
    (p_payload->>'location_id')::uuid,
    coalesce(p_payload->>'title', 'Assignment slot'),
    nullif(p_payload->>'temporary_role_id', '')::uuid,
    greatest(coalesce((p_payload->>'required_count')::integer, 1), 1),
    (p_payload->>'start_date')::date,
    (p_payload->>'end_date')::date,
    nullif(p_payload->>'start_time', '')::time,
    nullif(p_payload->>'end_time', '')::time,
    coalesce(
      (select array_agg(value::text)
       from jsonb_array_elements_text(coalesce(p_payload->'required_skills', '[]'::jsonb)) as value),
      '{}'
    ),
    coalesce(p_payload->>'priority', 'normal'),
    coalesce(p_payload->>'notes', ''),
    coalesce(p_payload->>'status', 'open'),
    auth.uid()
  )
  returning * into inserted;

  return inserted;
end;
$$;

grant execute on function public.create_assignment_slot(uuid, jsonb) to authenticated;

create or replace function public.assign_employee_to_slot(
  p_organization_id uuid,
  p_payload jsonb
)
returns public.employee_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted public.employee_assignments;
  slot_row public.assignment_slots%rowtype;
  conflict_result jsonb;
  req_skills text[];
begin
  if not public.can_manage_location_planner(p_organization_id) then
    raise exception 'Admin access required';
  end if;

  if nullif(p_payload->>'slot_id', '') is not null then
    select * into slot_row
    from public.assignment_slots
    where id = (p_payload->>'slot_id')::uuid
      and organization_id = p_organization_id;
    req_skills := slot_row.required_skills;
  else
    req_skills := coalesce(
      (select array_agg(value::text)
       from jsonb_array_elements_text(coalesce(p_payload->'required_skills', '[]'::jsonb)) as value),
      '{}'
    );
  end if;

  conflict_result := public.detect_assignment_conflicts(
    p_organization_id,
    (p_payload->>'employee_id')::uuid,
    coalesce((p_payload->>'location_id')::uuid, slot_row.location_id),
    nullif(p_payload->>'slot_id', '')::uuid,
    coalesce((p_payload->>'start_date')::date, slot_row.start_date),
    coalesce((p_payload->>'end_date')::date, slot_row.end_date),
    coalesce(nullif(p_payload->>'start_time', '')::time, slot_row.start_time),
    coalesce(nullif(p_payload->>'end_time', '')::time, slot_row.end_time),
    null,
    req_skills
  );

  if coalesce((conflict_result->>'ok')::boolean, false) is not true then
    raise exception 'Assignment conflict: %', conflict_result::text;
  end if;

  insert into public.employee_assignments (
    organization_id,
    employee_id,
    slot_id,
    location_id,
    temporary_role_id,
    start_date,
    end_date,
    start_time,
    end_time,
    status,
    notes,
    created_by,
    confirmed_at
  )
  values (
    p_organization_id,
    (p_payload->>'employee_id')::uuid,
    nullif(p_payload->>'slot_id', '')::uuid,
    coalesce((p_payload->>'location_id')::uuid, slot_row.location_id),
    coalesce(
      nullif(p_payload->>'temporary_role_id', '')::uuid,
      slot_row.temporary_role_id
    ),
    coalesce((p_payload->>'start_date')::date, slot_row.start_date),
    coalesce((p_payload->>'end_date')::date, slot_row.end_date),
    coalesce(nullif(p_payload->>'start_time', '')::time, slot_row.start_time),
    coalesce(nullif(p_payload->>'end_time', '')::time, slot_row.end_time),
    coalesce(p_payload->>'status', 'draft'),
    coalesce(p_payload->>'notes', ''),
    auth.uid(),
    case when coalesce(p_payload->>'status', 'draft') = 'confirmed' then now() else null end
  )
  returning * into inserted;

  return inserted;
end;
$$;

grant execute on function public.assign_employee_to_slot(uuid, jsonb) to authenticated;

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
  slot_row public.assignment_slots%rowtype;
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

  if current_row.slot_id is not null then
    select * into slot_row from public.assignment_slots where id = current_row.slot_id;
  end if;

  conflict_result := public.detect_assignment_conflicts(
    p_organization_id,
    current_row.employee_id,
    coalesce((p_payload->>'location_id')::uuid, current_row.location_id),
    current_row.slot_id,
    coalesce((p_payload->>'start_date')::date, current_row.start_date),
    coalesce((p_payload->>'end_date')::date, current_row.end_date),
    coalesce(nullif(p_payload->>'start_time', '')::time, current_row.start_time),
    coalesce(nullif(p_payload->>'end_time', '')::time, current_row.end_time),
    p_assignment_id,
    coalesce(slot_row.required_skills, '{}')
  );

  if coalesce((conflict_result->>'ok')::boolean, false) is not true then
    raise exception 'Assignment conflict: %', conflict_result::text;
  end if;

  update public.employee_assignments
  set
    location_id = coalesce((p_payload->>'location_id')::uuid, location_id),
    start_date = coalesce((p_payload->>'start_date')::date, start_date),
    end_date = coalesce((p_payload->>'end_date')::date, end_date),
    start_time = coalesce(nullif(p_payload->>'start_time', '')::time, start_time),
    end_time = coalesce(nullif(p_payload->>'end_time', '')::time, end_time),
    temporary_role_id = coalesce(
      nullif(p_payload->>'temporary_role_id', '')::uuid,
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

create or replace function public.update_assignment(
  p_organization_id uuid,
  p_assignment_id uuid,
  p_payload jsonb
)
returns public.employee_assignments
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.move_assignment(p_organization_id, p_assignment_id, p_payload);
end;
$$;

grant execute on function public.update_assignment(uuid, uuid, jsonb) to authenticated;

create or replace function public.delete_assignment(
  p_organization_id uuid,
  p_assignment_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_location_planner(p_organization_id) then
    raise exception 'Admin access required';
  end if;

  delete from public.employee_assignments
  where id = p_assignment_id
    and organization_id = p_organization_id;

  return found;
end;
$$;

grant execute on function public.delete_assignment(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
