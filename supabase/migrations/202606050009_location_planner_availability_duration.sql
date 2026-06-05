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
      'day_count', coalesce(
        nullif(lr.requested_days, 0),
        (lr.end_date::date - lr.start_date::date + 1)
      ),
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
      'day_count', 1,
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

grant execute on function public.location_planner_availability(uuid, date, date) to authenticated;

notify pgrst, 'reload schema';
