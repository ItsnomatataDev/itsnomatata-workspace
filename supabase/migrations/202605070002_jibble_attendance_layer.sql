drop view if exists public.team_attendance_status;
drop view if exists public.daily_attendance_summary;
drop trigger if exists attendance_sessions_duration_trigger on public.attendance_sessions;
drop trigger if exists attendance_sessions_break_trigger on public.attendance_sessions;
drop trigger if exists attendance_sessions_events_trigger on public.attendance_sessions;
drop function if exists public.calculate_attendance_duration();
drop function if exists public.calculate_break_duration();
drop function if exists public.log_attendance_event();
drop function if exists public.get_active_attendance_session(uuid);
drop function if exists public.is_user_clocked_in(uuid);
drop function if exists public.is_user_on_break(uuid);

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_sessions'
      and column_name = 'clock_in'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_sessions'
      and column_name = 'clock_in_at'
  ) then
    alter table public.attendance_sessions rename column clock_in to clock_in_at;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_sessions'
      and column_name = 'clock_out'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_sessions'
      and column_name = 'clock_out_at'
  ) then
    alter table public.attendance_sessions rename column clock_out to clock_out_at;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_sessions'
      and column_name = 'source'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_sessions'
      and column_name = 'clock_in_method'
  ) then
    alter table public.attendance_sessions rename column source to clock_in_method;
  end if;
end $$;

alter table public.attendance_sessions
  drop constraint if exists attendance_sessions_status_check,
  drop constraint if exists attendance_sessions_check,
  drop constraint if exists attendance_sessions_clock_range_check;

alter table public.attendance_sessions
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists clock_in_at timestamptz not null default now(),
  add column if not exists clock_out_at timestamptz null,
  add column if not exists status text not null default 'active',
  add column if not exists work_seconds integer not null default 0,
  add column if not exists clock_in_method text not null default 'web',
  add column if not exists clock_out_method text null,
  add column if not exists notes text null,
  add column if not exists ip_address text null,
  add column if not exists device_info jsonb not null default '{}'::jsonb,
  add column if not exists location jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.attendance_sessions
  alter column clock_in_at set default now(),
  alter column status set default 'active',
  alter column work_seconds set default 0,
  alter column clock_in_method set default 'web',
  alter column device_info set default '{}'::jsonb,
  alter column location set default '{}'::jsonb,
  alter column created_at set default now(),
  alter column updated_at set default now();

update public.attendance_sessions
set clock_in_at = coalesce(created_at, now())
where clock_in_at is null;

update public.attendance_sessions
set status = case
  when clock_out_at is null then 'active'
  when status in ('present', 'late', 'absent') then 'completed'
  else status
end;

alter table public.attendance_sessions
  alter column organization_id set not null,
  alter column user_id set not null,
  add constraint attendance_sessions_status_check
    check (status in ('active', 'completed', 'missed_clock_out')),
  add constraint attendance_sessions_clock_range_check
    check (clock_out_at is null or clock_out_at >= clock_in_at);

create table if not exists public.attendance_breaks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  attendance_session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  duration_seconds integer not null default 0,
  break_type text not null default 'break',
  notes text null,
  created_at timestamptz not null default now(),
  constraint attendance_breaks_range_check check (ended_at is null or ended_at >= started_at)
);

alter table public.attendance_breaks
  drop constraint if exists attendance_breaks_range_check,
  add constraint attendance_breaks_range_check
    check (ended_at is null or ended_at >= started_at);

create table if not exists public.attendance_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade unique,
  workday_start time null default '08:00',
  workday_end time null default '17:00',
  late_after_minutes integer not null default 15,
  auto_mark_missed_clockout boolean not null default true,
  require_location boolean not null default false,
  allowed_geofence jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists attendance_sessions_org_user_clock_idx
  on public.attendance_sessions (organization_id, user_id, clock_in_at desc);
create index if not exists attendance_sessions_active_idx
  on public.attendance_sessions (organization_id, user_id)
  where status = 'active' and clock_out_at is null;
create unique index if not exists attendance_sessions_one_active_per_user_idx
  on public.attendance_sessions (organization_id, user_id)
  where status = 'active' and clock_out_at is null;

create index if not exists attendance_breaks_session_idx
  on public.attendance_breaks (attendance_session_id, started_at desc);
create unique index if not exists attendance_breaks_one_active_per_user_idx
  on public.attendance_breaks (organization_id, user_id)
  where ended_at is null;

create or replace function public.set_attendance_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists attendance_sessions_set_updated_at on public.attendance_sessions;
create trigger attendance_sessions_set_updated_at
before update on public.attendance_sessions
for each row execute function public.set_attendance_updated_at();

alter table public.attendance_sessions enable row level security;
alter table public.attendance_breaks enable row level security;
alter table public.attendance_settings enable row level security;

drop policy if exists "Users can view own attendance sessions" on public.attendance_sessions;
drop policy if exists "Users can insert own attendance sessions" on public.attendance_sessions;
drop policy if exists "Users can update own attendance sessions" on public.attendance_sessions;
drop policy if exists "Admins can view all attendance sessions" on public.attendance_sessions;
drop policy if exists "Admins can update all attendance sessions" on public.attendance_sessions;
drop policy if exists "Users can select own attendance sessions" on public.attendance_sessions;
drop policy if exists "Users can insert own clock in" on public.attendance_sessions;
drop policy if exists "Users can update own active attendance" on public.attendance_sessions;
drop policy if exists "Admin managers can select org attendance" on public.attendance_sessions;
drop policy if exists "Admin managers can correct org attendance" on public.attendance_sessions;

create policy "Users can select own attendance sessions"
  on public.attendance_sessions for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own clock in"
  on public.attendance_sessions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = attendance_sessions.organization_id
    )
  );

create policy "Users can update own active attendance"
  on public.attendance_sessions for update
  to authenticated
  using (user_id = auth.uid() and status = 'active')
  with check (user_id = auth.uid());

create policy "Admin managers can select org attendance"
  on public.attendance_sessions for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = attendance_sessions.organization_id
        and p.primary_role in ('admin', 'manager')
    )
  );

create policy "Admin managers can correct org attendance"
  on public.attendance_sessions for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = attendance_sessions.organization_id
        and p.primary_role in ('admin', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = attendance_sessions.organization_id
        and p.primary_role in ('admin', 'manager')
    )
  );

drop policy if exists "Users can select own attendance breaks" on public.attendance_breaks;
drop policy if exists "Users can insert own attendance breaks" on public.attendance_breaks;
drop policy if exists "Users can update own attendance breaks" on public.attendance_breaks;
drop policy if exists "Admin managers can select org attendance breaks" on public.attendance_breaks;
drop policy if exists "Admin managers can correct org attendance breaks" on public.attendance_breaks;

create policy "Users can select own attendance breaks"
  on public.attendance_breaks for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own attendance breaks"
  on public.attendance_breaks for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance_breaks.attendance_session_id
        and s.user_id = auth.uid()
        and s.organization_id = attendance_breaks.organization_id
        and s.status = 'active'
    )
  );

create policy "Users can update own attendance breaks"
  on public.attendance_breaks for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Admin managers can select org attendance breaks"
  on public.attendance_breaks for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = attendance_breaks.organization_id
        and p.primary_role in ('admin', 'manager')
    )
  );

create policy "Admin managers can correct org attendance breaks"
  on public.attendance_breaks for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = attendance_breaks.organization_id
        and p.primary_role in ('admin', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = attendance_breaks.organization_id
        and p.primary_role in ('admin', 'manager')
    )
  );

drop policy if exists "Org members can select attendance settings" on public.attendance_settings;
drop policy if exists "Admin managers can manage attendance settings" on public.attendance_settings;

create policy "Org members can select attendance settings"
  on public.attendance_settings for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = attendance_settings.organization_id
    )
  );

create policy "Admin managers can manage attendance settings"
  on public.attendance_settings for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = attendance_settings.organization_id
        and p.primary_role in ('admin', 'manager')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = attendance_settings.organization_id
        and p.primary_role in ('admin', 'manager')
    )
  );

grant select, insert, update on public.attendance_sessions to authenticated;
grant select, insert, update on public.attendance_breaks to authenticated;
grant select, insert, update, delete on public.attendance_settings to authenticated;

create or replace function public.log_attendance_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.system_events') is null then
    return new;
  end if;

  if (tg_op = 'INSERT') then
    begin
      insert into public.system_events (
        organization_id,
        user_id,
        event_type,
        event_category,
        severity,
        title,
        description,
        metadata,
        source
      )
      values (
        new.organization_id,
        new.user_id,
        'clock_in',
        'attendance',
        'info',
        'User Clocked In',
        'User started their attendance session',
        jsonb_build_object(
          'session_id', new.id,
          'clock_in_at', new.clock_in_at,
          'clock_in_method', new.clock_in_method
        ),
        new.clock_in_method
      );
    exception
      when others then
        return new;
    end;
  end if;

  if (
    tg_op = 'UPDATE'
    and old.clock_out_at is null
    and new.clock_out_at is not null
  ) then
    begin
      insert into public.system_events (
        organization_id,
        user_id,
        event_type,
        event_category,
        severity,
        title,
        description,
        metadata,
        source
      )
      values (
        new.organization_id,
        new.user_id,
        'clock_out',
        'attendance',
        'info',
        'User Clocked Out',
        'User ended their attendance session',
        jsonb_build_object(
          'session_id', new.id,
          'clock_in_at', new.clock_in_at,
          'clock_out_at', new.clock_out_at,
          'work_seconds', new.work_seconds
        ),
        coalesce(new.clock_out_method, new.clock_in_method, 'web')
      );
    exception
      when others then
        return new;
    end;
  end if;

  return new;
end;
$$;

create trigger attendance_sessions_events_trigger
after insert or update on public.attendance_sessions
for each row execute function public.log_attendance_event();

create or replace function public.check_no_attendance_activity()
returns void
language plpgsql
as $$
declare
  absent_users record;
begin
  if to_regclass('public.system_alerts') is null then
    return;
  end if;

  for absent_users in
    select
      p.id as user_id,
      p.organization_id,
      p.full_name
    from public.profiles p
    where p.organization_id is not null
      and coalesce(p.primary_role, '') not in ('admin', 'it')
      and not exists (
        select 1
        from public.attendance_sessions attendance_sessions
        where attendance_sessions.user_id = p.id
          and attendance_sessions.clock_in_at >= date_trunc('day', now())
          and attendance_sessions.clock_in_at < date_trunc('day', now()) + interval '1 day'
      )
  loop
    insert into public.system_alerts (
      organization_id,
      user_id,
      alert_type,
      alert_category,
      severity,
      title,
      description,
      metadata,
      status
    )
    values (
      absent_users.organization_id,
      absent_users.user_id,
      'no_attendance',
      'attendance',
      'critical',
      'No Attendance Activity',
      'User has not clocked in today',
      jsonb_build_object(
        'user_name', absent_users.full_name,
        'date', date_trunc('day', now())
      ),
      'open'
    );
  end loop;
end;
$$;
