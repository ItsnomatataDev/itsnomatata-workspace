
do $$
declare
  vals text[] := array[
    'task_assigned',
    'task_updated',
    'task_comment',
    'task_completed',
    'approval_needed',
    'approval_decision',
    'meeting',
    'meeting_reminder',
    'announcement',
    'leave_request_submitted',
    'leave_request_approved',
    'leave_request_rejected',
    'leave_reminder',
    'system_alert',
    'automation',
    'chat_message',
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
    'expense_rejected'
  ];
  v text;
begin
  foreach v in array vals loop
    begin
      execute format('alter type public.notification_type add value if not exists %L', v);
    exception when others then
   
    end;
  end loop;
end;
$$;


do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'notification_priority'
  ) then
    create type public.notification_priority as enum ('low', 'medium', 'high', 'urgent');
  end if;
end;
$$;


create table if not exists public.notifications (
  id                uuid        not null default gen_random_uuid(),
  organization_id   uuid        not null,
  user_id           uuid        not null,
  type              text        not null,   -- text fallback if enum not set up
  title             text        not null,
  message           text,
  entity_type       text,
  entity_id         uuid,
  action_url        text,
  is_read           boolean     not null default false,
  read_at           timestamptz,
  priority          text        not null default 'medium',
  metadata          jsonb       not null default '{}',
  reference_id      uuid,
  reference_type    text,
  actor_user_id     uuid,
  created_at        timestamptz not null default now(),
  constraint notifications_pkey primary key (id)
);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, is_read);

create index if not exists idx_notifications_org_created
  on public.notifications (organization_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "users_read_own_notifications"       on public.notifications;
drop policy if exists "users_update_own_notifications"     on public.notifications;
drop policy if exists "org_members_insert_notifications"   on public.notifications;
drop policy if exists "admins_delete_notifications"        on public.notifications;

create policy "users_read_own_notifications"
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "users_update_own_notifications"
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


create policy "org_members_insert_notifications"
  on public.notifications
  for insert
  to authenticated
  with check (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );


create policy "admins_delete_notifications"
  on public.notifications
  for delete
  to authenticated
  using (user_id = auth.uid());

  do $$
  begin
    if exists (
      select 1
      from pg_publication
      where pubname = 'supabase_realtime'
    ) then
      if exists (
        select 1
        from pg_publication p
        join pg_publication_rel pr on pr.prpubid = p.oid
        join pg_class c on c.oid = pr.prrelid
        join pg_namespace n on n.oid = c.relnamespace
        where p.pubname = 'supabase_realtime'
          and n.nspname = 'public'
          and c.relname = 'notifications'
      ) then
        execute 'alter publication supabase_realtime drop table public.notifications';
      end if;

      execute 'alter publication supabase_realtime add table public.notifications';
    end if;
  end;
  $$;


create table if not exists public.notification_preferences (
  id                    uuid        not null default gen_random_uuid(),
  user_id               uuid        not null,
  email_enabled         boolean     not null default true,
  task_assigned_email   boolean     not null default true,
  task_updated_email    boolean     not null default false,
  task_comment_email    boolean     not null default true,
  approval_needed_email boolean     not null default true,
  approval_decision_email boolean   not null default true,
  meeting_email         boolean     not null default true,
  announcement_email    boolean     not null default true,
  leave_email           boolean     not null default true,
  system_alert_email    boolean     not null default true,
  automation_email      boolean     not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint notification_preferences_pkey primary key (id),
  constraint notification_preferences_user_id_key unique (user_id),
  constraint notification_preferences_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade
);

alter table public.notification_preferences enable row level security;

drop policy if exists "users_manage_own_prefs" on public.notification_preferences;
create policy "users_manage_own_prefs"
  on public.notification_preferences
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


