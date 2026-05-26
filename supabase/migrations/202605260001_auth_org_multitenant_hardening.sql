create extension if not exists pgcrypto;

alter table public.profiles
  alter column primary_role set default 'user';

update public.profiles
set primary_role = 'user'
where primary_role::text = 'social_media'
  and not exists (
    select 1
    from public.organization_members om
    where om.user_id = profiles.id
      and om.status::text = 'active'
      and om.role::text = 'social_media'
  );

create or replace function public.is_active_org_member(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    left join public.profiles p on p.id = om.user_id
    where om.user_id = auth.uid()
      and om.organization_id = target_organization_id
      and om.status::text = 'active'
      and coalesce(p.account_status, 'active') = 'active'
      and coalesce(p.is_active, true) = true
      and coalesce(p.is_suspended, false) = false
      and coalesce(o.status, 'active') = 'active'
      and coalesce(o.is_active, true) = true
      and coalesce(o.access_status, 'active') in ('active', 'trialing')
  );
$$;

create or replace function public.is_active_org_admin(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    left join public.profiles p on p.id = om.user_id
    left join public.organization_roles r
      on r.organization_id = om.organization_id
     and r.role_key = om.role::text
    where om.user_id = auth.uid()
      and om.organization_id = target_organization_id
      and om.status::text = 'active'
      and coalesce(p.account_status, 'active') = 'active'
      and coalesce(p.is_active, true) = true
      and coalesce(p.is_suspended, false) = false
      and coalesce(o.status, 'active') = 'active'
      and coalesce(o.is_active, true) = true
      and coalesce(o.access_status, 'active') in ('active', 'trialing')
      and (
        om.role::text in ('admin', 'org_admin', 'super_admin', 'superadmin', 'it-superadmin')
        or coalesce(r.is_admin_role, false) = true
      )
  );
$$;

create or replace function public.is_org_admin(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_active_org_admin(target_organization_id);
$$;

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_active_org_member(target_organization_id)
    or public.is_platform_admin();
$$;

create or replace function public.safe_profile_role(target_organization_id uuid, target_role text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  with normalized as (
    select lower(btrim(coalesce(target_role, 'user'))) as role_key
  ),
  candidates(role_key, priority) as (
    select case
      when n.role_key = 'employee' then 'user'
      when n.role_key = 'superadmin' then 'super_admin'
      else n.role_key
    end, 1
    from normalized n
    where n.role_key in (
      'admin',
      'org_admin',
      'super_admin',
      'superadmin',
      'it-superadmin',
      'user',
      'manager',
      'it',
      'media_team',
      'seo_specialist',
      'finance',
      'social_media',
      'employee'
    )
    union all
    select 'admin', 2
    from normalized n
    where n.role_key in ('super_admin', 'superadmin', 'it-superadmin', 'org_admin')
    union all
    select 'user', 99
  )
  select c.role_key
  from candidates c
  where exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public'
      and t.typname = 'app_role'
      and e.enumlabel = c.role_key
  )
  order by c.priority
  limit 1;
$$;

create or replace function public.my_profile_locked_fields()
returns table (
  organization_id uuid,
  primary_role text,
  organization_role_key text,
  account_status text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.organization_id,
    p.primary_role::text,
    p.organization_role_key,
    p.account_status
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

drop function if exists public.get_organization_branding_by_host(text);
drop function if exists public.ensure_current_user_profile(text);
drop function if exists public.get_my_current_organization();
drop function if exists public.get_my_active_memberships();
drop function if exists public.maybe_accept_invitation_for_current_user(uuid, text);
drop function if exists public.get_organization_by_host(text);

create or replace function public.get_organization_by_host(host_name text)
returns table (
  id uuid,
  name text,
  slug text,
  status text,
  access_status text,
  is_active boolean,
  is_system_organization boolean,
  domain text,
  domain_status text
)
language sql
security definer
set search_path = public
stable
as $$
  with normalized as (
    select lower(split_part(btrim(coalesce(host_name, '')), ':', 1)) as host
  ),
  system_host as (
    select o.id, o.name, o.slug, o.status, o.access_status, o.is_active, o.is_system_organization,
           'codex.itsnomatata.com'::text as domain,
           'connected'::text as domain_status
    from public.organizations o
    cross join normalized n
    where n.host = 'codex.itsnomatata.com'
      and o.slug = 'its-nomatata'
  ),
  connected_host as (
    select o.id, o.name, o.slug, o.status, o.access_status, o.is_active, o.is_system_organization,
           od.domain, od.status as domain_status
    from public.organization_domains od
    join public.organizations o on o.id = od.organization_id
    cross join normalized n
    where od.domain = n.host
      and od.status in ('verified', 'connected')
  )
  select *
  from (
    select * from connected_host
    union all
    select * from system_host
  ) matched
  where coalesce(matched.status, 'active') = 'active'
    and coalesce(matched.is_active, true) = true
    and coalesce(matched.access_status, 'active') in ('active', 'trialing')
  limit 1;
$$;

drop function if exists public.get_my_active_memberships();

create or replace function public.get_my_active_memberships()
returns table (
  membership_id uuid,
  organization_id uuid,
  organization_name text,
  organization_slug text,
  role text,
  status text,
  joined_at timestamptz,
  access_status text,
  organization_is_active boolean,
  is_system_organization boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    om.id,
    om.organization_id,
    o.name,
    o.slug,
    om.role::text,
    om.status::text,
    om.joined_at,
    o.access_status,
    o.is_active,
    coalesce(o.is_system_organization, false)
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  left join public.profiles p on p.id = om.user_id
  where om.user_id = auth.uid()
    and om.status::text = 'active'
    and coalesce(p.account_status, 'active') = 'active'
    and coalesce(p.is_active, true) = true
    and coalesce(p.is_suspended, false) = false
    and coalesce(o.status, 'active') = 'active'
    and coalesce(o.is_active, true) = true
    and coalesce(o.access_status, 'active') in ('active', 'trialing')
  order by coalesce(om.joined_at, om.created_at) asc;
$$;

drop function if exists public.get_my_current_organization();

create or replace function public.get_my_current_organization()
returns table (
  organization_id uuid,
  organization_name text,
  organization_slug text,
  role text,
  membership_status text,
  access_status text,
  organization_is_active boolean,
  is_system_organization boolean
)
language sql
security definer
set search_path = public
stable
as $$
  with active_memberships as (
    select *
    from public.get_my_active_memberships()
  ),
  preferred as (
    select am.*
    from active_memberships am
    left join public.profiles p on p.id = auth.uid()
    order by (am.organization_id = p.organization_id) desc, am.joined_at asc nulls last
    limit 1
  )
  select
    p.organization_id,
    p.organization_name,
    p.organization_slug,
    p.role,
    p.status,
    p.access_status,
    p.organization_is_active,
    p.is_system_organization
  from preferred p;
$$;

drop function if exists public.ensure_current_user_profile(text);

create or replace function public.ensure_current_user_profile(host_name text default null)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := lower(btrim(coalesce(auth.email(), '')));
  metadata jsonb := coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb);
  full_name_value text := nullif(btrim(coalesce(metadata ->> 'full_name', metadata ->> 'name', '')), '');
  active_membership record;
  pending_invitation record;
  host_organization record;
  selected_organization_id uuid;
  selected_role text := 'user';
  selected_status text := 'pending_approval';
  existing_profile public.profiles%rowtype;
  result_profile public.profiles%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into existing_profile
  from public.profiles
  where id = current_user_id;

  select *
  into active_membership
  from public.get_my_active_memberships()
  limit 1;

  if active_membership.organization_id is not null then
    selected_organization_id := active_membership.organization_id;
    selected_role := public.safe_profile_role(active_membership.organization_id, active_membership.role);
    selected_status := 'active';
  else
    select oi.organization_id, oi.role_key
    into pending_invitation
    from public.organization_invitations oi
    join public.organizations o on o.id = oi.organization_id
    where lower(oi.email) = current_email
      and oi.status = 'pending'
      and (oi.expires_at is null or oi.expires_at > now())
      and coalesce(o.status, 'active') = 'active'
      and coalesce(o.is_active, true) = true
      and coalesce(o.access_status, 'active') in ('active', 'trialing')
    order by oi.created_at desc
    limit 1;

    if pending_invitation.organization_id is not null then
      selected_organization_id := pending_invitation.organization_id;
      selected_role := public.safe_profile_role(pending_invitation.organization_id, pending_invitation.role_key);
      selected_status := 'pending_approval';
    else
      select *
      into host_organization
      from public.get_organization_by_host(host_name)
      limit 1;

      if host_organization.id is not null then
        selected_organization_id := host_organization.id;
        selected_role := public.safe_profile_role(host_organization.id, 'user');
        selected_status := case
          when lower(current_email) like '%@itsnomatata.com'
            and host_organization.slug = 'its-nomatata'
            then 'active'
          else 'pending_approval'
        end;
      end if;
    end if;
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    organization_id,
    primary_role,
    organization_role_key,
    account_status,
    is_active,
    is_suspended,
    last_seen_at
  )
  values (
    current_user_id,
    nullif(current_email, ''),
    coalesce(full_name_value, existing_profile.full_name),
    selected_organization_id,
    selected_role::public.app_role,
    selected_role,
    selected_status,
    selected_status = 'active',
    false,
    now()
  )
  on conflict (id) do update
  set
    email = coalesce(excluded.email, public.profiles.email),
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    organization_id = selected_organization_id,
    primary_role = selected_role::public.app_role,
    organization_role_key = selected_role,
    account_status = case
      when coalesce(public.profiles.account_status, '') in ('suspended', 'rejected', 'deleted')
        then public.profiles.account_status
      else selected_status
    end,
    is_active = case
      when coalesce(public.profiles.account_status, '') in ('suspended', 'rejected', 'deleted')
        then false
      else selected_status = 'active'
    end,
    is_suspended = coalesce(public.profiles.is_suspended, false),
    last_seen_at = now();

  select *
  into result_profile
  from public.profiles
  where id = current_user_id;

  if selected_organization_id is not null
     and coalesce(result_profile.account_status, '') not in ('suspended', 'rejected', 'deleted') then
    insert into public.organization_members (
      organization_id,
      user_id,
      role,
      status,
      joined_at,
      removed_at,
      removed_by
    )
    values (
      selected_organization_id,
      current_user_id,
      selected_role::public.app_role,
      (case when selected_status = 'active' then 'active' else 'pending' end)::public.member_status,
      now(),
      null,
      null
    )
    on conflict (organization_id, user_id) do update
    set
      role = case
        when public.organization_members.status::text = 'active'
          then public.organization_members.role
        else excluded.role
      end,
      status = case
        when public.organization_members.status::text = 'active'
          then public.organization_members.status
        else excluded.status
      end,
      joined_at = case
        when public.organization_members.status::text = 'active'
          then public.organization_members.joined_at
        when excluded.status::text = 'active'
          then coalesce(public.organization_members.joined_at, now())
        else public.organization_members.joined_at
      end,
      removed_at = case
        when excluded.status::text = 'active' then null
        else public.organization_members.removed_at
      end,
      removed_by = case
        when excluded.status::text = 'active' then null
        else public.organization_members.removed_by
      end;
  end if;

  return result_profile;
end;
$$;

drop function if exists public.maybe_accept_invitation_for_current_user(uuid, text);

create or replace function public.maybe_accept_invitation_for_current_user(invitation_id uuid default null, invitation_token text default null)
returns table (
  accepted boolean,
  organization_id uuid,
  role text,
  invitation_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := lower(btrim(coalesce(auth.email(), '')));
  invite record;
  profile_role text;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select oi.*
  into invite
  from public.organization_invitations oi
  join public.organizations o on o.id = oi.organization_id
  where (
      (invitation_id is not null and oi.id = invitation_id)
      or (invitation_token is not null and oi.token_hash = invitation_token)
    )
    and lower(oi.email) = current_email
    and oi.status = 'pending'
    and (oi.expires_at is null or oi.expires_at > now())
    and coalesce(o.status, 'active') = 'active'
    and coalesce(o.is_active, true) = true
    and coalesce(o.access_status, 'active') in ('active', 'trialing')
  order by oi.created_at desc
  limit 1;

  if invite.id is null then
    return query select false, null::uuid, null::text, 'not_found'::text;
    return;
  end if;

  profile_role := public.safe_profile_role(invite.organization_id, invite.role_key);

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    joined_at
  )
  values (
    invite.organization_id,
    current_user_id,
    profile_role::public.app_role,
    'active'::public.member_status,
    now()
  )
  on conflict (organization_id, user_id) do update
  set
    role = excluded.role,
    status = 'active'::public.member_status,
    joined_at = coalesce(public.organization_members.joined_at, now());

  update public.organization_invitations
  set
    status = 'accepted',
    accepted_by = current_user_id,
    accepted_at = now(),
    updated_at = now()
  where id = invite.id;

  update public.profiles
  set
    organization_id = invite.organization_id,
    primary_role = profile_role::public.app_role,
    organization_role_key = profile_role,
    account_status = 'active',
    is_active = true,
    is_suspended = false,
    last_seen_at = now()
  where id = current_user_id;

  insert into public.platform_audit_logs (
    actor_user_id,
    target_organization_id,
    target_user_id,
    action,
    metadata
  )
  values (
    current_user_id,
    invite.organization_id,
    current_user_id,
    'organization_invitation_accepted',
    jsonb_build_object('email', current_email, 'roleKey', invite.role_key, 'profileRole', profile_role)
  );

  return query select true, invite.organization_id, invite.role_key::text, 'accepted'::text;
end;
$$;

drop function if exists public.get_organization_branding_by_host(text);

create or replace function public.get_organization_branding_by_host(host_name text)
returns table (
  id uuid,
  organization_id uuid,
  brand_name text,
  app_name text,
  logo_url text,
  favicon_url text,
  login_background_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  background_color text,
  card_color text,
  sidebar_color text,
  topbar_color text,
  text_color text,
  muted_text_color text,
  border_color text,
  button_color text,
  button_text_color text,
  button_hover_color text,
  link_color text,
  link_hover_color text,
  input_focus_color text,
  company_slogan text,
  company_welcome_text text,
  dashboard_greeting_text text,
  custom_terminology jsonb,
  invitation_template text,
  onboarding_wording jsonb,
  custom_css jsonb,
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
  with host_org as (
    select *
    from public.get_organization_by_host(host_name)
    limit 1
  )
  select
    b.id,
    b.organization_id,
    b.brand_name,
    b.app_name,
    b.logo_url,
    b.favicon_url,
    b.login_background_url,
    coalesce(b.primary_color, '#000000'),
    coalesce(b.secondary_color, '#ffffff'),
    coalesce(b.accent_color, '#f97316'),
    b.background_color,
    b.card_color,
    b.sidebar_color,
    b.topbar_color,
    b.text_color,
    b.muted_text_color,
    b.border_color,
    b.button_color,
    b.button_text_color,
    b.button_hover_color,
    b.link_color,
    b.link_hover_color,
    b.input_focus_color,
    b.company_slogan,
    b.company_welcome_text,
    b.dashboard_greeting_text,
    b.custom_terminology,
    b.invitation_template,
    b.onboarding_wording,
    b.custom_css,
    b.custom_domain,
    b.subdomain,
    host_org.domain_status,
    null::text,
    b.dns_target,
    null::text,
    b.created_at,
    b.updated_at
  from public.organization_branding b
  join host_org on host_org.id = b.organization_id
  where coalesce(b.is_active, true) = true
  limit 1;
$$;

grant execute on function public.is_active_org_member(uuid) to authenticated;
grant execute on function public.is_active_org_admin(uuid) to authenticated;
grant execute on function public.safe_profile_role(uuid, text) to authenticated;
grant execute on function public.my_profile_locked_fields() to authenticated;
grant execute on function public.get_organization_by_host(text) to anon, authenticated;
grant execute on function public.get_my_active_memberships() to authenticated;
grant execute on function public.get_my_current_organization() to authenticated;
grant execute on function public.ensure_current_user_profile(text) to authenticated;
grant execute on function public.maybe_accept_invitation_for_current_user(uuid, text) to authenticated;
grant execute on function public.get_organization_branding_by_host(text) to anon, authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.company_offices enable row level security;
alter table public.organization_features enable row level security;
alter table public.organization_branding enable row level security;
alter table public.organization_roles enable row level security;
alter table public.organization_domains enable row level security;
alter table public.platform_audit_logs enable row level security;

create table if not exists public.organization_signup_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_key text not null,
  role_label text not null,
  is_default_signup_role boolean not null default false,
  requires_approval boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, role_key)
);

alter table public.organization_signup_roles enable row level security;

drop policy if exists "organizations_member_select" on public.organizations;
create policy "organizations_member_select"
on public.organizations for select to authenticated
using (public.is_org_member(id));

drop policy if exists "organizations_platform_manage" on public.organizations;
create policy "organizations_platform_manage"
on public.organizations for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "profiles_select_membership_safe" on public.profiles;
create policy "profiles_select_membership_safe"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members viewer
    join public.organization_members target on target.organization_id = viewer.organization_id
    where viewer.user_id = auth.uid()
      and target.user_id = profiles.id
      and viewer.status::text = 'active'
      and target.status::text = 'active'
  )
  or exists (
    select 1
    from public.organization_members target
    where target.user_id = profiles.id
      and public.is_active_org_admin(target.organization_id)
  )
);

drop policy if exists "profiles_insert_self_pending_safe" on public.profiles;
create policy "profiles_insert_self_pending_safe"
on public.profiles for insert to authenticated
with check (
  id = auth.uid()
  and coalesce(primary_role::text, 'user') = 'user'
  and organization_id is null
  and coalesce(account_status, 'pending_approval') in ('pending', 'pending_approval')
);

drop policy if exists "profiles_update_self_limited_safe" on public.profiles;
create policy "profiles_update_self_limited_safe"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and organization_id is not distinct from (
    select locked.organization_id from public.my_profile_locked_fields() locked
  )
  and primary_role::text is not distinct from (
    select locked.primary_role from public.my_profile_locked_fields() locked
  )
  and organization_role_key is not distinct from (
    select locked.organization_role_key from public.my_profile_locked_fields() locked
  )
  and account_status is not distinct from (
    select locked.account_status from public.my_profile_locked_fields() locked
  )
);

drop policy if exists "profiles_admin_update_members_safe" on public.profiles;
create policy "profiles_admin_update_members_safe"
on public.profiles for update to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members target
    where target.user_id = profiles.id
      and public.is_active_org_admin(target.organization_id)
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members target
    where target.user_id = profiles.id
      and public.is_active_org_admin(target.organization_id)
  )
);

drop policy if exists "organization_members_select_hardened" on public.organization_members;
create policy "organization_members_select_hardened"
on public.organization_members for select to authenticated
using (
  user_id = auth.uid()
  or public.is_active_org_admin(organization_id)
  or public.is_platform_admin()
);

drop policy if exists "organization_members_insert_admin_only_hardened" on public.organization_members;
create policy "organization_members_insert_admin_only_hardened"
on public.organization_members for insert to authenticated
with check (
  public.is_active_org_admin(organization_id)
  or public.is_platform_admin()
);

drop policy if exists "organization_members_update_admin_only_hardened" on public.organization_members;
create policy "organization_members_update_admin_only_hardened"
on public.organization_members for update to authenticated
using (
  public.is_active_org_admin(organization_id)
  or public.is_platform_admin()
)
with check (
  public.is_active_org_admin(organization_id)
  or public.is_platform_admin()
);

drop policy if exists "organization_members_delete_admin_only_hardened" on public.organization_members;
create policy "organization_members_delete_admin_only_hardened"
on public.organization_members for delete to authenticated
using (
  public.is_active_org_admin(organization_id)
  or public.is_platform_admin()
);

drop policy if exists "organization_invitations_invitee_read_safe" on public.organization_invitations;
create policy "organization_invitations_invitee_read_safe"
on public.organization_invitations for select to authenticated
using (
  lower(email) = lower(coalesce(auth.email(), ''))
  and status = 'pending'
  and (expires_at is null or expires_at > now())
);

drop policy if exists "organization_invitations_admin_manage_safe" on public.organization_invitations;
create policy "organization_invitations_admin_manage_safe"
on public.organization_invitations for all to authenticated
using (public.is_active_org_admin(organization_id) or public.is_platform_admin())
with check (public.is_active_org_admin(organization_id) or public.is_platform_admin());

drop policy if exists "organization_scoped_company_offices_read" on public.company_offices;
create policy "organization_scoped_company_offices_read"
on public.company_offices for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "organization_scoped_company_offices_admin" on public.company_offices;
create policy "organization_scoped_company_offices_admin"
on public.company_offices for all to authenticated
using (public.is_active_org_admin(organization_id) or public.is_platform_admin())
with check (public.is_active_org_admin(organization_id) or public.is_platform_admin());

drop policy if exists "organization_scoped_features_read" on public.organization_features;
create policy "organization_scoped_features_read"
on public.organization_features for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "organization_scoped_features_admin" on public.organization_features;
create policy "organization_scoped_features_admin"
on public.organization_features for all to authenticated
using (public.is_active_org_admin(organization_id) or public.is_platform_admin())
with check (public.is_active_org_admin(organization_id) or public.is_platform_admin());

drop policy if exists "organization_scoped_branding_read" on public.organization_branding;
create policy "organization_scoped_branding_read"
on public.organization_branding for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "organization_scoped_branding_admin" on public.organization_branding;
create policy "organization_scoped_branding_admin"
on public.organization_branding for all to authenticated
using (public.is_active_org_admin(organization_id) or public.is_platform_admin())
with check (public.is_active_org_admin(organization_id) or public.is_platform_admin());

drop policy if exists "organization_scoped_roles_read" on public.organization_roles;
create policy "organization_scoped_roles_read"
on public.organization_roles for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "organization_scoped_roles_admin" on public.organization_roles;
create policy "organization_scoped_roles_admin"
on public.organization_roles for all to authenticated
using (public.is_active_org_admin(organization_id) or public.is_platform_admin())
with check (public.is_active_org_admin(organization_id) or public.is_platform_admin());

drop policy if exists "organization_scoped_signup_roles_read" on public.organization_signup_roles;
create policy "organization_scoped_signup_roles_read"
on public.organization_signup_roles for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "organization_scoped_signup_roles_admin" on public.organization_signup_roles;
create policy "organization_scoped_signup_roles_admin"
on public.organization_signup_roles for all to authenticated
using (public.is_active_org_admin(organization_id) or public.is_platform_admin())
with check (public.is_active_org_admin(organization_id) or public.is_platform_admin());

drop policy if exists "organization_scoped_domains_admin" on public.organization_domains;
create policy "organization_scoped_domains_admin"
on public.organization_domains for all to authenticated
using (public.is_active_org_admin(organization_id) or public.is_platform_admin())
with check (public.is_active_org_admin(organization_id) or public.is_platform_admin());

drop policy if exists "platform_audit_logs_platform_read" on public.platform_audit_logs;
create policy "platform_audit_logs_platform_read"
on public.platform_audit_logs for select to authenticated
using (public.is_platform_admin());

drop policy if exists "platform_audit_logs_org_admin_read" on public.platform_audit_logs;
create policy "platform_audit_logs_org_admin_read"
on public.platform_audit_logs for select to authenticated
using (target_organization_id is not null and public.is_active_org_admin(target_organization_id));

drop policy if exists "platform_audit_logs_platform_insert" on public.platform_audit_logs;
create policy "platform_audit_logs_platform_insert"
on public.platform_audit_logs for insert to authenticated
with check (
  public.is_platform_admin()
  or (target_organization_id is not null and public.is_active_org_admin(target_organization_id))
);

do $$
declare
  scoped_table_name text;
  read_policy text;
  write_policy text;
begin
  foreach scoped_table_name in array array[
    'boards',
    'tasks',
    'chats',
    'messages',
    'meetings',
    'leave_requests',
    'duty_rosters',
    'duty_definitions',
    'duty_roster_members',
    'duty_roster_duties',
    'assets',
    'clients',
    'campaigns',
    'projects',
    'time_entries',
    'attendance_sessions',
    'attendance_breaks',
    'attendance_settings',
    'attendance_daily_status',
    'notifications',
    'notification_deliveries',
    'automation_flows',
    'automation_runs',
    'ai_conversations',
    'ai_messages',
    'ai_actions',
    'ai_audit_logs',
    'content_review_drafts',
    'content_review_assets',
    'fleet_daily_summaries',
    'fleet_import_batches',
    'fleet_import_rows'
  ]
  loop
    if to_regclass('public.' || scoped_table_name) is not null
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = scoped_table_name
           and column_name = 'organization_id'
       ) then
      execute format('alter table public.%I enable row level security', scoped_table_name);
      read_policy := scoped_table_name || '_org_member_read_hardened';
      write_policy := scoped_table_name || '_org_member_write_hardened';
      execute format('drop policy if exists %I on public.%I', read_policy, scoped_table_name);
      execute format('drop policy if exists %I on public.%I', write_policy, scoped_table_name);
      execute format(
        'create policy %I on public.%I for select to authenticated using (public.is_org_member(organization_id))',
        read_policy,
        scoped_table_name
      );
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id))',
        write_policy,
        scoped_table_name
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
