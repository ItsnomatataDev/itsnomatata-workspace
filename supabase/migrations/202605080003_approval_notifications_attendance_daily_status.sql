alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('pending', 'pending_approval', 'active', 'suspended', 'rejected', 'deleted'));

create table if not exists public.attendance_daily_status (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  office_id uuid references public.company_offices(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  attendance_date date not null,
  status text not null,
  expected_clock_in_at timestamptz,
  actual_clock_in_at timestamptz,
  late_marked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_daily_status_status_check
    check (status in ('present', 'late', 'absent', 'on_leave', 'pending')),
  constraint attendance_daily_status_user_date_key unique (user_id, attendance_date)
);

create index if not exists attendance_daily_status_org_date_idx
  on public.attendance_daily_status (organization_id, attendance_date, status);

create index if not exists attendance_daily_status_office_date_idx
  on public.attendance_daily_status (organization_id, office_id, attendance_date, status);

create or replace function public.touch_attendance_daily_status_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists attendance_daily_status_touch_updated_at
on public.attendance_daily_status;

create trigger attendance_daily_status_touch_updated_at
before update on public.attendance_daily_status
for each row
execute function public.touch_attendance_daily_status_updated_at();

create or replace function public.is_org_workforce_admin(target_organization_id uuid)
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
      and coalesce(p.account_status, 'pending') = 'active'
      and coalesce(p.is_suspended, false) = false
      and p.primary_role::text in ('admin', 'superadmin', 'it-superadmin', 'manager', 'hr', 'it')
  );
$$;

grant execute on function public.is_org_workforce_admin(uuid) to authenticated;

alter table public.attendance_daily_status enable row level security;

drop policy if exists "Users can read own attendance daily status" on public.attendance_daily_status;
create policy "Users can read own attendance daily status"
on public.attendance_daily_status
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Workforce admins can read org attendance daily status" on public.attendance_daily_status;
create policy "Workforce admins can read org attendance daily status"
on public.attendance_daily_status
for select
to authenticated
using (public.is_org_workforce_admin(organization_id));

drop policy if exists "Workforce admins can manage attendance daily status" on public.attendance_daily_status;
create policy "Workforce admins can manage attendance daily status"
on public.attendance_daily_status
for all
to authenticated
using (public.is_org_workforce_admin(organization_id))
with check (public.is_org_workforce_admin(organization_id));

create or replace function public.record_attendance_clock_in_status(
  target_session_id uuid
)
returns public.attendance_daily_status
language plpgsql
security definer
set search_path = public
as $$
declare
  session_record record;
  profile_record record;
  local_date date;
  expected_at timestamptz;
  late_cutoff timestamptz;
  next_status text;
  result public.attendance_daily_status;
begin
  select *
  into session_record
  from public.attendance_sessions s
  where s.id = target_session_id
    and s.user_id = auth.uid();

  if session_record.id is null then
    raise exception 'Attendance session not found for current user.';
  end if;

  select p.office_id
  into profile_record
  from public.profiles p
  where p.id = session_record.user_id;

  local_date := ((session_record.clock_in_at at time zone 'Africa/Harare')::date);
  expected_at := (local_date::text || ' 08:00:00+02')::timestamptz;
  late_cutoff := (local_date::text || ' 08:10:00+02')::timestamptz;
  next_status := case
    when session_record.clock_in_at > late_cutoff then 'late'
    else 'present'
  end;

  insert into public.attendance_daily_status (
    organization_id,
    office_id,
    user_id,
    attendance_date,
    status,
    expected_clock_in_at,
    actual_clock_in_at
  )
  values (
    session_record.organization_id,
    profile_record.office_id,
    session_record.user_id,
    local_date,
    next_status,
    expected_at,
    session_record.clock_in_at
  )
  on conflict (user_id, attendance_date)
  do update set
    office_id = excluded.office_id,
    status = case
      when public.attendance_daily_status.status = 'late' then 'late'
      else excluded.status
    end,
    expected_clock_in_at = coalesce(public.attendance_daily_status.expected_clock_in_at, excluded.expected_clock_in_at),
    actual_clock_in_at = excluded.actual_clock_in_at
  returning * into result;

  return result;
end;
$$;

grant execute on function public.record_attendance_clock_in_status(uuid) to authenticated;

create or replace function public.notify_admins_of_pending_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_record record;
  requested_name text;
  notification_id uuid;
begin
  if coalesce(new.account_status, '') <> 'pending_approval' then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.account_status, '') = 'pending_approval' then
    return new;
  end if;

  requested_name := coalesce(nullif(trim(new.full_name), ''), new.email, 'A new user');

  for admin_record in
    select p.id
    from public.profiles p
    where p.organization_id = new.organization_id
      and coalesce(p.account_status, 'pending') = 'active'
      and coalesce(p.is_suspended, false) = false
      and (
        lower(coalesce(p.email, '')) = 'thando@itsnomatata.com'
        or p.primary_role::text in ('admin', 'superadmin', 'it-superadmin', 'it')
      )
  loop
    insert into public.notifications (
      organization_id,
      user_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      action_url,
      priority,
      metadata,
      category,
      dedupe_key,
      delivery_state
    )
    values (
      new.organization_id,
      admin_record.id,
      'user_signup',
      'New user approval request',
      requested_name || ' signed up and is waiting for approval.',
      'profile',
      new.id,
      '/it/war-room?panel=account-approvals',
      'high',
      jsonb_build_object(
        'target_user_id', new.id,
        'email', new.email,
        'source', 'profiles_pending_approval_trigger'
      ),
      'admin',
      'pending-approval:' || new.id,
      'pending'
    )
    on conflict do nothing
    returning id into notification_id;

    if notification_id is not null then
      insert into public.notification_deliveries (
        notification_id,
        channel,
        status,
        provider,
        attempted_at
      )
      values (
        notification_id,
        'push',
        'queued',
        'supabase-edge:web-push',
        now()
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists profiles_pending_approval_notify_admins
on public.profiles;

create trigger profiles_pending_approval_notify_admins
after insert or update of account_status on public.profiles
for each row
execute function public.notify_admins_of_pending_signup();
