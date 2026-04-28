-- Create notification_deliveries table for multi-channel tracking
create table if not exists public.notification_deliveries (
  id uuid not null default gen_random_uuid (),
  notification_id uuid not null,
  channel public.notification_channel not null,
  destination text null,
  status text not null default 'queued',
  provider text null,
  provider_message_id text null,
  error_message text null,
  attempted_at timestamp with time zone null,
  delivered_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  constraint notification_deliveries_pkey primary key (id),
  constraint notification_deliveries_notification_id_fkey foreign key (notification_id) references public.notifications (id) on delete cascade
);

create index if not exists idx_notification_deliveries_notification on public.notification_deliveries (notification_id);
create index if not exists idx_notification_deliveries_status on public.notification_deliveries (status);

-- Create notification_preferences table for granular per-type preferences
create table if not exists public.notification_preferences (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  user_id uuid not null,
  notification_type public.notification_type not null,
  channel public.notification_channel not null,
  is_enabled boolean not null default true,
  quiet_hours jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint notification_preferences_pkey primary key (id),
  constraint notification_preferences_unique unique (user_id, notification_type, channel),
  constraint notification_preferences_organization_id_fkey foreign key (organization_id) references organizations (id) on delete cascade,
  constraint notification_preferences_user_id_fkey foreign key (user_id) references profiles (id) on delete cascade
);

create index if not exists idx_notification_preferences_user on public.notification_preferences (user_id);

-- Create trigger for updated_at
create or replace function set_notification_preferences_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_notification_preferences_updated_at on notification_preferences;
create trigger trg_notification_preferences_updated_at
before update on notification_preferences
for each row
execute function set_notification_preferences_updated_at();

-- Create notification_topic_subscriptions table for topic-based subscriptions
create table if not exists public.notification_topic_subscriptions (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  user_id uuid not null,
  topic text not null,
  channel public.notification_channel not null,
  is_enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint notification_topic_subscriptions_pkey primary key (id),
  constraint notification_topic_subscriptions_unique unique (user_id, topic, channel),
  constraint notification_topic_subscriptions_organization_id_fkey foreign key (organization_id) references organizations (id) on delete cascade,
  constraint notification_topic_subscriptions_user_id_fkey foreign key (user_id) references profiles (id) on delete cascade
);

create index if not exists idx_notification_topic_subscriptions_org on public.notification_topic_subscriptions (organization_id, user_id);
create index if not exists idx_notification_topic_subscriptions_topic on public.notification_topic_subscriptions (topic);

-- Enable RLS
alter table public.notification_deliveries enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_topic_subscriptions enable row level security;

-- RLS policies for notification_deliveries
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

drop policy if exists "org_members_insert_deliveries" on public.notification_deliveries;
create policy "org_members_insert_deliveries"
on public.notification_deliveries
for insert
to authenticated
with check (
  notification_id in (
    select id from public.notifications
    where user_id = auth.uid()
    or organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  )
);

-- RLS policies for notification_preferences
drop policy if exists "users_manage_own_preferences" on public.notification_preferences;
create policy "users_manage_own_preferences"
on public.notification_preferences
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- RLS policies for notification_topic_subscriptions
drop policy if exists "users_manage_own_subscriptions" on public.notification_topic_subscriptions;
create policy "users_manage_own_subscriptions"
on public.notification_topic_subscriptions
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
