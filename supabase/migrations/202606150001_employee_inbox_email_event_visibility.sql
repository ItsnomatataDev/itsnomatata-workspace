create extension if not exists pgcrypto;

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

alter table public.email_events enable row level security;

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
      and p.primary_role in ('admin', 'super_admin', 'superadmin', 'manager', 'it', 'it-superadmin', 'hr')
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

drop policy if exists "employees_read_own_employee_document_email_events" on public.email_events;
create policy "employees_read_own_employee_document_email_events"
on public.email_events
for select
to authenticated
using (
  user_id = auth.uid()
  and event_type = 'employee_document'
);
