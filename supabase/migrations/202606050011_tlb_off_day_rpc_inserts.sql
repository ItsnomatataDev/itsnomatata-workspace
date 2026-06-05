create or replace function public.create_tlb_employee_off_day(
  p_organization_id uuid,
  p_user_id uuid,
  p_off_date date,
  p_reason text default null
)
returns public.tlb_employee_off_days
language plpgsql
security definer
set search_path = public
as $$
declare
  tlb_office_id uuid;
  saved_row public.tlb_employee_off_days%rowtype;
begin
  if not public.can_manage_location_planner(p_organization_id) then
    raise exception 'Not allowed to manage location planner for this organization';
  end if;

  tlb_office_id := public.location_planner_tlb_office_id(p_organization_id);
  if tlb_office_id is null then
    raise exception 'Three Little Birds office is not configured for this organization';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.organization_id = p_organization_id
      and p.office_id = tlb_office_id
      and coalesce(p.account_status, 'active') = 'active'
      and coalesce(p.is_suspended, false) = false
  ) then
    raise exception 'Only active Three Little Birds employees can be marked off';
  end if;

  insert into public.tlb_employee_off_days (
    organization_id,
    office_id,
    user_id,
    off_date,
    reason,
    created_by
  )
  values (
    p_organization_id,
    tlb_office_id,
    p_user_id,
    p_off_date,
    nullif(btrim(coalesce(p_reason, '')), ''),
    auth.uid()
  )
  on conflict on constraint tlb_employee_off_days_unique
  do update set
    reason = excluded.reason,
    created_by = excluded.created_by,
    updated_at = now()
  returning * into saved_row;

  return saved_row;
end;
$$;

create or replace function public.create_tlb_employee_weekly_off_day(
  p_organization_id uuid,
  p_user_id uuid,
  p_start_date date,
  p_reason text default null
)
returns public.tlb_employee_weekly_off_days
language plpgsql
security definer
set search_path = public
as $$
declare
  tlb_office_id uuid;
  target_day_of_week integer;
  saved_row public.tlb_employee_weekly_off_days%rowtype;
begin
  if not public.can_manage_location_planner(p_organization_id) then
    raise exception 'Not allowed to manage location planner for this organization';
  end if;

  tlb_office_id := public.location_planner_tlb_office_id(p_organization_id);
  if tlb_office_id is null then
    raise exception 'Three Little Birds office is not configured for this organization';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.organization_id = p_organization_id
      and p.office_id = tlb_office_id
      and coalesce(p.account_status, 'active') = 'active'
      and coalesce(p.is_suspended, false) = false
  ) then
    raise exception 'Only active Three Little Birds employees can be marked off';
  end if;

  target_day_of_week := extract(isodow from p_start_date)::integer;

  update public.tlb_employee_weekly_off_days
  set
    start_date = p_start_date,
    reason = nullif(btrim(coalesce(p_reason, '')), ''),
    created_by = auth.uid(),
    updated_at = now()
  where organization_id = p_organization_id
    and office_id = tlb_office_id
    and user_id = p_user_id
    and day_of_week = target_day_of_week
    and end_date is null
  returning * into saved_row;

  if found then
    return saved_row;
  end if;

  insert into public.tlb_employee_weekly_off_days (
    organization_id,
    office_id,
    user_id,
    day_of_week,
    start_date,
    reason,
    created_by
  )
  values (
    p_organization_id,
    tlb_office_id,
    p_user_id,
    target_day_of_week,
    p_start_date,
    nullif(btrim(coalesce(p_reason, '')), ''),
    auth.uid()
  )
  returning * into saved_row;

  return saved_row;
end;
$$;

grant execute on function public.create_tlb_employee_off_day(uuid, uuid, date, text) to authenticated;
grant execute on function public.create_tlb_employee_weekly_off_day(uuid, uuid, date, text) to authenticated;

notify pgrst, 'reload schema';
