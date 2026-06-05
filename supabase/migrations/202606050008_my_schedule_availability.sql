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
    ), '[]'::jsonb),
    'availability', public.location_planner_availability(
      p_organization_id,
      p_start_date,
      p_end_date
    )
  );
end;
$$;

grant execute on function public.get_employee_calendar_assignments(uuid, date, date, uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';
