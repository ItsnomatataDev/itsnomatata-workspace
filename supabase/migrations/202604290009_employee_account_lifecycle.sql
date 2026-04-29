
alter table public.profiles
  add column if not exists account_status text not null default 'pending',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references public.profiles(id) on delete set null,
  add column if not exists rejection_reason text,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references public.profiles(id) on delete set null,
  add column if not exists suspension_reason text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists deletion_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_account_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_account_status_check
      check (account_status in ('pending', 'active', 'suspended', 'rejected', 'deleted'));
  end if;
end $$;

update public.profiles
set account_status = case
  when deleted_at is not null then 'deleted'
  when coalesce(is_suspended, false) = true then 'suspended'
  when lower(coalesce(email, '')) like '%@itsnomatata.com' then 'active'
  when coalesce(is_active, false) = true then 'active'
  else 'pending'
end
where account_status is null
   or account_status not in ('pending', 'active', 'suspended', 'rejected', 'deleted');

update public.profiles
set
  account_status = 'active',
  is_active = true,
  is_suspended = false,
  approved_at = coalesce(approved_at, now())
where lower(coalesce(email, '')) like '%@itsnomatata.com'
  and coalesce(account_status, 'pending') = 'pending';

alter table public.organization_members
  add column if not exists status text not null default 'active',
  add column if not exists role text,
  add column if not exists joined_at timestamptz not null default now(),
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references public.profiles(id) on delete set null;

do $$
declare
  status_type_name text;
begin
  select c.udt_name
  into status_type_name
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'organization_members'
    and c.column_name = 'status'
    and c.data_type = 'USER-DEFINED';

  if status_type_name is not null then
    execute format('alter type public.%I add value if not exists %L', status_type_name, 'pending');
    execute format('alter type public.%I add value if not exists %L', status_type_name, 'removed');
    execute format('alter type public.%I add value if not exists %L', status_type_name, 'suspended');
  elsif not exists (
    select 1
    from pg_constraint
    where conname = 'organization_members_status_check'
  ) then
    alter table public.organization_members
      add constraint organization_members_status_check
      check (status in ('pending', 'active', 'removed', 'suspended'));
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'organization_members_status_check'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_members'
      and column_name = 'status'
      and data_type = 'USER-DEFINED'
  ) then
    alter table public.organization_members
      drop constraint organization_members_status_check;
  end if;
end $$;

create table if not exists public.employee_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'social_media',
  status text not null default 'pending',
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  token_hash text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_invitations_status_check
    check (status in ('pending', 'accepted', 'revoked', 'expired'))
);

create unique index if not exists employee_invitations_pending_unique
  on public.employee_invitations (organization_id, lower(email))
  where status = 'pending';

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_org_created
  on public.admin_audit_logs (organization_id, created_at desc);

create index if not exists idx_profiles_account_status
  on public.profiles (organization_id, account_status);

create or replace function public.is_org_admin(target_organization_id uuid)
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
      and p.account_status = 'active'
      and coalesce(p.is_suspended, false) = false
      and p.primary_role = 'admin'
  )
  or exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = target_organization_id
      and om.status = 'active'
      and om.role = 'admin'
  );
$$;

grant execute on function public.is_org_admin(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.employee_invitations enable row level security;
alter table public.admin_audit_logs enable row level security;

drop policy if exists "users_read_own_profile" on public.profiles;
create policy "users_read_own_profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "users_update_own_limited_profile" on public.profiles;
create policy "users_update_own_limited_profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "org_admins_read_profiles" on public.profiles;
create policy "org_admins_read_profiles"
on public.profiles
for select
to authenticated
using (public.is_org_admin(organization_id));

drop policy if exists "org_admins_update_profiles" on public.profiles;
create policy "org_admins_update_profiles"
on public.profiles
for update
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

drop policy if exists "users_read_own_membership" on public.organization_members;
create policy "users_read_own_membership"
on public.organization_members
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "org_admins_manage_memberships" on public.organization_members;
create policy "org_admins_manage_memberships"
on public.organization_members
for all
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

drop policy if exists "org_admins_manage_employee_invitations" on public.employee_invitations;
create policy "org_admins_manage_employee_invitations"
on public.employee_invitations
for all
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

drop policy if exists "org_admins_read_admin_audit_logs" on public.admin_audit_logs;
create policy "org_admins_read_admin_audit_logs"
on public.admin_audit_logs
for select
to authenticated
using (public.is_org_admin(organization_id));

drop policy if exists "org_admins_insert_admin_audit_logs" on public.admin_audit_logs;
create policy "org_admins_insert_admin_audit_logs"
on public.admin_audit_logs
for insert
to authenticated
with check (public.is_org_admin(organization_id));
