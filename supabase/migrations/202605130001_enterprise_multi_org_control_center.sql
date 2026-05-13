alter table public.organizations
  add column if not exists is_system_organization boolean not null default false,
  add column if not exists access_status text not null default 'active',
  add column if not exists suspended_reason text,
  add column if not exists suspended_at timestamptz;

alter table public.organizations
  drop constraint if exists organizations_access_status_check;

alter table public.organizations
  add constraint organizations_access_status_check
  check (access_status in ('active', 'trialing', 'suspended', 'cancelled'));

create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email text not null unique,
  role text not null default 'platform_admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_admins_role_check
    check (role in ('platform_owner', 'platform_admin', 'platform_support'))
);

create table if not exists public.organization_branding (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  brand_name text,
  logo_url text,
  favicon_url text,
  login_background_url text,
  primary_color text default '#000000',
  secondary_color text default '#ffffff',
  accent_color text default '#f97316',
  company_slogan text,
  company_welcome_text text,
  dashboard_greeting_text text,
  custom_terminology jsonb not null default '{}'::jsonb,
  invitation_template text,
  onboarding_wording jsonb not null default '{}'::jsonb,
  custom_domain text,
  subdomain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_features (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feature_key text not null,
  module_label text,
  module_category text,
  enabled boolean not null default true,
  limits jsonb not null default '{}'::jsonb,
  configuration jsonb not null default '{}'::jsonb,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, feature_key)
);

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  status text not null default 'active',
  plan_name text not null default 'enterprise',
  billing_interval text not null default 'manual',
  amount_usd numeric not null default 0,
  payment_method text not null default 'manual',
  notes text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_subscriptions_status_check
    check (status in ('active', 'trialing', 'suspended', 'cancelled', 'past_due'))
);

create table if not exists public.organization_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_key text not null,
  role_label text not null,
  description text,
  department text,
  is_admin_role boolean not null default false,
  is_manager_role boolean not null default false,
  is_default_signup_role boolean not null default false,
  requires_approval boolean not null default true,
  is_active boolean not null default true,
  permissions jsonb not null default '{}'::jsonb,
  onboarding_config jsonb not null default '{}'::jsonb,
  department_access jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, role_key)
);

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  full_name text,
  role_key text not null default 'admin',
  invited_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending',
  token_hash text,
  expires_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email),
  constraint organization_invitations_status_check
    check (status in ('pending', 'accepted', 'revoked', 'expired'))
);

create table if not exists public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  target_organization_id uuid references public.organizations(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_logs_org_created_idx
  on public.platform_audit_logs (target_organization_id, created_at desc);

insert into public.platform_admins (email, role, is_active)
values
  ('thando@itsnomatata.com', 'platform_owner', true),
  ('ben@itsnomatata.com', 'platform_owner', true),
  ('tammie@itsnomatata.com', 'platform_owner', true)
on conflict (email) do update set
  role = excluded.role,
  is_active = true,
  updated_at = now();

update public.organizations
set
  is_system_organization = true,
  access_status = 'active',
  is_active = true,
  suspended_reason = null,
  suspended_at = null
where slug = 'its-nomatata';

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where lower(pa.email) = lower(coalesce(auth.email(), ''))
      and pa.is_active = true
  );
$$;

create or replace function public.is_platform_owner_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where lower(pa.email) = lower(coalesce(auth.email(), ''))
      and pa.is_active = true
      and pa.role in ('platform_owner', 'platform_admin')
  );
$$;

create or replace function public.prevent_system_organization_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_system_organization = true then
    if new.is_active = false
      or new.access_status in ('suspended', 'cancelled')
      or new.suspended_at is not null
    then
      raise exception 'ITsNomatata is the system organization and cannot be suspended, cancelled, or blocked.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_system_organization_access on public.organizations;
create trigger protect_system_organization_access
before update on public.organizations
for each row execute function public.prevent_system_organization_block();

create or replace function public.prevent_system_organization_module_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.organizations o
    where o.id = old.organization_id
      and o.is_system_organization = true
  ) and new.enabled = false then
    raise exception 'ITsNomatata system organization modules cannot be disabled.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_system_organization_features on public.organization_features;
create trigger protect_system_organization_features
before update on public.organization_features
for each row execute function public.prevent_system_organization_module_block();

create or replace function public.prevent_system_organization_subscription_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.organizations o
    where o.id = old.organization_id
      and o.is_system_organization = true
  ) and new.status in ('suspended', 'cancelled', 'past_due') then
    raise exception 'ITsNomatata system organization subscription cannot be suspended or cancelled.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_system_organization_subscriptions on public.organization_subscriptions;
create trigger protect_system_organization_subscriptions
before update on public.organization_subscriptions
for each row execute function public.prevent_system_organization_subscription_block();

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_platform_owner_or_admin() to authenticated;

alter table public.platform_admins enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_branding enable row level security;
alter table public.organization_features enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.organization_roles enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.platform_audit_logs enable row level security;

drop policy if exists "platform_admins_manage_platform_admins" on public.platform_admins;
create policy "platform_admins_manage_platform_admins"
on public.platform_admins for all to authenticated
using (public.is_platform_owner_or_admin())
with check (public.is_platform_owner_or_admin());

drop policy if exists "platform_admins_manage_organizations" on public.organizations;
create policy "platform_admins_manage_organizations"
on public.organizations for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "members_read_own_organization" on public.organizations;
create policy "members_read_own_organization"
on public.organizations for select to authenticated
using (
  id in (
    select p.organization_id from public.profiles p
    where p.id = auth.uid()
  )
);

drop policy if exists "authenticated_read_system_organization" on public.organizations;
create policy "authenticated_read_system_organization"
on public.organizations for select to authenticated
using (is_system_organization = true or slug = 'its-nomatata');

drop policy if exists "platform_admins_manage_org_branding" on public.organization_branding;
create policy "platform_admins_manage_org_branding"
on public.organization_branding for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "org_admins_manage_own_branding" on public.organization_branding;
create policy "org_admins_manage_own_branding"
on public.organization_branding for all to authenticated
using (
  organization_id in (
    select p.organization_id from public.profiles p
    where p.id = auth.uid()
      and p.primary_role in ('admin', 'superadmin', 'it-superadmin')
  )
)
with check (
  organization_id in (
    select p.organization_id from public.profiles p
    where p.id = auth.uid()
      and p.primary_role in ('admin', 'superadmin', 'it-superadmin')
  )
);

drop policy if exists "platform_admins_manage_org_features" on public.organization_features;
create policy "platform_admins_manage_org_features"
on public.organization_features for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "org_admins_manage_own_features" on public.organization_features;
create policy "org_admins_manage_own_features"
on public.organization_features for all to authenticated
using (
  organization_id in (
    select p.organization_id from public.profiles p
    where p.id = auth.uid()
      and p.primary_role in ('admin', 'superadmin', 'it-superadmin')
  )
)
with check (
  organization_id in (
    select p.organization_id from public.profiles p
    where p.id = auth.uid()
      and p.primary_role in ('admin', 'superadmin', 'it-superadmin')
  )
);

drop policy if exists "platform_admins_manage_org_subscriptions" on public.organization_subscriptions;
create policy "platform_admins_manage_org_subscriptions"
on public.organization_subscriptions for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "platform_and_org_admins_manage_roles" on public.organization_roles;
create policy "platform_and_org_admins_manage_roles"
on public.organization_roles for all to authenticated
using (
  public.is_platform_admin()
  or organization_id in (
    select p.organization_id from public.profiles p
    where p.id = auth.uid()
      and p.primary_role in ('admin', 'superadmin', 'it-superadmin')
  )
)
with check (
  public.is_platform_admin()
  or organization_id in (
    select p.organization_id from public.profiles p
    where p.id = auth.uid()
      and p.primary_role in ('admin', 'superadmin', 'it-superadmin')
  )
);

drop policy if exists "platform_admins_manage_invitations" on public.organization_invitations;
create policy "platform_admins_manage_invitations"
on public.organization_invitations for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "org_admins_manage_own_invitations" on public.organization_invitations;
create policy "org_admins_manage_own_invitations"
on public.organization_invitations for all to authenticated
using (
  organization_id in (
    select p.organization_id from public.profiles p
    where p.id = auth.uid()
      and p.primary_role in ('admin', 'superadmin', 'it-superadmin')
  )
)
with check (
  organization_id in (
    select p.organization_id from public.profiles p
    where p.id = auth.uid()
      and p.primary_role in ('admin', 'superadmin', 'it-superadmin')
  )
);

drop policy if exists "platform_admins_read_audit_logs" on public.platform_audit_logs;
create policy "platform_admins_read_audit_logs"
on public.platform_audit_logs for select to authenticated
using (public.is_platform_admin());

drop policy if exists "platform_admins_insert_audit_logs" on public.platform_audit_logs;
create policy "platform_admins_insert_audit_logs"
on public.platform_audit_logs for insert to authenticated
with check (public.is_platform_admin());
