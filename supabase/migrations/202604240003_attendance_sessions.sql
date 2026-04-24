
drop table if exists public.attendance_sessions cascade;

create table public.attendance_sessions (
  id            uuid        not null default gen_random_uuid(),
  organization_id uuid     not null references public.organizations(id) on delete cascade,
  user_id       uuid        not null references auth.users(id) on delete cascade,

  clock_in      timestamptz not null,
  clock_out     timestamptz null,

  break_start   timestamptz null,
  break_end     timestamptz null,

  total_minutes integer     not null default 0,
  break_minutes integer     not null default 0,

  status        text        not null default 'present' check (status in ('present', 'late', 'absent')),

  source        text        not null default 'web', -- 'web', 'mobile', 'api'
  notes         text        null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint attendance_sessions_pkey primary key (id),
  constraint attendance_sessions_check check (clock_out is null or clock_out > clock_in)
);

-- Indexes for attendance sessions
create index idx_attendance_sessions_user on public.attendance_sessions(user_id, clock_in desc);
create index idx_attendance_sessions_org on public.attendance_sessions(organization_id, clock_in desc);
create index idx_attendance_sessions_status on public.attendance_sessions(status);
create index idx_attendance_sessions_clock_in on public.attendance_sessions(clock_in);

-- Function to calculate total minutes when clocking out
create or replace function calculate_attendance_duration()
returns trigger as $$
declare
  break_duration integer;
begin
  if new.clock_out is not null then

    break_duration := 0;
    if new.break_start is not null and new.break_end is not null then
      break_duration := extract(epoch from (new.break_end - new.break_start)) / 60;
    end if;
    
    -- Calculate total minutes (clocked in time minus break time)
    new.total_minutes := extract(epoch from (new.clock_out - new.clock_in)) / 60 - break_duration;
    new.break_minutes := break_duration;
  end if;
  
  -- Update status based on clock_in time (late if after 09:15)
  if new.clock_out is null then
    -- Active session - check if late
    if extract(hour from new.clock_in at time zone 'UTC') >= 9 and extract(minute from new.clock_in at time zone 'UTC') >= 15 then
      new.status := 'late';
    else
      new.status := 'present';
    end if;
  end if;
  
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger attendance_sessions_duration_trigger
  before insert or update on public.attendance_sessions
  for each row execute function calculate_attendance_duration();

-- Function to calculate break duration when ending break
create or replace function calculate_break_duration()
returns trigger as $$
begin
  if new.break_end is not null and new.break_start is not null then
    new.break_minutes := extract(epoch from (new.break_end - new.break_start)) / 60;
    
    -- Recalculate total minutes if clocked out
    if new.clock_out is not null then
      new.total_minutes := extract(epoch from (new.clock_out - new.clock_in)) / 60 - new.break_minutes;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger attendance_sessions_break_trigger
  before update on public.attendance_sessions
  for each row execute function calculate_break_duration();

-- RLS Policies
alter table public.attendance_sessions enable row level security;

-- Users can view their own attendance sessions
create policy "Users can view own attendance sessions"
  on public.attendance_sessions for select
  using (auth.uid() = user_id);

-- Users can insert their own attendance sessions
create policy "Users can insert own attendance sessions"
  on public.attendance_sessions for insert
  with check (auth.uid() = user_id);

-- Users can update their own active sessions
create policy "Users can update own attendance sessions"
  on public.attendance_sessions for update
  using (auth.uid() = user_id);

-- Admins can view all attendance sessions in their organization
create policy "Admins can view all attendance sessions"
  on public.attendance_sessions for select
  using (
    exists (
      select 1 from auth.users
      join public.profiles on profiles.id = auth.users.id
      where auth.users.id = auth.uid()
      and profiles.primary_role = 'admin'
      and profiles.organization_id = attendance_sessions.organization_id
    )
  );

-- Admins can update all attendance sessions in their organization
create policy "Admins can update all attendance sessions"
  on public.attendance_sessions for update
  using (
    exists (
      select 1 from auth.users
      join public.profiles on profiles.id = auth.users.id
      where auth.users.id = auth.uid()
      and profiles.primary_role = 'admin'
      and profiles.organization_id = attendance_sessions.organization_id
    )
  );

-- Helper function to get current active session for a user
create or replace function get_active_attendance_session(p_user_id uuid)
returns uuid as $$
declare
  session_id uuid;
begin
  select id into session_id
  from public.attendance_sessions
  where user_id = p_user_id
    and clock_out is null
  order by clock_in desc
  limit 1;
  
  return session_id;
end;
$$ language plpgsql security definer;

-- Helper function to check if user is currently clocked in
create or replace function is_user_clocked_in(p_user_id uuid)
returns boolean as $$
declare
  is_clocked_in boolean;
begin
  select exists(
    select 1 from public.attendance_sessions
    where user_id = p_user_id
      and clock_out is null
  ) into is_clocked_in;
  
  return is_clocked_in;
end;
$$ language plpgsql security definer;

-- Helper function to check if user is currently on break
create or replace function is_user_on_break(p_user_id uuid)
returns boolean as $$
declare
  is_on_break boolean;
begin
  select exists(
    select 1 from public.attendance_sessions
    where user_id = p_user_id
      and clock_out is null
      and break_start is not null
      and break_end is null
  ) into is_on_break;
  
  return is_on_break;
end;
$$ language plpgsql security definer;

-- View for team attendance status (for admin panel)
create or replace view public.team_attendance_status as
select
  u.id as user_id,
  p.full_name,
  u.email,
  p.primary_role,
  p.organization_id,
  case
    when asess.clock_out is null and asess.break_start is not null and asess.break_end is null then 'on_break'
    when asess.clock_out is null then 'online'
    else 'offline'
  end as current_status,
  asess.clock_in as last_clock_in,
  asess.break_start as break_started_at,
  asess.id as active_session_id
from auth.users u
left join public.profiles p on p.id = u.id
left join lateral (
  select *
  from public.attendance_sessions
  where attendance_sessions.user_id = u.id
    and attendance_sessions.clock_out is null
  order by clock_in desc
  limit 1
) asess on true
where p.organization_id is not null;

grant select on public.team_attendance_status to authenticated;

-- View for daily attendance summary
create or replace view public.daily_attendance_summary as
select
  user_id,
  organization_id,
  date_trunc('day', clock_in) as attendance_date,
  count(*) as sessions_count,
  sum(total_minutes) as total_worked_minutes,
  sum(break_minutes) as total_break_minutes,
  max(clock_in) as first_clock_in,
  max(clock_out) as last_clock_out,
  case
    when count(*) = 0 then 'absent'
    when max(clock_in)::time >= '09:15'::time then 'late'
    else 'present'
  end as daily_status
from public.attendance_sessions
group by
  user_id,
  organization_id,
  date_trunc('day', clock_in);

grant select on public.daily_attendance_summary to authenticated;
