create extension if not exists citext;

alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references public.profiles(id) on delete set null,
  add column if not exists suspension_reason text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists deletion_reason text;

create or replace function public.is_org_admin_or_it(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = target_organization_id
      and coalesce(p.account_status, 'active') = 'active'
      and coalesce(p.is_suspended, false) = false
      and p.primary_role in ('admin', 'it', 'superadmin', 'it-superadmin')
  );
$$;

grant execute on function public.is_org_admin_or_it(uuid) to authenticated;

create table if not exists public.account_access_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete set null,
  full_name text not null,
  email citext not null,
  phone text null,
  company text null,
  requested_role text null,
  message text null,
  status text not null default 'pending',
  reviewed_by uuid null references public.profiles(id) on delete set null,
  reviewed_at timestamptz null,
  review_notes text null,
  created_at timestamptz not null default now(),
  constraint account_access_requests_status_check
    check (status in ('pending', 'approved', 'rejected'))
);

create index if not exists account_access_requests_org_status_idx
  on public.account_access_requests (organization_id, status, created_at desc);
create index if not exists account_access_requests_email_idx
  on public.account_access_requests (lower(email::text), created_at desc);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  description text null,
  created_by uuid null references public.profiles(id) on delete set null,
  assigned_to uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint incidents_severity_check check (severity in ('low', 'medium', 'high', 'critical')),
  constraint incidents_status_check check (status in ('open', 'investigating', 'resolved'))
);

create index if not exists incidents_org_status_idx
  on public.incidents (organization_id, status, severity, created_at desc);

create table if not exists public.ai_workspace_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  prompt text not null,
  response_summary text null,
  action_type text null,
  action_status text not null default 'completed',
  requires_approval boolean not null default false,
  approved_by uuid null references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_workspace_logs_org_created_idx
  on public.ai_workspace_logs (organization_id, created_at desc);

create table if not exists public.ai_workspace_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  folder_path text not null,
  title text not null,
  content text not null,
  content_type text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_workspace_history_org_path_idx
  on public.ai_workspace_history (organization_id, folder_path, created_at desc);

alter table public.admin_audit_logs enable row level security;
alter table public.account_access_requests enable row level security;
alter table public.incidents enable row level security;
alter table public.ai_workspace_logs enable row level security;
alter table public.ai_workspace_history enable row level security;

drop policy if exists "admin_it_read_admin_audit_logs" on public.admin_audit_logs;
create policy "admin_it_read_admin_audit_logs"
on public.admin_audit_logs for select
to authenticated
using (public.is_org_admin_or_it(organization_id));

drop policy if exists "admin_it_insert_admin_audit_logs" on public.admin_audit_logs;
create policy "admin_it_insert_admin_audit_logs"
on public.admin_audit_logs for insert
to authenticated
with check (public.is_org_admin_or_it(organization_id));

drop policy if exists "public_insert_account_access_requests" on public.account_access_requests;
create policy "public_insert_account_access_requests"
on public.account_access_requests for insert
to anon, authenticated
with check (status = 'pending' and reviewed_by is null and reviewed_at is null);

drop policy if exists "admin_it_read_account_access_requests" on public.account_access_requests;
create policy "admin_it_read_account_access_requests"
on public.account_access_requests for select
to authenticated
using (
  organization_id is null
  or public.is_org_admin_or_it(organization_id)
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.primary_role in ('admin', 'it', 'superadmin', 'it-superadmin')
      and coalesce(p.account_status, 'active') = 'active'
      and coalesce(p.is_suspended, false) = false
  )
);

drop policy if exists "admin_it_update_account_access_requests" on public.account_access_requests;
create policy "admin_it_update_account_access_requests"
on public.account_access_requests for update
to authenticated
using (
  organization_id is null
  or public.is_org_admin_or_it(organization_id)
)
with check (
  organization_id is null
  or public.is_org_admin_or_it(organization_id)
);

drop policy if exists "admin_it_manage_incidents" on public.incidents;
create policy "admin_it_manage_incidents"
on public.incidents for all
to authenticated
using (public.is_org_admin_or_it(organization_id))
with check (public.is_org_admin_or_it(organization_id));

drop policy if exists "users_read_own_ai_workspace_logs" on public.ai_workspace_logs;
create policy "users_read_own_ai_workspace_logs"
on public.ai_workspace_logs for select
to authenticated
using (user_id = auth.uid() or public.is_org_admin_or_it(organization_id));

drop policy if exists "users_insert_own_ai_workspace_logs" on public.ai_workspace_logs;
create policy "users_insert_own_ai_workspace_logs"
on public.ai_workspace_logs for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users_read_own_ai_workspace_history" on public.ai_workspace_history;
create policy "users_read_own_ai_workspace_history"
on public.ai_workspace_history for select
to authenticated
using (user_id = auth.uid() or public.is_org_admin_or_it(organization_id));

drop policy if exists "users_insert_own_ai_workspace_history" on public.ai_workspace_history;
create policy "users_insert_own_ai_workspace_history"
on public.ai_workspace_history for insert
to authenticated
with check (user_id = auth.uid());

create or replace function public.notify_owner_of_account_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_profile record;
begin
  select id, organization_id
  into owner_profile
  from public.profiles
  where lower(email) = 'thando@itsnomatata.com'
  order by created_at nulls last
  limit 1;

  if owner_profile.id is not null and to_regclass('public.notifications') is not null then
    insert into public.notifications (
      organization_id,
      user_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      action_url,
      priority,
      category,
      metadata
    )
    values (
      coalesce(new.organization_id, owner_profile.organization_id),
      owner_profile.id,
      'account_access_requested',
      'New account access request',
      new.full_name || ' requested access as ' || coalesce(new.requested_role, 'a workspace user'),
      'account_access_request',
      new.id,
      '/it/war-room?panel=account-requests',
      'high',
      'security',
      jsonb_build_object('email', new.email, 'company', new.company)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists account_access_request_owner_notify on public.account_access_requests;
create trigger account_access_request_owner_notify
after insert on public.account_access_requests
for each row execute function public.notify_owner_of_account_request();

grant select, insert, update on public.account_access_requests to authenticated;
grant insert on public.account_access_requests to anon;
grant select, insert, update on public.incidents to authenticated;
grant select, insert on public.ai_workspace_logs to authenticated;
grant select, insert on public.ai_workspace_history to authenticated;
