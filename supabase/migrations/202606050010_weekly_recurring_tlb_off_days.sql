create table if not exists public.tlb_employee_weekly_off_days (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  office_id uuid not null references public.company_offices(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 1 and 7),
  start_date date not null,
  end_date date,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tlb_employee_weekly_off_days_date_check
    check (end_date is null or end_date >= start_date)
);

create unique index if not exists tlb_employee_weekly_off_days_active_unique
  on public.tlb_employee_weekly_off_days (organization_id, office_id, user_id, day_of_week)
  where end_date is null;

create index if not exists tlb_employee_weekly_off_days_org_office_day_idx
  on public.tlb_employee_weekly_off_days (organization_id, office_id, day_of_week, start_date);

alter table public.tlb_employee_weekly_off_days enable row level security;

drop policy if exists tlb_employee_weekly_off_days_select on public.tlb_employee_weekly_off_days;
create policy tlb_employee_weekly_off_days_select
on public.tlb_employee_weekly_off_days for select
to authenticated
using (
  public.can_manage_location_planner(organization_id)
  and public.is_tlb_office(office_id)
);

drop policy if exists tlb_employee_weekly_off_days_manage on public.tlb_employee_weekly_off_days;
create policy tlb_employee_weekly_off_days_manage
on public.tlb_employee_weekly_off_days for all
to authenticated
using (
  public.can_manage_location_planner(organization_id)
  and public.is_tlb_office(office_id)
)
with check (
  public.can_manage_location_planner(organization_id)
  and public.is_tlb_office(office_id)
);

drop trigger if exists trg_tlb_employee_weekly_off_days_updated_at on public.tlb_employee_weekly_off_days;
create trigger trg_tlb_employee_weekly_off_days_updated_at
before update on public.tlb_employee_weekly_off_days
for each row execute function public.tlb_employee_off_days_touch_updated_at();

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
      'source', 'leave',
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
  one_off_rows as (
    select jsonb_build_object(
      'id', od.id,
      'user_id', od.user_id,
      'kind', 'off_day',
      'source', 'one_off',
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
  ),
  weekly_rows as (
    select jsonb_build_object(
      'id', rule.id,
      'recurrence_rule_id', rule.id,
      'user_id', rule.user_id,
      'kind', 'off_day',
      'source', 'weekly',
      'start_date', occurrence.day::date,
      'end_date', occurrence.day::date,
      'day_count', 1,
      'title', 'Weekly off day',
      'reason', rule.reason,
      'employee_name', p.full_name,
      'employee_email', p.email
    ) as item
    from public.tlb_employee_weekly_off_days rule
    join public.profiles p on p.id = rule.user_id
    join tlb on tlb.office_id = rule.office_id
    cross join lateral generate_series(
      greatest(rule.start_date, p_start_date),
      least(coalesce(rule.end_date, p_end_date), p_end_date),
      interval '1 day'
    ) as occurrence(day)
    where rule.organization_id = p_organization_id
      and extract(isodow from occurrence.day)::integer = rule.day_of_week
  )
  select coalesce(jsonb_agg(item order by item->>'start_date', item->>'employee_name'), '[]'::jsonb)
  from (
    select item from leave_rows
    union all
    select item from one_off_rows
    union all
    select item from weekly_rows
  ) all_rows;
$$;

grant execute on function public.location_planner_availability(uuid, date, date) to authenticated;

notify pgrst, 'reload schema';
