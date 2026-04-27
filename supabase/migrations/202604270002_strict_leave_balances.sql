alter table public.profiles
  add column if not exists leave_days_total integer not null default 22;

alter table public.profiles
  add column if not exists leave_days_remaining integer not null default 22;

alter table public.leave_requests
  add column if not exists requested_days integer not null default 1;

alter table public.leave_requests
  add column if not exists request_department text;

alter table public.leave_requests
  add column if not exists request_role text;

alter table public.leave_requests
  add column if not exists balance_deducted_at timestamptz;

update public.profiles
set
  leave_days_total = coalesce(leave_days_total, 22),
  leave_days_remaining = coalesce(leave_days_remaining, 22);

update public.leave_requests
set requested_days = greatest(((end_date::date - start_date::date) + 1), 1);

update public.leave_requests lr
set
  request_department = coalesce(nullif(trim(lr.request_department), ''), p.department),
  request_role = coalesce(nullif(trim(lr.request_role), ''), p.primary_role)
from public.profiles p
where p.id = lr.user_id;

update public.leave_requests
set balance_deducted_at = coalesce(balance_deducted_at, approved_at, created_at, now())
where status = 'approved';

update public.profiles p
set leave_days_remaining = greatest(
  coalesce(p.leave_days_total, 22) - coalesce((
    select sum(lr.requested_days)
    from public.leave_requests lr
    where lr.user_id = p.id
      and lr.status = 'approved'
  ), 0),
  0
);

create or replace function public.calculate_leave_requested_days(
  p_start_date date,
  p_end_date date
)
returns integer
language sql
immutable
as $$
  select greatest(((p_end_date - p_start_date) + 1), 1)::integer;
$$;

create or replace function public.enforce_leave_request_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requester record;
  conflicting_request record;
  available_days integer;
  old_deducted_days integer := 0;
  new_deducted_days integer := 0;
  balance_delta integer := 0;
begin
  if new.start_date is null or new.end_date is null then
    raise exception 'Leave requests must include both a start and end date.';
  end if;

  if new.end_date::date < new.start_date::date then
    raise exception 'Leave end date cannot be earlier than the start date.';
  end if;

  select
    id,
    organization_id,
    primary_role,
    department,
    coalesce(leave_days_total, 22) as leave_days_total,
    coalesce(leave_days_remaining, 22) as leave_days_remaining
  into requester
  from public.profiles
  where id = new.user_id
  for update;

  if requester.id is null then
    raise exception 'Leave requester profile could not be found.';
  end if;

  if new.organization_id is null then
    new.organization_id := requester.organization_id;
  end if;

  if requester.organization_id is not null
     and new.organization_id is distinct from requester.organization_id then
    raise exception 'Leave request organization does not match the requester profile.';
  end if;

  new.request_role := coalesce(nullif(trim(new.request_role), ''), requester.primary_role);
  new.request_department := coalesce(
    nullif(trim(new.request_department), ''),
    requester.department
  );
  new.requested_days := public.calculate_leave_requested_days(
    new.start_date::date,
    new.end_date::date
  );

  available_days := requester.leave_days_remaining;

  if tg_op = 'UPDATE' and old.balance_deducted_at is not null then
    available_days := available_days + coalesce(old.requested_days, 0);
  end if;

  if coalesce(new.status, 'pending') in ('pending', 'approved')
     and new.requested_days > available_days then
    raise exception
      'This leave request needs %s days but only %s leave days remain for this user.',
      new.requested_days,
      available_days;
  end if;

  if coalesce(new.status, 'pending') in ('pending', 'approved')
     and nullif(trim(coalesce(new.request_role, '')), '') is not null then
    select
      lr.id,
      lr.status,
      lr.request_role,
      p.full_name,
      p.email
    into conflicting_request
    from public.leave_requests lr
    left join public.profiles p on p.id = lr.user_id
    where lr.organization_id = new.organization_id
      and lr.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and lr.status in ('pending', 'approved')
      and lower(coalesce(lr.request_role, '')) = lower(coalesce(new.request_role, ''))
      and lr.start_date <= new.end_date
      and lr.end_date >= new.start_date
    order by case when lr.status = 'approved' then 0 else 1 end, lr.created_at
    limit 1;

    if found then
      raise exception
        '% already has a % leave request for this period. No other % team member can request leave until those dates are free.',
        coalesce(conflicting_request.full_name, conflicting_request.email, 'Another employee'),
        conflicting_request.status,
        replace(coalesce(new.request_role, 'this'), '_', ' ');
    end if;
  end if;

  if coalesce(new.status, 'pending') in ('pending', 'approved')
     and nullif(trim(coalesce(new.request_department, '')), '') is not null then
    select
      lr.id,
      lr.status,
      lr.request_department,
      p.full_name,
      p.email
    into conflicting_request
    from public.leave_requests lr
    left join public.profiles p on p.id = lr.user_id
    where lr.organization_id = new.organization_id
      and lr.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and lr.status in ('pending', 'approved')
      and lower(coalesce(lr.request_department, '')) = lower(coalesce(new.request_department, ''))
      and lr.start_date <= new.end_date
      and lr.end_date >= new.start_date
    order by case when lr.status = 'approved' then 0 else 1 end, lr.created_at
    limit 1;

    if found then
      raise exception
        '% already has a % leave request for % during this period.',
        coalesce(conflicting_request.full_name, conflicting_request.email, 'Another employee'),
        conflicting_request.status,
        conflicting_request.request_department;
    end if;
  end if;

  if tg_op = 'UPDATE' and old.balance_deducted_at is not null then
    old_deducted_days := coalesce(old.requested_days, 0);
  end if;

  if coalesce(new.status, 'pending') = 'approved' then
    new_deducted_days := new.requested_days;
  end if;

  balance_delta := new_deducted_days - old_deducted_days;

  if balance_delta > 0 then
    update public.profiles
    set leave_days_remaining = leave_days_remaining - balance_delta
    where id = new.user_id
      and leave_days_remaining >= balance_delta;

    if not found then
      raise exception 'Not enough leave days remain to approve this request.';
    end if;

    new.balance_deducted_at := coalesce(
      case when tg_op = 'UPDATE' then old.balance_deducted_at end,
      now()
    );
  elsif balance_delta < 0 then
    update public.profiles
    set leave_days_remaining = least(
      coalesce(leave_days_total, 22),
      leave_days_remaining + abs(balance_delta)
    )
    where id = new.user_id;

    if coalesce(new.status, 'pending') = 'approved' then
      new.balance_deducted_at := coalesce(
        case when tg_op = 'UPDATE' then old.balance_deducted_at end,
        now()
      );
    else
      new.balance_deducted_at := null;
    end if;
  elsif coalesce(new.status, 'pending') = 'approved' then
    new.balance_deducted_at := coalesce(
      case when tg_op = 'UPDATE' then old.balance_deducted_at end,
      now()
    );
  elsif coalesce(new.status, 'pending') <> 'approved' then
    new.balance_deducted_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists leave_request_rules_trigger on public.leave_requests;

create trigger leave_request_rules_trigger
before insert or update of start_date, end_date, status, request_department, request_role, user_id, organization_id
on public.leave_requests
for each row
execute function public.enforce_leave_request_rules();

create index if not exists idx_leave_requests_role_window
  on public.leave_requests (
    organization_id,
    lower(coalesce(request_role, '')),
    status,
    start_date,
    end_date
  );

create index if not exists idx_leave_requests_department_window
  on public.leave_requests (
    organization_id,
    lower(coalesce(request_department, '')),
    status,
    start_date,
    end_date
  );

