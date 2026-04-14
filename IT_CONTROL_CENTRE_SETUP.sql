
create table if not exists public.system_alerts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  module          text not null,                    -- e.g. 'auth', 'automations', 'database'
  severity        text not null default 'warning',  -- 'warning' | 'critical'
  status          text not null default 'open',     -- 'open' | 'acknowledged' | 'resolved'
  title           text not null,
  message         text,
  source          text,                             -- e.g. 'edge_function', 'cron', 'manual'
  metadata        jsonb not null default '{}'::jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid references profiles(id) on delete set null,
  resolved_at     timestamptz,
  resolved_by     uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_system_alerts_org_status
  on public.system_alerts(organization_id, status);

alter table public.system_alerts enable row level security;

create policy "Org members read system_alerts"
  on public.system_alerts for select
  using (organization_id in (
    select organization_id from profiles where id = auth.uid()
  ));

create policy "IT role manages system_alerts"
  on public.system_alerts for all
  using (organization_id in (
    select organization_id from profiles
    where id = auth.uid() and primary_role = 'it'
  ));



create table if not exists public.system_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  module          text not null,
  event_type      text not null,                   
  severity        text not null default 'info',     
  title           text not null,
  description     text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_system_events_org_created
  on public.system_events(organization_id, created_at desc);

alter table public.system_events enable row level security;

create policy "Org members read system_events"
  on public.system_events for select
  using (organization_id in (
    select organization_id from profiles where id = auth.uid()
  ));

create policy "IT role manages system_events"
  on public.system_events for all
  using (organization_id in (
    select organization_id from profiles
    where id = auth.uid() and primary_role = 'it'
  ));



create table if not exists public.auth_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid references profiles(id) on delete set null,
  event_type      text not null,      -- 'login' | 'login_failed' | 'logout' | 'mfa_challenge'
  status          text not null,      -- 'success' | 'failed'
  ip_address      text,
  user_agent      text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_auth_events_org_created
  on public.auth_events(organization_id, created_at desc);

alter table public.auth_events enable row level security;

create policy "Org members read own auth_events"
  on public.auth_events for select
  using (organization_id in (
    select organization_id from profiles where id = auth.uid()
  ));

create policy "IT role manages auth_events"
  on public.auth_events for all
  using (organization_id in (
    select organization_id from profiles
    where id = auth.uid() and primary_role = 'it'
  ));



create table if not exists public.password_reset_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid references profiles(id) on delete set null,
  email           text,
  status          text not null,      -- 'requested' | 'success' | 'failed'
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_password_reset_events_org_created
  on public.password_reset_events(organization_id, created_at desc);

alter table public.password_reset_events enable row level security;

create policy "IT role reads password_reset_events"
  on public.password_reset_events for select
  using (organization_id in (
    select organization_id from profiles
    where id = auth.uid() and primary_role = 'it'
  ));




create table if not exists public.user_invitation_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invited_email   text not null,
  invited_by      uuid references profiles(id) on delete set null,
  status          text not null,     
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_user_invitation_events_org_created
  on public.user_invitation_events(organization_id, created_at desc);

alter table public.user_invitation_events enable row level security;

create policy "IT role reads user_invitation_events"
  on public.user_invitation_events for select
  using (organization_id in (
    select organization_id from profiles
    where id = auth.uid() and primary_role = 'it'
  ));




create table if not exists public.it_support_tickets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  requester_id    uuid references profiles(id) on delete set null,   
  assigned_to     uuid references profiles(id) on delete set null,  
  ticket_type     text not null,

  status          text not null default 'open',

  priority        text not null default 'medium',

  title           text not null,
  description     text,
  resolution_notes text,
  requester_email text,               
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  resolved_at     timestamptz
);

create index if not exists idx_it_support_tickets_org_status
  on public.it_support_tickets(organization_id, status);

create index if not exists idx_it_support_tickets_assigned
  on public.it_support_tickets(assigned_to, status);


create or replace function public.set_it_support_ticket_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_it_support_ticket_updated_at
  before update on public.it_support_tickets
  for each row execute function set_it_support_ticket_updated_at();

alter table public.it_support_tickets enable row level security;


create policy "IT role full access on it_support_tickets"
  on public.it_support_tickets for all
  using (organization_id in (
    select organization_id from profiles
    where id = auth.uid() and primary_role = 'it'
  ));


create policy "Requester reads own tickets"
  on public.it_support_tickets for select
  using (requester_id = auth.uid());


create policy "Org members create tickets"
  on public.it_support_tickets for insert
  with check (organization_id in (
    select organization_id from profiles where id = auth.uid()
  ));
