
create extension if not exists pgcrypto;


create table if not exists public.notification_type_catalog (
  type text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

insert into public.notification_type_catalog (type, description)
values
  ('welcome_user', 'Welcome notification for newly created workspace users'),
  ('invited_to_workspace', 'Workspace invitation notification'),
  ('task_assigned', 'Task assignment notification'),
  ('task_due_soon', 'Task deadline reminder'),
  ('task_status_changed', 'Task status change notification'),
  ('task_comment_added', 'Task comment notification'),
  ('task_mention', 'Task mention notification'),
  ('chat_message_received', 'Chat message notification'),
  ('weekly_time_summary', 'Weekly time tracking summary'),
  ('monthly_time_summary', 'Monthly time tracking summary'),
  ('time_tracking_not_started', 'Reminder to start tracking time'),
  ('time_tracking_timer_left_running', 'Reminder to review a running timer'),
  ('invoice_or_payment_notice', 'Invoice or payment notification'),
  ('project_deadline_reminder', 'Project deadline reminder'),
  ('workspace_admin_notice', 'Workspace administrative notice')
on conflict (type) do nothing;

-- ---------------------------------------------------------------------------
-- notifications: preserve legacy fields and add requested canonical fields.
-- Existing app code still uses message/action_url/is_read; canonical body/link/
-- status columns are synced through triggers below.
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  actor_user_id uuid null,
  type text not null,
  title text not null,
  message text null,
  entity_type text null,
  entity_id uuid null,
  action_url text null,
  is_read boolean not null default false,
  read_at timestamptz null,
  priority text not null default 'medium',
  metadata jsonb not null default '{}'::jsonb,
  reference_id uuid null,
  reference_type text null,
  created_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists actor_id uuid null,
  add column if not exists actor_user_id uuid null,
  add column if not exists body text null,
  add column if not exists link text null,
  add column if not exists channel text not null default 'in_app',
  add column if not exists status text not null default 'unread',
  add column if not exists sent_at timestamptz null,
  add column if not exists category text null,
  add column if not exists dedupe_key text null,
  add column if not exists delivery_state text not null default 'pending',
  add column if not exists seen_at timestamptz null,
  add column if not exists expires_at timestamptz null,
  add column if not exists data jsonb not null default '{}'::jsonb;

update public.notifications
set
  body = coalesce(body, message),
  link = coalesce(link, action_url),
  actor_id = coalesce(actor_id, actor_user_id),
  status = case when coalesce(is_read, false) then 'read' else coalesce(status, 'unread') end
where body is null
   or link is null
   or actor_id is null
   or status is null;

do $$
begin
  alter table public.notifications
    add constraint notifications_status_check
    check (status in ('unread', 'read', 'archived'));
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.notifications
    add constraint notifications_channel_check
    check (channel in ('in_app', 'email', 'push', 'system'));
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.notifications
    add constraint notifications_priority_check
    check (priority in ('low', 'normal', 'medium', 'high', 'urgent'));
exception when duplicate_object then null;
end;
$$;

create or replace function public.sync_notification_compat_columns()
returns trigger
language plpgsql
as $$
begin
  new.message := coalesce(new.message, new.body);
  new.body := coalesce(new.body, new.message);
  new.action_url := coalesce(new.action_url, new.link);
  new.link := coalesce(new.link, new.action_url);
  new.actor_user_id := coalesce(new.actor_user_id, new.actor_id);
  new.actor_id := coalesce(new.actor_id, new.actor_user_id);

  if new.status = 'read' then
    new.is_read := true;
    new.read_at := coalesce(new.read_at, now());
  elsif new.is_read then
    new.status := 'read';
    new.read_at := coalesce(new.read_at, now());
  else
    new.status := coalesce(new.status, 'unread');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_notification_compat_columns on public.notifications;
create trigger trg_sync_notification_compat_columns
before insert or update on public.notifications
for each row execute function public.sync_notification_compat_columns();

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_user_isread_created
  on public.notifications (user_id, is_read, created_at desc);
create index if not exists idx_notifications_org_created
  on public.notifications (organization_id, created_at desc);
create index if not exists idx_notifications_type_created
  on public.notifications (organization_id, type, created_at desc);
create unique index if not exists idx_notifications_user_dedupe_key
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

-- ---------------------------------------------------------------------------
-- notification_preferences: use a compatible superset. Existing per-type rows
-- remain valid; a global row uses notification_type='global', channel='email'.
-- ---------------------------------------------------------------------------

create table if not exists public.notification_preferences (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete cascade,
  notification_type text not null default 'global',
  channel text not null default 'email',
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_pkey primary key (id)
);

alter table public.notification_preferences
  add column if not exists organization_id uuid null,
  add column if not exists notification_type text not null default 'global',
  add column if not exists channel text not null default 'email',
  add column if not exists is_enabled boolean not null default true,
  add column if not exists in_app_enabled boolean not null default true,
  add column if not exists email_enabled boolean not null default true,
  add column if not exists email_messages boolean not null default false,
  add column if not exists email_tasks boolean not null default true,
  add column if not exists email_mentions boolean not null default true,
  add column if not exists email_comments boolean not null default true,
  add column if not exists email_weekly_summary boolean not null default true,
  add column if not exists email_monthly_summary boolean not null default true,
  add column if not exists email_time_tracking_reminders boolean not null default true,
  add column if not exists quiet_hours_start time null,
  add column if not exists quiet_hours_end time null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists notification_preferences_user_type_channel_idx
  on public.notification_preferences (user_id, notification_type, channel);
create index if not exists idx_notification_preferences_org_user
  on public.notification_preferences (organization_id, user_id);

create or replace function public.set_notification_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_notification_preferences_updated_at on public.notification_preferences;
create trigger trg_notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_notification_preferences_updated_at();

-- ---------------------------------------------------------------------------
-- email_events: queue for n8n.
-- ---------------------------------------------------------------------------

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_id uuid null references public.notifications(id) on delete set null,
  event_type text not null,
  recipient_email text not null,
  recipient_name text null,
  subject text not null,
  template_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text null,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz null,
  created_at timestamptz not null default now()
);

do $$
begin
  alter table public.email_events
    add constraint email_events_status_check
    check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled'));
exception when duplicate_object then null;
end;
$$;

create index if not exists idx_email_events_pending
  on public.email_events (status, scheduled_for, created_at)
  where status = 'pending';
create index if not exists idx_email_events_org_created
  on public.email_events (organization_id, created_at desc);
create index if not exists idx_email_events_notification
  on public.email_events (notification_id);
create unique index if not exists idx_email_events_notification_template
  on public.email_events (notification_id, template_key)
  where notification_id is not null;

-- ---------------------------------------------------------------------------
-- notification_audit_logs: append-only operational log.
-- ---------------------------------------------------------------------------

create table if not exists public.notification_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid null references public.profiles(id) on delete set null,
  event_type text not null,
  channel text not null,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_audit_org_created
  on public.notification_audit_logs (organization_id, created_at desc);
create index if not exists idx_notification_audit_event
  on public.notification_audit_logs (organization_id, event_type, created_at desc);

-- ---------------------------------------------------------------------------
-- Welcome notification trigger for newly created profiles.
-- It creates in-app notifications only. The client/server notification service
-- can enqueue the email_event where profile email/workspace details are present.
-- ---------------------------------------------------------------------------

create or replace function public.create_welcome_notification_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_name text;
begin
  if new.organization_id is null then
    return new;
  end if;

  select name into workspace_name
  from public.organizations
  where id = new.organization_id;

  insert into public.notifications (
    organization_id,
    user_id,
    type,
    title,
    message,
    body,
    action_url,
    link,
    priority,
    category,
    dedupe_key,
    delivery_state,
    metadata
  )
  values (
    new.organization_id,
    new.id,
    'welcome_user',
    'Welcome to ' || coalesce(workspace_name, 'your workspace'),
    'Your workspace account is ready. Review your dashboard to get started.',
    'Your workspace account is ready. Review your dashboard to get started.',
    '/dashboard',
    '/dashboard',
    'normal',
    'users',
    'welcome_user:' || new.id,
    'delivered',
    jsonb_build_object(
      'workspace_name', workspace_name,
      'source', 'profile_insert_trigger'
    )
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_create_welcome_notification_for_profile on public.profiles;
create trigger trg_create_welcome_notification_for_profile
after insert on public.profiles
for each row execute function public.create_welcome_notification_for_profile();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.email_events enable row level security;
alter table public.notification_audit_logs enable row level security;

drop policy if exists "users_read_own_notifications" on public.notifications;
create policy "users_read_own_notifications"
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users_update_own_notifications" on public.notifications;
create policy "users_update_own_notifications"
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "org_admins_read_org_notifications" on public.notifications;
create policy "org_admins_read_org_notifications"
on public.notifications
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = notifications.organization_id
      and p.primary_role in ('admin', 'super_admin', 'manager', 'it')
  )
);

drop policy if exists "org_members_insert_notifications" on public.notifications;
create policy "org_members_insert_notifications"
on public.notifications
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles actor
    join public.profiles recipient on recipient.id = notifications.user_id
    where actor.id = auth.uid()
      and actor.organization_id = notifications.organization_id
      and recipient.organization_id = notifications.organization_id
  )
);

drop policy if exists "users_manage_own_preferences" on public.notification_preferences;
create policy "users_manage_own_preferences"
on public.notification_preferences
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "org_admins_read_notification_preferences" on public.notification_preferences;
create policy "org_admins_read_notification_preferences"
on public.notification_preferences
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = notification_preferences.organization_id
      and p.primary_role in ('admin', 'super_admin', 'manager', 'it')
  )
);

drop policy if exists "org_admins_read_email_events" on public.email_events;
create policy "org_admins_read_email_events"
on public.email_events
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = email_events.organization_id
      and p.primary_role in ('admin', 'super_admin', 'manager', 'it')
  )
);

drop policy if exists "org_members_insert_email_events" on public.email_events;
create policy "org_members_insert_email_events"
on public.email_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles actor
    join public.profiles recipient on recipient.id = email_events.user_id
    where actor.id = auth.uid()
      and actor.organization_id = email_events.organization_id
      and recipient.organization_id = email_events.organization_id
  )
);

drop policy if exists "org_admins_read_notification_audit_logs" on public.notification_audit_logs;
create policy "org_admins_read_notification_audit_logs"
on public.notification_audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = notification_audit_logs.organization_id
      and p.primary_role in ('admin', 'super_admin', 'manager', 'it')
  )
);

drop policy if exists "org_members_insert_notification_audit_logs" on public.notification_audit_logs;
create policy "org_members_insert_notification_audit_logs"
on public.notification_audit_logs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = notification_audit_logs.organization_id
  )
);

-- Realtime for existing notification UI.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then
      null;
    end;
  end if;
end;
$$;
