create extension if not exists pgcrypto;

create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email text,
  role text not null default 'platform_admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_admins
  add column if not exists user_id uuid references public.profiles(id) on delete set null,
  add column if not exists email text,
  add column if not exists role text not null default 'platform_admin',
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.platform_admins pa
set email = p.email
from public.profiles p
where pa.user_id = p.id
  and (pa.email is null or btrim(pa.email) = '')
  and p.email is not null;

create unique index if not exists platform_admins_email_unique
  on public.platform_admins (lower(email))
  where email is not null and btrim(email) <> '';

do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'is_platform_admin',
        'is_platform_owner_or_admin',
        'get_platform_access_status'
      )
      and pg_get_function_identity_arguments(p.oid) <> ''
  loop
    execute format('drop function if exists %s cascade', fn);
  end loop;
end $$;

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
    left join public.profiles p on p.id = auth.uid()
    where pa.is_active = true
      and (
        pa.user_id = auth.uid()
        or lower(btrim(coalesce(pa.email, ''))) = lower(btrim(coalesce(auth.email(), '')))
        or lower(btrim(coalesce(pa.email, ''))) = lower(btrim(coalesce(p.email, '')))
      )
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
    left join public.profiles p on p.id = auth.uid()
    where pa.is_active = true
      and pa.role in ('platform_owner', 'platform_admin')
      and (
        pa.user_id = auth.uid()
        or lower(btrim(coalesce(pa.email, ''))) = lower(btrim(coalesce(auth.email(), '')))
        or lower(btrim(coalesce(pa.email, ''))) = lower(btrim(coalesce(p.email, '')))
      )
  );
$$;

create or replace function public.get_platform_access_status()
returns table (
  auth_user_id uuid,
  auth_email text,
  profile_email text,
  profile_role text,
  profile_organization_id uuid,
  platform_role text,
  platform_is_active boolean,
  is_platform_admin boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    auth.uid() as auth_user_id,
    auth.email() as auth_email,
    p.email as profile_email,
    p.primary_role::text as profile_role,
    p.organization_id as profile_organization_id,
    pa.role as platform_role,
    pa.is_active as platform_is_active,
    public.is_platform_admin() as is_platform_admin
  from (select 1) seed
  left join public.profiles p on p.id = auth.uid()
  left join public.platform_admins pa
    on pa.user_id = auth.uid()
    or lower(btrim(coalesce(pa.email, ''))) = lower(btrim(coalesce(auth.email(), '')))
    or lower(btrim(coalesce(pa.email, ''))) = lower(btrim(coalesce(p.email, '')))
  limit 1;
$$;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_platform_owner_or_admin() to authenticated;
grant execute on function public.get_platform_access_status() to authenticated;

alter table public.organization_features enable row level security;

drop policy if exists "platform_admins_manage_org_features" on public.organization_features;
create policy "platform_admins_manage_org_features"
on public.organization_features
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "org_members_read_own_features" on public.organization_features;
create policy "org_members_read_own_features"
on public.organization_features
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "org_admins_manage_own_features" on public.organization_features;
create policy "org_admins_manage_own_features"
on public.organization_features
for all
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

alter table public.organization_invitations enable row level security;

drop policy if exists "platform_admins_manage_invitations" on public.organization_invitations;
create policy "platform_admins_manage_invitations"
on public.organization_invitations
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "org_admins_manage_own_invitations" on public.organization_invitations;
create policy "org_admins_manage_own_invitations"
on public.organization_invitations
for all
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

drop policy if exists "invitees_read_own_pending_org_invitations" on public.organization_invitations;
create policy "invitees_read_own_pending_org_invitations"
on public.organization_invitations
for select
to authenticated
using (
  lower(email) = lower(coalesce(auth.email(), ''))
  and status in ('pending', 'accepted')
);

do $$
begin
  if to_regclass('public.organization_audit_logs') is null then
    create table public.organization_audit_logs (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid references public.organizations(id) on delete cascade,
      actor_user_id uuid references public.profiles(id) on delete set null,
      action text not null,
      entity_type text,
      entity_id uuid,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  end if;
end $$;

create table if not exists public.organization_domain_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  domain_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.organization_branding
  add column if not exists app_name text,
  add column if not exists background_color text not null default '#020202',
  add column if not exists card_color text not null default '#070707',
  add column if not exists sidebar_color text not null default '#020202',
  add column if not exists topbar_color text not null default '#020202',
  add column if not exists text_color text not null default '#ffffff',
  add column if not exists muted_text_color text not null default '#a3a3a3',
  add column if not exists border_color text not null default '#1f1f1f',
  add column if not exists button_color text not null default '#f97316',
  add column if not exists button_text_color text not null default '#ffffff',
  add column if not exists button_hover_color text not null default '#ea580c',
  add column if not exists link_color text not null default '#fb923c',
  add column if not exists link_hover_color text not null default '#fdba74',
  add column if not exists input_focus_color text not null default '#f97316',
  add column if not exists custom_css jsonb not null default '{}'::jsonb,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

update public.organization_branding
set
  app_name = coalesce(app_name, brand_name),
  background_color = coalesce(nullif(background_color, ''), '#020202'),
  card_color = coalesce(nullif(card_color, ''), '#070707'),
  sidebar_color = coalesce(nullif(sidebar_color, ''), '#020202'),
  topbar_color = coalesce(nullif(topbar_color, ''), '#020202'),
  text_color = coalesce(nullif(text_color, ''), '#ffffff'),
  muted_text_color = coalesce(nullif(muted_text_color, ''), '#a3a3a3'),
  border_color = coalesce(nullif(border_color, ''), '#1f1f1f'),
  button_color = coalesce(nullif(button_color, ''), coalesce(accent_color, '#f97316')),
  button_text_color = coalesce(nullif(button_text_color, ''), '#ffffff'),
  button_hover_color = coalesce(nullif(button_hover_color, ''), '#ea580c'),
  link_color = coalesce(nullif(link_color, ''), '#fb923c'),
  link_hover_color = coalesce(nullif(link_hover_color, ''), '#fdba74'),
  input_focus_color = coalesce(nullif(input_focus_color, ''), coalesce(accent_color, '#f97316'))
where true;

do $$
declare
  col text;
begin
  foreach col in array array[
    'primary_color',
    'secondary_color',
    'accent_color',
    'background_color',
    'card_color',
    'sidebar_color',
    'topbar_color',
    'text_color',
    'muted_text_color',
    'border_color',
    'button_color',
    'button_text_color',
    'button_hover_color',
    'link_color',
    'link_hover_color',
    'input_focus_color'
  ]
  loop
    execute format(
      'update public.organization_branding set %I = ''#f97316'' where %I is null or %I !~* ''^#[0-9a-f]{6}$''',
      col,
      col,
      col
    );
  end loop;
end $$;

alter table public.organization_branding
  drop constraint if exists organization_branding_color_hex_check;

alter table public.organization_branding
  add constraint organization_branding_color_hex_check
  check (
    coalesce(primary_color, '#000000') ~* '^#[0-9a-f]{6}$'
    and coalesce(secondary_color, '#ffffff') ~* '^#[0-9a-f]{6}$'
    and coalesce(accent_color, '#f97316') ~* '^#[0-9a-f]{6}$'
    and background_color ~* '^#[0-9a-f]{6}$'
    and card_color ~* '^#[0-9a-f]{6}$'
    and sidebar_color ~* '^#[0-9a-f]{6}$'
    and topbar_color ~* '^#[0-9a-f]{6}$'
    and text_color ~* '^#[0-9a-f]{6}$'
    and muted_text_color ~* '^#[0-9a-f]{6}$'
    and border_color ~* '^#[0-9a-f]{6}$'
    and button_color ~* '^#[0-9a-f]{6}$'
    and button_text_color ~* '^#[0-9a-f]{6}$'
    and button_hover_color ~* '^#[0-9a-f]{6}$'
    and link_color ~* '^#[0-9a-f]{6}$'
    and link_hover_color ~* '^#[0-9a-f]{6}$'
    and input_focus_color ~* '^#[0-9a-f]{6}$'
  );

create table if not exists public.organization_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain text not null,
  domain_type text not null default 'subdomain',
  status text not null default 'pending',
  cname_host text not null,
  cname_fqdn text,
  cname_target text not null default 'cname.vercel-dns.com',
  txt_host text not null,
  txt_fqdn text,
  txt_value text not null default encode(gen_random_bytes(24), 'hex'),
  verified_at timestamptz,
  connected_at timestamptz,
  last_checked_at timestamptz,
  last_error text,
  ssl_status text not null default 'pending',
  provider text not null default 'vercel',
  provider_domain_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_domains_type_check
    check (domain_type in ('subdomain', 'custom_domain')),
  constraint organization_domains_status_check
    check (status in ('pending', 'dns_pending', 'verified', 'connected', 'failed', 'disabled')),
  constraint organization_domains_ssl_status_check
    check (ssl_status in ('pending', 'issuing', 'active', 'failed')),
  constraint organization_domains_hostname_check
    check (
      domain = lower(domain)
      and domain !~ 'https?://'
      and domain !~ '/'
      and domain !~ '\s'
      and domain !~ '^\*\.'
      and domain not in ('localhost', '127.0.0.1', '::1')
      and domain !~ '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'
      and domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
    )
);

alter table public.organization_domains
  add column if not exists cname_fqdn text,
  add column if not exists txt_fqdn text;

update public.organization_domains
set
  cname_fqdn = coalesce(nullif(cname_fqdn, ''), domain),
  txt_fqdn = coalesce(nullif(txt_fqdn, ''), '_itsnomatata-verify.' || domain)
where cname_fqdn is null
  or cname_fqdn = ''
  or txt_fqdn is null
  or txt_fqdn = '';

create unique index if not exists organization_domains_domain_unique
  on public.organization_domains (domain);

create unique index if not exists organization_domains_org_domain_unique
  on public.organization_domains (organization_id, domain);

create index if not exists organization_domains_org_status_idx
  on public.organization_domains (organization_id, status);

create or replace function public.set_organization_domains_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organization_domains_set_updated_at on public.organization_domains;
create trigger organization_domains_set_updated_at
before update on public.organization_domains
for each row
execute function public.set_organization_domains_updated_at();

create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

alter table public.organization_domains enable row level security;
alter table public.organization_domain_audit_logs enable row level security;

drop policy if exists "platform_admins_manage_organization_domains" on public.organization_domains;
create policy "platform_admins_manage_organization_domains"
on public.organization_domains
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "org_admins_manage_own_organization_domains" on public.organization_domains;
create policy "org_admins_manage_own_organization_domains"
on public.organization_domains
for all
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

drop policy if exists "platform_admins_read_organization_domain_audit_logs" on public.organization_domain_audit_logs;
create policy "platform_admins_read_organization_domain_audit_logs"
on public.organization_domain_audit_logs
for select
to authenticated
using (public.is_platform_admin());

drop policy if exists "org_admins_read_own_organization_domain_audit_logs" on public.organization_domain_audit_logs;
create policy "org_admins_read_own_organization_domain_audit_logs"
on public.organization_domain_audit_logs
for select
to authenticated
using (public.is_org_admin(organization_id));

drop policy if exists "org_admins_insert_own_organization_domain_audit_logs" on public.organization_domain_audit_logs;
create policy "org_admins_insert_own_organization_domain_audit_logs"
on public.organization_domain_audit_logs
for insert
to authenticated
with check (public.is_org_admin(organization_id));

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
  with normalized as (
    select lower(split_part(btrim(host_name), ':', 1)) as host
  ),
  domain_match as (
    select od.organization_id, od.domain, od.status
    from public.organization_domains od
    cross join normalized n
    where od.domain = n.host
      and od.status in ('verified', 'connected')
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
    coalesce(dm.status, b.domain_status),
    null::text as domain_verification_token,
    b.dns_target,
    null::text as domain_error,
    b.created_at,
    b.updated_at
  from public.organization_branding b
  join public.organizations o on o.id = b.organization_id
  cross join normalized n
  left join domain_match dm on dm.organization_id = b.organization_id
  where coalesce(o.status, 'active') = 'active'
    and coalesce(o.access_status, 'active') not in ('suspended', 'cancelled')
    and coalesce(b.is_active, true) = true
    and (
      dm.organization_id is not null
      or lower(coalesce(b.custom_domain, '')) = n.host
      or lower(coalesce(b.subdomain, '')) = replace(n.host, '.itsnomatata.com', '')
    )
  limit 1;
$$;

grant execute on function public.get_organization_branding_by_host(text) to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('organization-branding', 'organization-branding', true)
on conflict (id) do nothing;

drop policy if exists "organization_branding_assets_read" on storage.objects;
create policy "organization_branding_assets_read"
on storage.objects
for select
to public
using (bucket_id = 'organization-branding');

drop policy if exists "organization_branding_assets_write" on storage.objects;
create policy "organization_branding_assets_write"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'organization-branding'
  and public.is_org_admin(public.try_uuid((storage.foldername(name))[1]))
)
with check (
  bucket_id = 'organization-branding'
  and public.is_org_admin(public.try_uuid((storage.foldername(name))[1]))
);

notify pgrst, 'reload schema';
