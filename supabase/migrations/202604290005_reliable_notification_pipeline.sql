-- Reliable notification pipeline: channels, preferences, delivery logs, push RLS.

do $$
declare
  vals text[] := array[
    'general',
    'system_alert',
    'stock_alert',
    'vehicle_alert',
    'automation',
    'meeting',
    'meeting_reminder',
    'chat_message',
    'announcement',
    'leave_update',
    'leave_request_submitted',
    'leave_request_approved',
    'leave_request_rejected',
    'leave_reminder',
    'approval_needed',
    'approval_decision',
    'project_update',
    'task_assigned',
    'task_updated',
    'task_comment',
    'task_completed',
    'duty_roster_assigned',
    'duty_roster_updated',
    'shift_reminder',
    'user_signup',
    'user_invite',
    'campaign_update',
    'campaign_assigned',
    'timesheet_reminder',
    'invoice_update',
    'budget_alert',
    'expense_submitted',
    'expense_approved',
    'expense_rejected',
    'task_collaboration_invite'
  ];
  v text;
begin
  foreach v in array vals loop
    begin
      execute format('alter type public.notification_type add value if not exists %L', v);
    exception when others then
      null;
    end;
  end loop;
end;
$$;

do $$
declare
  vals text[] := array['in_app', 'email', 'push'];
  v text;
begin
  if not exists (select 1 from pg_type where typname = 'notification_channel') then
    create type public.notification_channel as enum ('in_app', 'email', 'push');
  else
    foreach v in array vals loop
      begin
        execute format('alter type public.notification_channel add value if not exists %L', v);
      exception when others then
        null;
      end;
    end loop;
  end if;
end;
$$;

alter table public.notifications
  alter column user_id set not null;

alter table public.notifications
  add column if not exists actor_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists category text,
  add column if not exists dedupe_key text,
  add column if not exists delivery_state text not null default 'pending',
  add column if not exists seen_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists data jsonb not null default '{}'::jsonb;

do $$
begin
  alter table public.notifications
    add constraint notifications_delivery_state_check
    check (delivery_state in ('pending', 'processing', 'delivered', 'failed', 'partial'));
exception when duplicate_object then
  null;
end;
$$;

create unique index if not exists idx_notifications_dedupe_key
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists idx_notifications_category
  on public.notifications (organization_id, category, created_at desc);

create table if not exists public.notification_deliveries (
  id uuid not null default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel public.notification_channel not null,
  destination text,
  status text not null default 'queued',
  provider text,
  provider_message_id text,
  error_message text,
  attempted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_deliveries_pkey primary key (id)
);

create index if not exists idx_notification_deliveries_notification
  on public.notification_deliveries (notification_id);
create index if not exists idx_notification_deliveries_status
  on public.notification_deliveries (status);
create index if not exists idx_notification_deliveries_created
  on public.notification_deliveries (created_at desc);

create table if not exists public.push_subscriptions (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_pkey primary key (id)
);

alter table public.push_subscriptions
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists endpoint text,
  add column if not exists p256dh text,
  add column if not exists auth text,
  add column if not exists user_agent text,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists push_subscriptions_user_endpoint_idx
  on public.push_subscriptions (user_id, endpoint);

create index if not exists idx_push_subscriptions_user_active
  on public.push_subscriptions (user_id, is_active);

alter table public.notification_deliveries enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_topic_subscriptions enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "users_manage_own_push_subscriptions" on public.push_subscriptions;
create policy "users_manage_own_push_subscriptions"
on public.push_subscriptions
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users_read_own_deliveries" on public.notification_deliveries;
create policy "users_read_own_deliveries"
on public.notification_deliveries
for select
to authenticated
using (
  notification_id in (
    select id from public.notifications where user_id = auth.uid()
  )
);

drop policy if exists "org_admins_read_delivery_logs" on public.notification_deliveries;
create policy "org_admins_read_delivery_logs"
on public.notification_deliveries
for select
to authenticated
using (
  exists (
    select 1
    from public.notifications n
    join public.profiles p on p.id = auth.uid()
    where n.id = notification_id
      and p.organization_id = n.organization_id
      and p.primary_role in ('admin', 'super_admin', 'manager', 'it')
  )
);

drop policy if exists "org_members_insert_deliveries" on public.notification_deliveries;
create policy "org_members_insert_deliveries"
on public.notification_deliveries
for insert
to authenticated
with check (
  exists (
    select 1
    from public.notifications n
    where n.id = notification_id
      and (
        n.user_id = auth.uid()
        or n.organization_id in (
          select organization_id
          from public.organization_members
          where user_id = auth.uid() and status = 'active'
        )
      )
  )
);

drop policy if exists "org_members_update_deliveries" on public.notification_deliveries;
create policy "org_members_update_deliveries"
on public.notification_deliveries
for update
to authenticated
using (
  exists (
    select 1
    from public.notifications n
    where n.id = notification_id
      and (
        n.user_id = auth.uid()
        or n.organization_id in (
          select organization_id
          from public.organization_members
          where user_id = auth.uid() and status = 'active'
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.notifications n
    where n.id = notification_id
      and (
        n.user_id = auth.uid()
        or n.organization_id in (
          select organization_id
          from public.organization_members
          where user_id = auth.uid() and status = 'active'
        )
      )
  )
);

drop policy if exists "org_members_update_notification_delivery_state" on public.notifications;
create policy "org_members_update_notification_delivery_state"
on public.notifications
for update
to authenticated
using (
  user_id = auth.uid()
  or organization_id in (
    select organization_id
    from public.organization_members
    where user_id = auth.uid() and status = 'active'
  )
)
with check (
  user_id = auth.uid()
  or organization_id in (
    select organization_id
    from public.organization_members
    where user_id = auth.uid() and status = 'active'
  )
);
