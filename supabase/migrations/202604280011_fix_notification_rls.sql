
create table public.notification_deliveries (
  id uuid not null default gen_random_uuid (),
  notification_id uuid not null,
  channel public.notification_channel not null,
  destination text null,
  status text not null default 'queued'::text,
  provider text null,
  provider_message_id text null,
  error_message text null,
  attempted_at timestamp with time zone null,
  delivered_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  constraint notification_deliveries_pkey primary key (id),
  constraint notification_deliveries_notification_id_fkey foreign KEY (notification_id) references notifications (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_notification_deliveries_notification on public.notification_deliveries using btree (notification_id) TABLESPACE pg_default;

create index IF not exists idx_notification_deliveries_status on public.notification_deliveries using btree (status) TABLESPACE pg_default;   

create table public.notification_preferences (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  user_id uuid not null,
  notification_type public.notification_type not null,
  channel public.notification_channel not null,
  is_enabled boolean not null default true,
  quiet_hours jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  chat_message_email boolean not null default true,
  constraint notification_preferences_pkey primary key (id),
  constraint notification_preferences_unique unique (user_id, notification_type, channel),
  constraint notification_preferences_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint notification_preferences_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_notification_preferences_user on public.notification_preferences using btree (user_id) TABLESPACE pg_default;

create trigger trg_notification_preferences_updated_at BEFORE
update on notification_preferences for EACH row
execute FUNCTION set_notification_preferences_updated_at ();

create table public.notification_topic_subscriptions (
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
  constraint notification_topic_subscriptions_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint notification_topic_subscriptions_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_notification_topic_subscriptions_org on public.notification_topic_subscriptions using btree (organization_id, user_id) TABLESPACE pg_default;

create index IF not exists idx_notification_topic_subscriptions_topic on public.notification_topic_subscriptions using btree (topic) TABLESPACE pg_default;

create trigger trg_notification_topic_subscriptions_updated_at BEFORE
update on notification_topic_subscriptions for EACH row
execute FUNCTION set_updated_at ();

create table public.notifications (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  user_id uuid not null,
  type public.notification_type not null,
  title text not null,
  message text null,
  entity_type text null,
  entity_id uuid null,
  action_url text null,
  is_read boolean not null default false,
  read_at timestamp with time zone null,
  priority public.notification_priority not null default 'medium'::notification_priority,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  reference_id uuid null,
  reference_type text null,
  actor_user_id uuid null,
  category text null,
  dedupe_key text null,
  delivery_state text not null default 'pending'::text,
  seen_at timestamp with time zone null,
  expires_at timestamp with time zone null,
  data jsonb not null default '{}'::jsonb,
  constraint notifications_pkey primary key (id),
  constraint notifications_user_dedupe_key_unique unique (user_id, dedupe_key),
  constraint notifications_actor_user_id_fkey foreign KEY (actor_user_id) references profiles (id) on delete set null,
  constraint notifications_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint notifications_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE,
  constraint notifications_delivery_state_check check (
    (
      delivery_state = any (
        array[
          'pending'::text,
          'processing'::text,
          'delivered'::text,
          'failed'::text,
          'partial'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_notifications_category on public.notifications using btree (organization_id, category, created_at desc) TABLESPACE pg_default;

create unique INDEX IF not exists idx_notifications_dedupe_key on public.notifications using btree (user_id, dedupe_key) TABLESPACE pg_default
where
  (dedupe_key is not null);

create index IF not exists idx_notifications_org_created on public.notifications using btree (organization_id, created_at desc) TABLESPACE pg_default;

create index IF not exists idx_notifications_user_created on public.notifications using btree (user_id, created_at desc) TABLESPACE pg_default;

create index IF not exists idx_notifications_user_isread_created on public.notifications using btree (user_id, is_read, created_at desc) TABLESPACE pg_default;

create index IF not exists idx_notifications_user_unread on public.notifications using btree (user_id, is_read) TABLESPACE pg_default;

create unique INDEX IF not exists notifications_user_dedupe_key_idx on public.notifications using btree (user_id, dedupe_key) TABLESPACE pg_default
where
  (dedupe_key is not null);