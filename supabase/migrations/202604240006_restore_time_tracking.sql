drop table if exists public.time_entries cascade;

drop table if exists public.time_sessions cascade;

create table public.time_sessions (
  id            uuid        not null default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  organization_id uuid     not null references public.organizations(id) on delete cascade,
  clock_in      timestamptz not null default now(),
  clock_out     timestamptz null,
  duration_minutes int    null,
  location_ip   inet       null,
  location_coordinates jsonb null,
  notes         text       null,
  status        text        not null default 'active' check (status in ('active', 'completed', 'auto_clocked_out')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint time_sessions_pkey primary key (id),
  constraint time_sessions_check check (clock_out is null or clock_out > clock_in)
);

-- Indexes for time sessions
create index idx_time_sessions_user on public.time_sessions(user_id, clock_in desc);
create index idx_time_sessions_org on public.time_sessions(organization_id, clock_in desc);
create index idx_time_sessions_status on public.time_sessions(status);

-- RLS for time_sessions
alter table public.time_sessions enable row level security;

create policy "Users can view own time sessions"
  on public.time_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own time sessions"
  on public.time_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own time sessions"
  on public.time_sessions for update
  using (auth.uid() = user_id);

create table public.time_entries (
  id            uuid        not null default gen_random_uuid(),
  session_id    uuid        null references public.time_sessions(id) on delete cascade,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  organization_id uuid     not null references public.organizations(id) on delete cascade,
  
  project_id    uuid        null references public.projects(id) on delete set null,
  task_id       uuid        null references public.tasks(id) on delete set null,
  client_id     uuid        null,
  campaign_id   uuid        null,
  
  description   text        null,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz null,
  
  is_running    boolean     not null default false,
  duration_seconds int     null,
  duration_minutes int     null,
  
  source        text        not null default 'web',
  is_billable   boolean     not null default false,
  
  hourly_rate_snapshot numeric(10,2) null,
  cost_amount   numeric(10,2) null,
  
  approval_status text     not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  approved_by   uuid       null references auth.users(id) on delete set null,
  approved_at   timestamptz null,
  
  invoice_id    uuid        null,
  locked_at     timestamptz null,
  
  metadata      jsonb       null,
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
create index idx_time_entries_ended_at on public.time_entries(ended_at);
create index idx_time_entries_is_running on public.time_entries(is_running);

-- RLS for time_entries
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

-- Helper function to get active time entry for a user
create or replace function get_active_time_entry(p_user_id uuid)
returns uuid as $$
declare
  entry_id uuid;
begin
  select id into entry_id
  from public.time_entries
  where user_id = p_user_id
    and is_running = true
    and ended_at is null
  order by started_at desc
  limit 1;
  
  return entry_id;
end;
$$ language plpgsql security definer;

-- Function to check if user is tracking time
create or replace function is_user_tracking_time(p_user_id uuid)
returns boolean as $$
declare
  is_tracking boolean;
begin
  select exists(
    select 1 from public.time_entries
    where user_id = p_user_id
      and is_running = true
      and ended_at is null
  ) into is_tracking;
  
  return is_tracking;
end;
$$ language plpgsql security definer;

-- Grant permissions
grant usage on schema public to authenticated;
grant select on public.time_sessions to authenticated;
grant insert on public.time_sessions to authenticated;
grant update on public.time_sessions to authenticated;
grant delete on public.time_sessions to authenticated;
grant select on public.time_entries to authenticated;
grant insert on public.time_entries to authenticated;
grant update on public.time_entries to authenticated;
grant delete on public.time_entries to authenticated;
grant execute on function get_active_time_entry(uuid) to authenticated;
grant execute on function is_user_tracking_time(uuid) to authenticated;
