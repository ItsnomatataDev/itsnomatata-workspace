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
  payload_start_date date;
  payload_end_date date;
  payload_start_time time;
  payload_end_time time;
begin
  if not public.can_manage_location_planner(p_organization_id) then
    raise exception 'Admin access required';
  end if;

  payload_start_date := nullif(p_payload->>'start_date', '')::date;
  payload_end_date := nullif(p_payload->>'end_date', '')::date;
  payload_start_time := nullif(p_payload->>'start_time', '')::time;
  payload_end_time := nullif(p_payload->>'end_time', '')::time;

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
    coalesce(payload_start_date, slot_row.start_date),
    coalesce(payload_end_date, slot_row.end_date),
    coalesce(
      payload_start_time,
      case when payload_start_date is not null then time '08:00' else slot_row.start_time end
    ),
    coalesce(
      payload_end_time,
      case when payload_end_date is not null then time '17:00' else slot_row.end_time end
    ),
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
    coalesce(payload_start_date, slot_row.start_date),
    coalesce(payload_end_date, slot_row.end_date),
    coalesce(
      payload_start_time,
      case when payload_start_date is not null then time '08:00' else slot_row.start_time end
    ),
    coalesce(
      payload_end_time,
      case when payload_end_date is not null then time '17:00' else slot_row.end_time end
    ),
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

notify pgrst, 'reload schema';
