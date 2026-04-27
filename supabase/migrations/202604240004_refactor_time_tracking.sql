
drop table if exists public.time_sessions cascade;

drop table if exists public.time_entries cascade;

create table public.time_entries (
  id            uuid        not null default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  organization_id uuid     not null references public.organizations(id) on delete cascade,
  
  project_id    uuid        null references public.projects(id) on delete set null,
  task_id       uuid        null references public.tasks(id) on delete set null,

  description   text        null,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz null,
  
  -- Duration calculations
  duration_minutes int    null,
  duration_seconds int    null,
  
  -- Work classification
  activity_type text       null, -- 'work', 'meeting', 'review', 'planning', etc.
  is_billable   boolean    not null default false,
  
  -- Approval workflow
  approval_status text     not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  approved_by   uuid       null references public.profiles(id) on delete set null,
  approved_at   timestamptz null,
  rejection_reason text   null,
  
  -- Metadata
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  
  constraint time_entries_pkey primary key (id),
  constraint time_entries_check check (ended_at is null or ended_at > started_at)
);

-- Indexes for time entries
create index idx_time_entries_user on public.time_entries(user_id, started_at desc);
create index idx_time_entries_org on public.time_entries(organization_id, started_at desc);
create index idx_time_entries_project on public.time_entries(project_id);
create index idx_time_entries_task on public.time_entries(task_id);
create index idx_time_entries_status on public.time_entries(approval_status);
create index idx_time_entries_started_at on public.time_entries(started_at);

-- Function to calculate duration when ending a time entry
create or replace function calculate_time_entry_duration()
returns trigger as $$
begin
  if new.ended_at is not null then
    new.duration_seconds := extract(epoch from (new.ended_at - new.started_at));
    new.duration_minutes := new.duration_seconds / 60;
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger time_entries_duration_trigger
  before insert or update on public.time_entries
  for each row execute function calculate_time_entry_duration();

-- RLS Policies for time entries
alter table public.time_entries enable row level security;

-- Users can view their own time entries
create policy "Users can view own time entries"
  on public.time_entries for select
  using (auth.uid() = user_id);

-- Users can insert their own time entries
create policy "Users can insert own time entries"
  on public.time_entries for insert
  with check (auth.uid() = user_id);

-- Users can update their own time entries
create policy "Users can update own time entries"
  on public.time_entries for update
  using (auth.uid() = user_id);

-- Admins can view all time entries in their organization
create policy "Admins can view all time entries"
  on public.time_entries for select
  using (
    exists (
      select 1 from auth.users
      join public.profiles on profiles.id = auth.users.id
      where auth.users.id = auth.uid()
      and profiles.primary_role = 'admin'
      and profiles.organization_id = time_entries.organization_id
    )
  );

-- Admins can update all time entries in their organization
create policy "Admins can update all time entries"
  on public.time_entries for update
  using (
    exists (
      select 1 from auth.users
      join public.profiles on profiles.id = auth.users.id
      where auth.users.id = auth.uid()
      and profiles.primary_role = 'admin'
      and profiles.organization_id = time_entries.organization_id
    )
  );

-- Admins can approve/reject time entries
create policy "Admins can approve time entries"
  on public.time_entries for update
  using (
    exists (
      select 1 from auth.users
      join public.profiles on profiles.id = auth.users.id
      where auth.users.id = auth.uid()
      and profiles.primary_role = 'admin'
      and profiles.organization_id = time_entries.organization_id
    )
  )
  with check (
    approval_status in ('approved', 'rejected')
  );

-- Update timesheet_summaries to work with time_entries directly (no sessions)
drop table if exists public.timesheet_summaries cascade;

create table public.timesheet_summaries (
  id            uuid        not null default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  organization_id uuid     not null references public.organizations(id) on delete cascade,
  
  period_start  timestamptz not null,
  period_end    timestamptz not null,
  
  -- Aggregated metrics
  total_minutes int        not null default 0,
  total_hours   numeric(10,2) not null default 0,
  billable_minutes int    not null default 0,
  billable_hours numeric(10,2) not null default 0,
  entries_count int      not null default 0,
  
  -- Approval workflow
  status        text       not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at  timestamptz null,
  approved_by   uuid       null references auth.users(id) on delete set null,
  approved_at   timestamptz null,
  rejection_reason text   null,
  
  notes         text       null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  
  constraint timesheet_summaries_pkey primary key (id),
  constraint timesheet_summaries_unique_period unique (user_id, period_start, period_end)
);

-- Indexes for timesheet summaries
create index idx_timesheet_summaries_user on public.timesheet_summaries(user_id, period_start desc);
create index idx_timesheet_summaries_org on public.timesheet_summaries(organization_id, period_start desc);
create index idx_timesheet_summaries_status on public.timesheet_summaries(status);

-- RLS for timesheet summaries
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
      select 1 from auth.users
      join public.profiles on profiles.id = auth.users.id
      where auth.users.id = auth.uid()
      and profiles.primary_role = 'admin'
      and profiles.organization_id = timesheet_summaries.organization_id
    )
  );

create policy "Admins can approve timesheet summaries"
  on public.timesheet_summaries for update
  using (
    exists (
      select 1 from auth.users
      join public.profiles on profiles.id = auth.users.id
      where auth.users.id = auth.uid()
      and profiles.primary_role = 'admin'
      and profiles.organization_id = timesheet_summaries.organization_id
    )
  );

-- Helper function to get active time entry for a user
create or replace function get_active_time_entry(p_user_id uuid)
returns uuid as $$
declare
  entry_id uuid;
begin
  select id into entry_id
  from public.time_entries
  where user_id = p_user_id
    and ended_at is null
  order by started_at desc
  limit 1;
  
  return entry_id;
end;
$$ language plpgsql security definer;

-- Helper function to check if user is tracking time
create or replace function is_user_tracking_time(p_user_id uuid)
returns boolean as $$
declare
  is_tracking boolean;
begin
  select exists(
    select 1 from public.time_entries
    where user_id = p_user_id
      and ended_at is null
  ) into is_tracking;
  
  return is_tracking;
end;
$$ language plpgsql security definer;

-- View for time tracking summary by project
create or replace view public.time_tracking_by_project as
select
  te.organization_id,
  te.project_id,
  p.name as project_name,
  te.user_id,
  prof.full_name as user_name,
  date_trunc('week', te.started_at) as week_start,
  (date_trunc('week', te.started_at) + interval '7 days') as week_end,
  sum(te.duration_seconds) as total_seconds,
  sum(te.duration_seconds) / 3600.0 as total_hours,
  count(*) as entry_count,
  sum(case when te.is_billable then te.duration_seconds else 0 end) as billable_seconds
from public.time_entries te
left join public.projects p on te.project_id = p.id
left join auth.users u on te.user_id = u.id
left join public.profiles prof on prof.id = u.id
where te.ended_at is not null
group by
  te.organization_id,
  te.project_id,
  p.name,
  te.user_id,
  prof.full_name,
  date_trunc('week', te.started_at);

grant select on public.time_tracking_by_project to authenticated;
