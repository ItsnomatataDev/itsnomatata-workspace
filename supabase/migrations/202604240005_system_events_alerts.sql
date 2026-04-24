-- System Events and Alerts Tables for IT War Room integration
-- These tables will log important system events and alerts

-- System Events table (logs all system events)
create table if not exists public.system_events (
  id            uuid        not null default gen_random_uuid(),
  organization_id uuid     not null references public.organizations(id) on delete cascade,
  user_id       uuid        null references auth.users(id) on delete set null,
  
  event_type    text        not null, -- 'clock_in', 'clock_out', 'break_start', 'break_end', etc.
  event_category text       not null, -- 'attendance', 'time_tracking', 'security', etc.
  severity      text        not null default 'info' check (severity in ('info', 'warning', 'error', 'critical')),
  
  title         text        not null,
  description   text        null,
  metadata      jsonb       null, -- Additional event data
  
  source        text        not null default 'system', -- 'system', 'user', 'api'
  ip_address    inet        null,
  
  created_at    timestamptz not null default now(),
  
  constraint system_events_pkey primary key (id)
);

-- Indexes for system_events
create index idx_system_events_org on public.system_events(organization_id, created_at desc);
create index idx_system_events_user on public.system_events(user_id, created_at desc);
create index idx_system_events_type on public.system_events(event_type, created_at desc);
create index idx_system_events_category on public.system_events(event_category, created_at desc);
create index idx_system_events_severity on public.system_events(severity, created_at desc);

-- System Alerts table (for actionable alerts)
create table if not exists public.system_alerts (
  id            uuid        not null default gen_random_uuid(),
  organization_id uuid     not null references public.organizations(id) on delete cascade,
  user_id       uuid        null references auth.users(id) on delete set null,
  
  alert_type    text        not null, -- 'late_clock_in', 'no_attendance', 'security', etc.
  alert_category text       not null, -- 'attendance', 'security', 'performance', etc.
  severity      text        not null check (severity in ('info', 'warning', 'error', 'critical')),
  
  title         text        not null,
  description   text        null,
  metadata      jsonb       null, -- Additional alert data
  
  status        text        not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  acknowledged_by uuid     null references auth.users(id) on delete set null,
  acknowledged_at timestamptz null,
  resolved_by   uuid        null references auth.users(id) on delete set null,
  resolved_at   timestamptz null,
  resolution_notes text   null,
  
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  
  constraint system_alerts_pkey primary key (id)
);

-- Indexes for system_alerts
create index idx_system_alerts_org on public.system_alerts(organization_id, created_at desc);
create index idx_system_alerts_user on public.system_alerts(user_id, created_at desc);
create index idx_system_alerts_type on public.system_alerts(alert_type, created_at desc);
create index idx_system_alerts_status on public.system_alerts(status, created_at desc);
create index idx_system_alerts_severity on public.system_alerts(severity, created_at desc);

-- RLS for system_events
alter table public.system_events enable row level security;

create policy "Users can view own system events"
  on public.system_events for select
  using (auth.uid() = user_id);

create policy "Admins can view all system events in org"
  on public.system_events for select
  using (
    exists (
      select 1 from auth.users
      join public.profiles on profiles.id = auth.users.id
      where auth.users.id = auth.uid()
      and profiles.primary_role in ('admin', 'it')
      and profiles.organization_id = system_events.organization_id
    )
  );

-- RLS for system_alerts
alter table public.system_alerts enable row level security;

create policy "Users can view own system alerts"
  on public.system_alerts for select
  using (auth.uid() = user_id);

create policy "Admins can view all system alerts in org"
  on public.system_alerts for select
  using (
    exists (
      select 1 from auth.users
      join public.profiles on profiles.id = auth.users.id
      where auth.users.id = auth.uid()
      and profiles.primary_role in ('admin', 'it')
      and profiles.organization_id = system_alerts.organization_id
    )
  );

create policy "Admins can update system alerts"
  on public.system_alerts for update
  using (
    exists (
      select 1 from auth.users
      join public.profiles on profiles.id = auth.users.id
      where auth.users.id = auth.uid()
      and profiles.primary_role in ('admin', 'it')
      and profiles.organization_id = system_alerts.organization_id
    )
  );

-- Function to log attendance events to system_events
create or replace function log_attendance_event()
returns trigger as $$
begin
  -- Clock In event
  if (TG_OP = 'INSERT' and new.clock_out is null) then
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
        'clock_in', new.clock_in,
        'source', new.source
      ),
      new.source
    );
    
    -- Check if late and create alert
    if extract(hour from new.clock_in at time zone 'UTC') >= 9 and extract(minute from new.clock_in at time zone 'UTC') >= 15 then
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
        new.organization_id,
        new.user_id,
        'late_clock_in',
        'attendance',
        'warning',
        'Late Clock In',
        'User clocked in after 09:15',
        jsonb_build_object(
          'session_id', new.id,
          'clock_in', new.clock_in,
          'source', new.source
        ),
        'open'
      );
    end if;
  end if;
  
  -- Clock Out event
  if (TG_OP = 'UPDATE' and old.clock_out is null and new.clock_out is not null) then
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
        'clock_in', new.clock_in,
        'clock_out', new.clock_out,
        'total_minutes', new.total_minutes,
        'break_minutes', new.break_minutes
      ),
      new.source
    );
  end if;
  
  -- Break Start event
  if (TG_OP = 'UPDATE' and old.break_start is null and new.break_start is not null) then
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
      'break_start',
      'attendance',
      'info',
      'User Started Break',
      'User started a break during their attendance session',
      jsonb_build_object(
        'session_id', new.id,
        'break_start', new.break_start
      ),
      new.source
    );
  end if;
  
  -- Break End event
  if (TG_OP = 'UPDATE' and old.break_end is null and new.break_end is not null) then
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
      'break_end',
      'attendance',
      'info',
      'User Ended Break',
      'User ended their break and resumed work',
      jsonb_build_object(
        'session_id', new.id,
        'break_start', new.break_start,
        'break_end', new.break_end,
        'break_minutes', new.break_minutes
      ),
      new.source
    );
  end if;
  
  return new;
end;
$$ language plpgsql;

-- Create triggers for attendance events
create trigger attendance_sessions_events_trigger
  after insert or update on public.attendance_sessions
  for each row execute function log_attendance_event();

-- Function to check for no attendance activity (to be run periodically)
create or replace function check_no_attendance_activity()
returns void as $$
declare
  absent_users record;
begin
  -- Find users who haven't clocked in today
  for absent_users in
    select 
      u.id as user_id,
      p.organization_id,
      p.full_name
    from auth.users u
    join public.profiles p on p.id = u.id
    where p.organization_id is not null
      and p.primary_role not in ('admin', 'it') -- Exclude admins/IT from this check
      and not exists (
        select 1 from public.attendance_sessions
        where attendance_sessions.user_id = u.id
          and date_trunc('day', attendance_sessions.clock_in) = date_trunc('day', now())
      )
  loop
    -- Create critical alert for no attendance
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
$$ language plpgsql security definer;
