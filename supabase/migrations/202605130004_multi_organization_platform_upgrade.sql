
alter table public.organizations
  add column if not exists logo_url text,
  add column if not exists primary_color text default '#000000',
  add column if not exists secondary_color text default '#ffffff',
  add column if not exists custom_domain text,
  add column if not exists subdomain text,
  add column if not exists status text not null default 'active',
  add column if not exists is_system_owner boolean not null default false;

update public.organizations
set
  status = case
    when coalesce(access_status, 'active') in ('suspended', 'cancelled') then 'suspended'
    else 'active'
  end,
  is_system_owner = coalesce(is_system_owner, false) or coalesce(is_system_organization, false);

update public.organizations o
set
  logo_url = coalesce(o.logo_url, b.logo_url),
  primary_color = coalesce(o.primary_color, b.primary_color),
  secondary_color = coalesce(o.secondary_color, b.secondary_color),
  custom_domain = coalesce(o.custom_domain, b.custom_domain),
  subdomain = coalesce(o.subdomain, b.subdomain)
from public.organization_branding b
where b.organization_id = o.id;

alter table public.organizations
  drop constraint if exists organizations_status_check;

alter table public.organizations
  add constraint organizations_status_check
  check (status in ('active', 'suspended'));

create unique index if not exists organizations_subdomain_unique
  on public.organizations (lower(subdomain))
  where subdomain is not null;

create unique index if not exists organizations_custom_domain_unique
  on public.organizations (lower(custom_domain))
  where custom_domain is not null;

alter table public.organization_members
  drop constraint if exists organization_members_user_id_key;

create unique index if not exists organization_members_org_user_unique
  on public.organization_members (organization_id, user_id);

alter table public.organization_features
  add column if not exists module_label text,
  add column if not exists module_category text,
  add column if not exists limits jsonb not null default '{}'::jsonb,
  add column if not exists configuration jsonb not null default '{}'::jsonb,
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists organization_features_org_key_unique
  on public.organization_features (organization_id, feature_key);

alter table public.organization_roles
  add column if not exists description text,
  add column if not exists department text,
  add column if not exists is_admin_role boolean not null default false,
  add column if not exists is_manager_role boolean not null default false,
  add column if not exists is_default_signup_role boolean not null default false,
  add column if not exists requires_approval boolean not null default true,
  add column if not exists is_active boolean not null default true,
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists onboarding_config jsonb not null default '{}'::jsonb,
  add column if not exists department_access jsonb not null default '{}'::jsonb,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

with ranked_defaults as (
  select
    id,
    row_number() over (
      partition by organization_id
      order by updated_at desc nulls last, created_at desc nulls last, id
    ) as default_rank
  from public.organization_roles
  where is_default_signup_role = true
)
update public.organization_roles r
set is_default_signup_role = false,
    updated_at = now()
from ranked_defaults d
where d.id = r.id
  and d.default_rank > 1;

create unique index if not exists organization_roles_single_default_signup
  on public.organization_roles (organization_id)
  where is_default_signup_role = true;

alter table public.organization_branding
  add column if not exists company_slogan text,
  add column if not exists company_welcome_text text,
  add column if not exists dashboard_greeting_text text,
  add column if not exists custom_terminology jsonb not null default '{}'::jsonb,
  add column if not exists invitation_template text,
  add column if not exists onboarding_wording jsonb not null default '{}'::jsonb,
  add column if not exists domain_status text,
  add column if not exists domain_verification_token text,
  add column if not exists dns_target text,
  add column if not exists domain_error text;

alter table public.organization_branding
  drop constraint if exists organization_branding_domain_status_check;

alter table public.organization_branding
  add constraint organization_branding_domain_status_check
  check (domain_status is null or domain_status in ('pending', 'verified', 'active', 'failed'));

create unique index if not exists organization_branding_subdomain_unique
  on public.organization_branding (lower(subdomain))
  where subdomain is not null and btrim(subdomain) <> '';

create unique index if not exists organization_branding_custom_domain_unique
  on public.organization_branding (lower(custom_domain))
  where custom_domain is not null and btrim(custom_domain) <> '';

alter table public.organization_invitations
  add column if not exists role_key text not null default 'user',
  add column if not exists token_hash text,
  add column if not exists invited_by uuid references public.profiles(id) on delete set null,
  add column if not exists accepted_by uuid references public.profiles(id) on delete set null,
  add column if not exists accepted_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles
  add column if not exists organization_role_key text;

create unique index if not exists organization_invitations_token_hash_unique
  on public.organization_invitations (token_hash)
  where token_hash is not null;

alter table public.platform_audit_logs
  add column if not exists actor_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists target_organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists target_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists reason text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'app_role'
  ) then
    execute 'alter type public.app_role add value if not exists ''super_admin''';
    execute 'alter type public.app_role add value if not exists ''org_admin''';
    execute 'alter type public.app_role add value if not exists ''user''';
    execute 'alter type public.app_role add value if not exists ''finance''';
  end if;
end $$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_platform_admin()
  or exists (
    select 1
    from public.profiles p
    join public.organizations o on o.id = p.organization_id
    where p.id = auth.uid()
      and coalesce(o.is_system_owner, o.is_system_organization, false) = true
      and coalesce(p.primary_role::text, '') in ('super_admin', 'superadmin', 'it-superadmin', 'admin')
      and coalesce(p.account_status, 'active') = 'active'
      and coalesce(p.is_suspended, false) = false
  );
$$;

create or replace function public.is_org_admin(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_super_admin()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = target_organization_id
      and coalesce(p.account_status, 'active') = 'active'
      and coalesce(p.is_suspended, false) = false
      and coalesce(p.primary_role::text, '') in ('org_admin', 'admin', 'superadmin', 'it-superadmin')
  )
  or exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = target_organization_id
      and om.status::text = 'active'
      and om.role::text in ('org_admin', 'admin')
  );
$$;

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_super_admin()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = target_organization_id
      and coalesce(p.account_status, 'active') = 'active'
      and coalesce(p.is_suspended, false) = false
  )
  or exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = target_organization_id
      and om.status::text = 'active'
  );
$$;

create or replace function public.organization_feature_enabled(
  target_organization_id uuid,
  target_feature_key text
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_super_admin()
  or (
    exists (
      select 1
      from public.organizations o
      where o.id = target_organization_id
        and coalesce(o.status, 'active') = 'active'
        and coalesce(o.access_status, 'active') not in ('suspended', 'cancelled')
        and coalesce(o.is_active, true) = true
    )
    and coalesce((
      select ofe.enabled
      from public.organization_features ofe
      where ofe.organization_id = target_organization_id
        and ofe.feature_key = target_feature_key
      limit 1
    ), true) = true
  );
$$;

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.organization_feature_enabled(uuid, text) to authenticated;

insert into public.organization_features (
  organization_id,
  feature_key,
  module_label,
  module_category,
  enabled
)
select o.id, f.feature_key, f.module_label, f.module_category, true
from public.organizations o
cross join (
  values
    ('leave_requests', 'Leave Requests', 'HR'),
    ('admin_dashboard', 'Admin Dashboard', 'Admin'),
    ('admin_users', 'Admin Users', 'Admin'),
    ('admin_leave', 'Admin Leave', 'Admin'),
    ('admin_roster', 'Admin Roster', 'Admin'),
    ('boards', 'Boards', 'Work Management'),
    ('tasks', 'Tasks', 'Work Management'),
    ('duty_roster', 'Duty Roster', 'HR'),
    ('meetings', 'Meetings', 'Collaboration'),
    ('chat', 'Chat', 'Collaboration'),
    ('assets', 'Assets', 'Assets'),
    ('fleet', 'Fleet', 'Assets'),
    ('stock', 'Stock', 'Assets'),
    ('finance', 'Finance', 'Finance'),
    ('attendance', 'Attendance', 'HR'),
    ('timesheets', 'Timesheets', 'HR'),
    ('ai_agent', 'AI Agent', 'Intelligence'),
    ('ai_workspace', 'AI Workspace', 'Intelligence'),
    ('media_dashboard', 'Media Dashboard', 'Media'),
    ('social_media', 'Social Media', 'Media'),
    ('automation', 'Automation', 'Operations'),
    ('notifications', 'Notifications', 'Operations'),
    ('reports', 'Reports', 'Analytics'),
    ('clients', 'Clients', 'CRM'),
    ('invoices', 'Invoices', 'Finance'),
    ('expenses', 'Expenses', 'Finance'),
    ('budgets', 'Budgets', 'Finance'),
    ('knowledge_base', 'Knowledge Base', 'Knowledge')
) as f(feature_key, module_label, module_category)
on conflict (organization_id, feature_key) do nothing;

update public.organization_features ofe
set enabled = true,
    updated_at = now()
from public.organizations o
where o.id = ofe.organization_id
  and (coalesce(o.is_system_organization, false) = true or coalesce(o.is_system_owner, false) = true);

do $$
begin
  if to_regclass('public.organization_memberships') is not null
     and exists (
       select 1
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relname = 'organization_memberships'
         and c.relkind = 'v'
     ) then
    execute 'drop view public.organization_memberships';
  end if;

  if to_regclass('public.organization_memberships') is null then
    execute $view$
      create view public.organization_memberships as
      select
        id,
        organization_id,
        user_id,
        role::text as role,
        status::text as status,
        invited_by,
        joined_at,
        created_at
      from public.organization_members
    $view$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.organization_invites') is not null
     and exists (
       select 1
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relname = 'organization_invites'
         and c.relkind = 'v'
     ) then
    execute 'drop view public.organization_invites';
  end if;

  if to_regclass('public.organization_invites') is null then
    execute $view$
      create view public.organization_invites as
      select
        id,
        organization_id,
        email,
        role_key as role,
        token_hash as token,
        invited_by,
        case status
          when 'revoked' then 'cancelled'
          else status
        end as status,
        expires_at,
        created_at,
        accepted_at
      from public.organization_invitations
    $view$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.organization_audit_logs') is not null
     and exists (
       select 1
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relname = 'organization_audit_logs'
         and c.relkind = 'v'
     ) then
    execute 'drop view public.organization_audit_logs';
  end if;

  if to_regclass('public.organization_audit_logs') is null then
    execute $view$
      create view public.organization_audit_logs as
      select
        id,
        target_organization_id as organization_id,
        actor_user_id as actor_id,
        action,
        coalesce((metadata->>'target_type'), 'organization') as target_type,
        coalesce(target_user_id::text, target_organization_id::text) as target_id,
        metadata,
        created_at
      from public.platform_audit_logs
    $view$;
  end if;
end $$;

drop policy if exists "org_members_read_own_features" on public.organization_features;
create policy "org_members_read_own_features"
on public.organization_features
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "org_admins_manage_own_features" on public.organization_features;

alter table public.organization_roles enable row level security;

drop policy if exists "platform_admins_manage_org_roles" on public.organization_roles;
create policy "platform_admins_manage_org_roles"
on public.organization_roles
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "org_admins_manage_own_roles" on public.organization_roles;
create policy "org_admins_manage_own_roles"
on public.organization_roles
for all
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

drop policy if exists "org_members_read_own_roles" on public.organization_roles;
create policy "org_members_read_own_roles"
on public.organization_roles
for select
to authenticated
using (public.is_org_member(organization_id));

drop function if exists public.get_organization_signup_roles(uuid, text);

create or replace function public.get_organization_signup_roles(
  target_organization_id uuid default null,
  target_organization_slug text default null
)
returns table (
  organization_id uuid,
  organization_name text,
  organization_slug text,
  role_key text,
  role_label text,
  is_default_signup_role boolean
)
language sql
security definer
set search_path = public
stable
as $$
  with selected_org as (
    select o.id, o.name, o.slug
    from public.organizations o
    where coalesce(o.status, 'active') = 'active'
      and coalesce(o.access_status, 'active') not in ('suspended', 'cancelled')
      and coalesce(o.is_active, true) = true
      and (
        (target_organization_id is not null and o.id = target_organization_id)
        or (
          target_organization_id is null
          and target_organization_slug is not null
          and o.slug = lower(btrim(target_organization_slug))
        )
      )
    limit 1
  ),
  safe_roles as (
    select
      so.id as organization_id,
      so.name as organization_name,
      so.slug as organization_slug,
      r.role_key,
      r.role_label,
      r.is_default_signup_role
    from selected_org so
    join public.organization_roles r on r.organization_id = so.id
    where coalesce(r.is_active, true) = true
      and coalesce(r.is_admin_role, false) = false
      and r.role_key not in (
        'admin',
        'org_admin',
        'superadmin',
        'super_admin',
        'it-superadmin',
        'platform_owner',
        'platform_admin',
        'platform_support'
      )
  )
  select *
  from safe_roles
  union all
  select
    so.id,
    so.name,
    so.slug,
    'employee',
    'Employee',
    true
  from selected_org so
  where not exists (select 1 from safe_roles)
  order by is_default_signup_role desc, role_label asc;
$$;

grant execute on function public.get_organization_signup_roles(uuid, text) to anon, authenticated;

alter table public.organization_branding enable row level security;

drop policy if exists "platform_admins_manage_org_branding" on public.organization_branding;
create policy "platform_admins_manage_org_branding"
on public.organization_branding
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "org_admins_manage_own_branding" on public.organization_branding;
create policy "org_admins_manage_own_branding"
on public.organization_branding
for all
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

drop policy if exists "org_members_read_own_branding" on public.organization_branding;
create policy "org_members_read_own_branding"
on public.organization_branding
for select
to authenticated
using (public.is_org_member(organization_id));

drop function if exists public.get_organization_branding_by_host(text);

create or replace function public.get_organization_branding_by_host(host_name text)
returns table (
  id uuid,
  organization_id uuid,
  brand_name text,
  logo_url text,
  favicon_url text,
  login_background_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  company_slogan text,
  company_welcome_text text,
  dashboard_greeting_text text,
  custom_terminology jsonb,
  invitation_template text,
  onboarding_wording jsonb,
  custom_domain text,
  subdomain text,
  domain_status text,
  domain_verification_token text,
  dns_target text,
  domain_error text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  with normalized as (
    select lower(btrim(host_name)) as host
  )
  select
    b.id,
    b.organization_id,
    b.brand_name,
    b.logo_url,
    b.favicon_url,
    b.login_background_url,
    b.primary_color,
    b.secondary_color,
    b.accent_color,
    b.company_slogan,
    b.company_welcome_text,
    b.dashboard_greeting_text,
    b.custom_terminology,
    b.invitation_template,
    b.onboarding_wording,
    b.custom_domain,
    b.subdomain,
    b.domain_status,
    null::text as domain_verification_token,
    b.dns_target,
    null::text as domain_error,
    b.created_at,
    b.updated_at
  from public.organization_branding b
  join public.organizations o on o.id = b.organization_id
  cross join normalized n
  where coalesce(o.status, 'active') = 'active'
    and coalesce(o.access_status, 'active') not in ('suspended', 'cancelled')
    and (
      lower(coalesce(b.custom_domain, '')) = n.host
      or lower(coalesce(b.subdomain, '')) = replace(n.host, '.itsnomatata.com', '')
    )
  limit 1;
$$;

grant execute on function public.get_organization_branding_by_host(text) to anon, authenticated;

drop policy if exists "org_admins_read_platform_audit_logs" on public.platform_audit_logs;
create policy "org_admins_read_platform_audit_logs"
on public.platform_audit_logs
for select
to authenticated
using (
  target_organization_id is not null
  and public.is_org_admin(target_organization_id)
);

drop policy if exists "invitees_read_own_pending_org_invitations" on public.organization_invitations;
create policy "invitees_read_own_pending_org_invitations"
on public.organization_invitations
for select
to authenticated
using (
  lower(email) = lower(coalesce(auth.email(), ''))
  and status = 'pending'
);

drop policy if exists "public_read_pending_org_invitation_by_token" on public.organization_invitations;

drop function if exists public.get_organization_invitation_by_token(text);

create or replace function public.get_organization_invitation_by_token(invitation_token text)
returns table (
  id uuid,
  organization_id uuid,
  email text,
  full_name text,
  role_key text,
  status text,
  expires_at timestamptz,
  organization_name text,
  organization_slug text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    oi.id,
    oi.organization_id,
    oi.email,
    oi.full_name,
    oi.role_key,
    oi.status,
    oi.expires_at,
    o.name as organization_name,
    o.slug as organization_slug
  from public.organization_invitations oi
  join public.organizations o on o.id = oi.organization_id
  where oi.token_hash = invitation_token
    and oi.status = 'pending'
    and (oi.expires_at is null or oi.expires_at > now())
  limit 1;
$$;

grant execute on function public.get_organization_invitation_by_token(text) to anon, authenticated;

drop policy if exists "invitees_accept_own_org_invitations" on public.organization_invitations;
create policy "invitees_accept_own_org_invitations"
on public.organization_invitations
for update
to authenticated
using (
  lower(email) = lower(coalesce(auth.email(), ''))
  and status = 'pending'
)
with check (
  lower(email) = lower(coalesce(auth.email(), ''))
  and status in ('pending', 'accepted')
);

drop policy if exists "invitees_create_own_org_membership" on public.organization_members;
create policy "invitees_create_own_org_membership"
on public.organization_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.organization_invitations oi
    where oi.organization_id = organization_members.organization_id
      and lower(oi.email) = lower(coalesce(auth.email(), ''))
      and oi.status = 'pending'
      and (oi.expires_at is null or oi.expires_at > now())
  )
);

drop policy if exists "invitees_update_own_org_membership" on public.organization_members;
create policy "invitees_update_own_org_membership"
on public.organization_members
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
