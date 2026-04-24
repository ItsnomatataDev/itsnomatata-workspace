-- Time Tracking Tables for Clock In/Out functionality
-- Similar to Jibble time tracking system

-- Drop existing tables if they exist (to handle partial migrations)
drop table if exists public.time_entries cascade;
drop table if exists public.timesheet_summaries cascade;
drop table if exists public.time_sessions cascade;

-- Time sessions table (stores each clock in/out session)
create table public.time_sessions (
  id            uuid        not null default gen_random_uuid(),
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  organization_id uuid     not null,
  clock_in      timestamptz not null default now(),
  clock_out     timestamptz null,
  duration_minutes int    null,
  location_ip   inet       null,
  location_coordinates jsonb null, -- {lat, lng}
  notes         text       null,
  status        text       not null default 'active', -- 'active', 'completed', 'auto_clocked_out'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint time_sessions_pkey primary key (id),
  constraint time_sessions_check check (status in ('active', 'completed', 'auto_clocked_out'))
);

-- Indexes for time sessions
create index if not exists idx_time_sessions_user on public.time_sessions(user_id, clock_in desc);
create index if not exists idx_time_sessions_org on public.time_sessions(organization_id, clock_in desc);
create index if not exists idx_time_sessions_status on public.time_sessions(status);

-- Time entries table (stores detailed time tracking entries within sessions)
create table public.time_entries (
  id            uuid        not null default gen_random_uuid(),
  session_id    uuid        not null references public.time_sessions(id) on delete cascade,
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  organization_id uuid     not null,
  project_id    uuid        null,
  task_id       uuid        null,
  description   text        null,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz null,
  duration_minutes int    null,
  duration_seconds int    null,
  activity_type text       null, -- 'work', 'break', 'meeting', etc.
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint time_entries_pkey primary key (id),
  constraint time_entries_check check (ended_at is null or ended_at > started_at)
);

-- Indexes for time entries
create index if not exists idx_time_entries_session on public.time_entries(session_id);
create index if not exists idx_time_entries_user on public.time_entries(user_id, started_at desc);
create index if not exists idx_time_entries_project on public.time_entries(project_id);

-- Timesheet summaries (aggregated data for reporting)
create table if not exists public.timesheet_summaries (
  id            uuid        not null default gen_random_uuid(),
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  organization_id uuid     not null,
  period_start  timestamptz not null,
  period_end    timestamptz not null,
  total_minutes int        not null default 0,
  total_hours   numeric(10,2) not null default 0,
  break_minutes int        not null default 0,
  work_minutes  int        not null default 0,
  sessions_count int      not null default 0,
  status        text       not null default 'draft', -- 'draft', 'submitted', 'approved', 'rejected'
  approved_by   uuid       null references public.profiles(id),
  approved_at   timestamptz null,
  notes         text       null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint timesheet_summaries_pkey primary key (id),
  constraint timesheet_summaries_unique_period unique (user_id, period_start, period_end),
  constraint timesheet_summaries_check check (status in ('draft', 'submitted', 'approved', 'rejected'))
);

-- Indexes for timesheet summaries
create index if not exists idx_timesheet_summaries_user on public.timesheet_summaries(user_id, period_start desc);
create index if not exists idx_timesheet_summaries_org on public.timesheet_summaries(organization_id, period_start desc);
create index if not exists idx_timesheet_summaries_status on public.timesheet_summaries(status);

-- Function to automatically calculate duration when clocking out
create or replace function calculate_session_duration()
returns trigger as $$
begin
  if new.clock_out is not null then
    new.duration_minutes := extract(epoch from (new.clock_out - new.clock_in)) / 60;
    new.status := 'completed';
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger time_sessions_duration_trigger
  before insert or update on public.time_sessions
  for each row execute function calculate_session_duration();

-- Function to calculate duration_seconds for time_entries
create or replace function calculate_entry_duration()
returns trigger as $$
begin
  if new.ended_at is not null then
    new.duration_minutes := extract(epoch from (new.ended_at - new.started_at)) / 60;
    new.duration_seconds := extract(epoch from (new.ended_at - new.started_at));
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger time_entries_duration_trigger
  before insert or update on public.time_entries
  for each row execute function calculate_entry_duration();

-- Function to update timesheet summary when session is completed
create or replace function update_timesheet_summary()
returns trigger as $$
declare
  summary_record timesheet_summaries%rowtype;
  week_start timestamptz;
  week_end timestamptz;
begin
  if new.status = 'completed' and old.status = 'active' then
    -- Calculate week boundaries (Monday to Sunday)
    week_start := date_trunc('week', new.clock_in);
    week_end := week_start + interval '7 days';
    
    -- Insert or update summary
    insert into public.timesheet_summaries (
      user_id,
      organization_id,
      period_start,
      period_end,
      total_minutes,
      total_hours,
      sessions_count,
      status
    )
    values (
      new.user_id,
      new.organization_id,
      week_start,
      week_end,
      coalesce(new.duration_minutes, 0),
      coalesce(new.duration_minutes, 0)::numeric / 60,
      1,
      'draft'
    )
    on conflict (user_id, period_start, period_end)
    do update set
      total_minutes = timesheet_summaries.total_minutes + coalesce(new.duration_minutes, 0),
      total_hours = (timesheet_summaries.total_minutes + coalesce(new.duration_minutes, 0))::numeric / 60,
      sessions_count = timesheet_summaries.sessions_count + 1,
      updated_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger time_sessions_summary_trigger
  after update on public.time_sessions
  for each row execute function update_timesheet_summary();

-- RLS Policies
alter table public.time_sessions enable row level security;

-- Users can see their own time sessions
create policy "Users can view own time sessions"
  on public.time_sessions for select
  using (auth.uid() = user_id);

-- Users can insert their own time sessions
create policy "Users can insert own time sessions"
  on public.time_sessions for insert
  with check (auth.uid() = user_id);

-- Users can update their own active sessions
create policy "Users can update own time sessions"
  on public.time_sessions for update
  using (auth.uid() = user_id);

-- Admins can view all time sessions in their organization
create policy "Admins can view all time sessions"
  on public.time_sessions for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.primary_role = 'admin'
      and profiles.organization_id = time_sessions.organization_id
    )
  );

-- Admins can update all time sessions in their organization
create policy "Admins can update all time sessions"
  on public.time_sessions for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.primary_role = 'admin'
      and profiles.organization_id = time_sessions.organization_id
    )
  );

-- Time entries RLS
alter table public.time_entries enable row level security;

create policy "Users can view own time entries"
  on public.time_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert own time entries"
  on public.time_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update own time entries"
  on public.time_entries for update
  using (auth.uid() = user_id);

create policy "Admins can view all time entries"
  on public.time_entries for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.primary_role = 'admin'
      and profiles.organization_id = (
        select organization_id from public.time_sessions
        where time_sessions.id = time_entries.session_id
        limit 1
      )
    )
  );

-- Timesheet summaries RLS
alter table public.timesheet_summaries enable row level security;

create policy "Users can view own timesheet summaries"
  on public.timesheet_summaries for select
  using (auth.uid() = user_id);

create policy "Users can insert own timesheet summaries"
  on public.timesheet_summaries for insert
  with check (auth.uid() = user_id);

create policy "Users can update own timesheet summaries"
  on public.timesheet_summaries for update
  using (auth.uid() = user_id);

create policy "Admins can view all timesheet summaries"
  on public.timesheet_summaries for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.primary_role = 'admin'
      and profiles.organization_id = timesheet_summaries.organization_id
    )
  );

create policy "Admins can approve timesheet summaries"
  on public.timesheet_summaries for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.primary_role = 'admin'
      and profiles.organization_id = timesheet_summaries.organization_id
    )
  );
