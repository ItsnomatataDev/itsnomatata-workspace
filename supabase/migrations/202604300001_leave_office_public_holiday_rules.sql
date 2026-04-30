
create table if not exists public.public_holidays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  country_code text not null default 'ZW',
  title text,
  holiday_date date,
  date date,
  name text,
  description text,
  is_recurring boolean not null default false,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leave_requests
  add column if not exists office text,
  add column if not exists admin_notes text,
  add column if not exists edited_by uuid references public.profiles(id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null,
  add column if not exists cancellation_reason text;

update public.leave_requests
set office = coalesce(nullif(trim(office), ''), nullif(trim(request_department), ''), 'IT''s Nomatata')
where office is null or trim(office) = '';

alter table public.public_holidays
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists country_code text not null default 'ZW',
  add column if not exists title text,
  add column if not exists holiday_date date,
  add column if not exists date date,
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists is_recurring boolean not null default false,
  add column if not exists source text;

update public.public_holidays
set
  title = coalesce(title, name, 'Public holiday'),
  name = coalesce(name, title, 'Public holiday'),
  holiday_date = coalesce(holiday_date, date),
  date = coalesce(date, holiday_date),
  country_code = coalesce(country_code, 'ZW')
where title is null
   or name is null
   or holiday_date is null
   or date is null
   or country_code is null;

delete from public.public_holidays ph
using public.public_holidays duplicate
where ph.organization_id = duplicate.organization_id
  and coalesce(ph.country_code, 'ZW') = coalesce(duplicate.country_code, 'ZW')
  and coalesce(ph.holiday_date, ph.date) = coalesce(duplicate.holiday_date, duplicate.date)
  and ph.id > duplicate.id;

create unique index if not exists public_holidays_org_country_date_unique
  on public.public_holidays (organization_id, country_code, holiday_date);

create index if not exists idx_public_holidays_org_date
  on public.public_holidays (organization_id, date);

create index if not exists idx_public_holidays_org_holiday_date
  on public.public_holidays (organization_id, holiday_date);

alter table public.public_holidays enable row level security;

drop policy if exists "org_members_read_public_holidays" on public.public_holidays;
create policy "org_members_read_public_holidays"
on public.public_holidays
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = public_holidays.organization_id
  )
  or exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = public_holidays.organization_id
      and om.status = 'active'
  )
);

drop policy if exists "org_admins_manage_public_holidays" on public.public_holidays;
create policy "org_admins_manage_public_holidays"
on public.public_holidays
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = public_holidays.organization_id
      and p.primary_role in ('admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = public_holidays.organization_id
      and p.primary_role in ('admin', 'manager')
  )
);

create table if not exists public.leave_request_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  leave_request_id uuid not null references public.leave_requests(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  previous_data jsonb,
  new_data jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_leave_request_audit_request_created
  on public.leave_request_audit (leave_request_id, created_at desc);

create index if not exists idx_leave_requests_office_status_dates
  on public.leave_requests (organization_id, office, status, start_date, end_date);

insert into public.public_holidays (
  organization_id,
  country_code,
  title,
  holiday_date,
  date,
  name,
  description,
  is_recurring,
  source
)
select
  o.id,
  'ZW',
  h.title,
  h.holiday_date,
  h.holiday_date,
  h.title,
  h.title,
  h.is_recurring,
  'Seeded Zimbabwe public holidays 2026'
from public.organizations o
cross join (
  values
    ('New Year''s Day', '2026-01-01'::date, true),
    ('Robert Gabriel Mugabe National Youth Day', '2026-02-21'::date, true),
    ('Good Friday', '2026-04-03'::date, false),
    ('Holy Saturday', '2026-04-04'::date, false),
    ('Easter Monday', '2026-04-06'::date, false),
    ('Independence Day', '2026-04-18'::date, true),
    ('Workers'' Day', '2026-05-01'::date, true),
    ('Africa Day', '2026-05-25'::date, true),
    ('Heroes'' Day', '2026-08-10'::date, false),
    ('Defence Forces Day', '2026-08-11'::date, false),
    ('National Unity Day', '2026-12-22'::date, true),
    ('Christmas Day', '2026-12-25'::date, true),
    ('Boxing Day', '2026-12-26'::date, true)
) as h(title, holiday_date, is_recurring)
where not exists (
  select 1
  from public.public_holidays ph
  where ph.organization_id = o.id
    and coalesce(ph.country_code, 'ZW') = 'ZW'
    and coalesce(ph.holiday_date, ph.date) = h.holiday_date
);

create or replace function public.calculate_leave_requested_days(
  target_organization_id uuid,
  start_date date,
  end_date date,
  target_office text default null
)
returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  day_cursor date;
  total integer := 0;
  normalized_office text := lower(trim(coalesce(target_office, 'IT''s Nomatata')));
  is_it_office boolean;
begin
  if start_date is null or end_date is null then
    return 0;
  end if;

  if end_date < start_date then
    return 0;
  end if;

  is_it_office := normalized_office in (
    'it''s nomatata',
    'itsnomatata',
    'it snomatata',
    'it'
  );

  if normalized_office = 'three little birds' then
    return (end_date - start_date + 1);
  end if;

  day_cursor := start_date;
  while day_cursor <= end_date loop
    if is_it_office then
      if extract(isodow from day_cursor) not in (6, 7)
         and not exists (
           select 1
           from public.public_holidays ph
           where ph.organization_id = target_organization_id
             and coalesce(ph.country_code, 'ZW') = 'ZW'
             and coalesce(ph.holiday_date, ph.date) = day_cursor
         ) then
        total := total + 1;
      end if;
    else
      total := total + 1;
    end if;

    day_cursor := day_cursor + 1;
  end loop;

  return total;
end;
$$;

create or replace function public.enforce_leave_request_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requester record;
  available_days integer;
  old_deducted_days integer := 0;
  new_deducted_days integer := 0;
  balance_delta integer := 0;
  closed_rule record;
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

  new.request_role := coalesce(nullif(trim(new.request_role), ''), requester.primary_role::text);
  new.office := coalesce(
    nullif(trim(new.office), ''),
    nullif(trim(new.request_department), ''),
    requester.department,
    'IT''s Nomatata'
  );
  new.request_department := coalesce(nullif(trim(new.request_department), ''), new.office);

  new.requested_days := public.calculate_leave_requested_days(
    new.organization_id,
    new.start_date::date,
    new.end_date::date,
    new.office
  );

  if new.requested_days <= 0 then
    raise exception 'The selected date range has no countable leave days for %.', new.office;
  end if;

  if coalesce(new.status, 'pending') in ('pending', 'approved') then
    select *
    into closed_rule
    from public.leave_calendar_rules lcr
    where lcr.organization_id = new.organization_id
      and lcr.rule_type = 'closed'
      and lcr.start_date <= new.end_date
      and lcr.end_date >= new.start_date
      and (
        lcr.applies_to_department is null
        or lower(lcr.applies_to_department) = lower(coalesce(new.office, new.request_department, ''))
        or lower(lcr.applies_to_department) = lower(coalesce(new.request_department, ''))
      )
      and (
        lcr.applies_to_role is null
        or lower(lcr.applies_to_role) = lower(coalesce(new.request_role, ''))
      )
    order by lcr.start_date
    limit 1;

    if found then
      raise exception 'Leave requests are closed for this period: %', coalesce(closed_rule.title, 'blackout period');
    end if;
  end if;

  available_days := requester.leave_days_remaining;

  if tg_op = 'UPDATE' and old.balance_deducted_at is not null then
    available_days := available_days + coalesce(old.requested_days, 0);
  end if;

  if coalesce(new.status, 'pending') = 'approved'
     and new.requested_days > available_days then
    raise exception
      'This leave request needs % days but only % leave days remain for this user.',
      new.requested_days,
      available_days;
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
before insert or update of start_date, end_date, office, request_department, request_role, status, requested_days, balance_deducted_at
on public.leave_requests
for each row
execute function public.enforce_leave_request_rules();
