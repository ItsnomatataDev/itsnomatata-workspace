create extension if not exists pgcrypto with schema extensions;

create table if not exists public.content_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  office_id uuid not null references public.company_offices(id) on delete restrict,
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  portal_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  login_pin_hash text not null,
  pin_last_generated_at timestamptz not null default now(),
  pin_expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_review_drafts
  add column if not exists client_id uuid references public.content_clients(id) on delete set null,
  add column if not exists slug text,
  add column if not exists media_asset_ids uuid[] not null default '{}'::uuid[],
  add column if not exists review_status text;

alter table public.content_review_comments
  add column if not exists client_id uuid references public.content_clients(id) on delete set null,
  add column if not exists comment text;

alter table public.content_review_activity
  add column if not exists client_id uuid references public.content_clients(id) on delete set null,
  add column if not exists actor_type text,
  add column if not exists action text;

update public.content_review_drafts
set review_status = status
where review_status is null;

update public.content_review_comments
set comment = body
where comment is null;

update public.content_review_activity
set action = activity_type,
    actor_type = case when actor_user_id is null then 'client' else 'internal' end
where action is null or actor_type is null;

create index if not exists content_clients_org_office_idx
  on public.content_clients (organization_id, office_id, created_at desc);

create index if not exists content_clients_portal_token_idx
  on public.content_clients (portal_token);

create unique index if not exists content_clients_org_email_idx
  on public.content_clients (organization_id, lower(email));

create index if not exists content_review_drafts_client_idx
  on public.content_review_drafts (client_id, status, scheduled_at desc);

create or replace function public.set_content_clients_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists content_clients_set_updated_at on public.content_clients;
create trigger content_clients_set_updated_at
before update on public.content_clients
for each row
execute function public.set_content_clients_updated_at();

create or replace function public.content_client_pin_hash(client_token text, raw_pin text)
returns text
language sql
security definer
set search_path = public
immutable
as $$
  select encode(extensions.digest(coalesce(client_token, '') || ':' || coalesce(raw_pin, ''), 'sha256'::text), 'hex');
$$;

create or replace function public.content_client_session_hash(client_record public.content_clients, login_email text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select encode(extensions.digest(client_record.portal_token || ':' || lower(coalesce(login_email, '')) || ':' || client_record.login_pin_hash, 'sha256'::text), 'hex');
$$;

create or replace function public.generate_content_client_pin()
returns text
language sql
security definer
set search_path = public
volatile
as $$
  select lpad((floor(random() * 1000000))::int::text, 6, '0');
$$;

alter table public.content_clients enable row level security;

drop policy if exists "content_clients_internal_read" on public.content_clients;
create policy "content_clients_internal_read"
on public.content_clients for select
to authenticated
using (public.can_manage_content_review(organization_id, office_id));

drop policy if exists "content_clients_internal_manage" on public.content_clients;
create policy "content_clients_internal_manage"
on public.content_clients for all
to authenticated
using (public.can_manage_content_review(organization_id, office_id))
with check (public.can_manage_content_review(organization_id, office_id));

create or replace function public.create_content_client(
  target_organization_id uuid,
  target_office_id uuid,
  target_company_name text,
  target_contact_name text,
  target_email text,
  target_phone text default null,
  target_pin_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_pin text;
  token text;
  client_record public.content_clients%rowtype;
begin
  if not public.can_manage_content_review(target_organization_id, target_office_id) then
    raise exception 'not allowed';
  end if;

  raw_pin := public.generate_content_client_pin();
  token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.content_clients (
    organization_id,
    office_id,
    company_name,
    contact_name,
    email,
    phone,
    portal_token,
    login_pin_hash,
    pin_last_generated_at,
    pin_expires_at,
    created_by
  )
  values (
    target_organization_id,
    target_office_id,
    trim(target_company_name),
    trim(target_contact_name),
    lower(trim(target_email)),
    nullif(trim(target_phone), ''),
    token,
    public.content_client_pin_hash(token, raw_pin),
    now(),
    target_pin_expires_at,
    auth.uid()
  )
  returning * into client_record;

  return jsonb_build_object(
    'ok', true,
    'pin', raw_pin,
    'client', to_jsonb(client_record) - 'login_pin_hash'
  );
end;
$$;

create or replace function public.regenerate_content_client_pin(target_client_id uuid, target_pin_expires_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_pin text;
  client_record public.content_clients%rowtype;
begin
  select * into client_record
  from public.content_clients
  where id = target_client_id;

  if not found or not public.can_manage_content_review(client_record.organization_id, client_record.office_id) then
    raise exception 'not allowed';
  end if;

  raw_pin := public.generate_content_client_pin();

  update public.content_clients
  set login_pin_hash = public.content_client_pin_hash(portal_token, raw_pin),
      pin_last_generated_at = now(),
      pin_expires_at = target_pin_expires_at
  where id = target_client_id
  returning * into client_record;

  return jsonb_build_object(
    'ok', true,
    'pin', raw_pin,
    'client', to_jsonb(client_record) - 'login_pin_hash'
  );
end;
$$;

create or replace function public.login_content_client_portal(client_token text, login_email text, raw_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  client_record public.content_clients%rowtype;
begin
  select * into client_record
  from public.content_clients
  where portal_token = client_token
    and lower(email) = lower(trim(login_email))
    and is_active = true
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_login');
  end if;

  if client_record.pin_expires_at is not null and client_record.pin_expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'pin_expired');
  end if;

  if client_record.login_pin_hash <> public.content_client_pin_hash(client_record.portal_token, raw_pin) then
    return jsonb_build_object('ok', false, 'error', 'invalid_login');
  end if;

  return jsonb_build_object(
    'ok', true,
    'session_token', public.content_client_session_hash(client_record, login_email),
    'client', jsonb_build_object(
      'id', client_record.id,
      'company_name', client_record.company_name,
      'contact_name', client_record.contact_name,
      'email', client_record.email,
      'portal_token', client_record.portal_token
    )
  );
end;
$$;

create or replace function public.get_content_client_portal(client_token text, session_token text, login_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  client_record public.content_clients%rowtype;
begin
  select * into client_record
  from public.content_clients
  where portal_token = client_token
    and lower(email) = lower(trim(login_email))
    and is_active = true
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if session_token <> public.content_client_session_hash(client_record, login_email) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  return jsonb_build_object(
    'ok', true,
    'client', jsonb_build_object(
      'id', client_record.id,
      'company_name', client_record.company_name,
      'contact_name', client_record.contact_name,
      'email', client_record.email,
      'portal_token', client_record.portal_token
    ),
    'drafts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'title', d.title,
          'summary', d.summary,
          'status', d.status,
          'scheduled_at', d.scheduled_at,
          'last_viewed_at', d.last_viewed_at,
          'approved_at', d.approved_at,
          'thumbnail_url', (
            select a.file_url
            from public.content_review_assets a
            where a.draft_id = d.id
            order by a.sort_order, a.created_at
            limit 1
          )
        )
        order by d.scheduled_at desc nulls last, d.created_at desc
      )
      from public.content_review_drafts d
      where d.client_id = client_record.id
        and d.status not in ('draft')
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_content_client_review(
  client_token text,
  session_token text,
  login_email text,
  target_draft_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  client_record public.content_clients%rowtype;
  draft_record public.content_review_drafts%rowtype;
begin
  select * into client_record
  from public.content_clients
  where portal_token = client_token
    and lower(email) = lower(trim(login_email))
    and is_active = true
  limit 1;

  if not found or session_token <> public.content_client_session_hash(client_record, login_email) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select * into draft_record
  from public.content_review_drafts
  where id = target_draft_id
    and client_id = client_record.id
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  update public.content_review_drafts
  set status = case when status in ('sent_to_client', 'ready_for_review') then 'viewed' else status end,
      last_viewed_at = now()
  where id = draft_record.id;

  insert into public.content_review_activity (
    draft_id,
    organization_id,
    office_id,
    client_id,
    actor_type,
    actor_name,
    actor_email,
    activity_type,
    action,
    metadata
  )
  values (
    draft_record.id,
    draft_record.organization_id,
    draft_record.office_id,
    client_record.id,
    'client',
    client_record.contact_name,
    client_record.email,
    'client_viewed',
    'client_viewed',
    jsonb_build_object('portal', true)
  );

  return jsonb_build_object(
    'ok', true,
    'client', jsonb_build_object(
      'id', client_record.id,
      'company_name', client_record.company_name,
      'contact_name', client_record.contact_name,
      'email', client_record.email,
      'portal_token', client_record.portal_token
    ),
    'draft', to_jsonb(draft_record) - 'organization_id' - 'office_id' - 'created_by' - 'assigned_to',
    'assets', coalesce((
      select jsonb_agg(to_jsonb(a) - 'organization_id' - 'office_id' - 'uploaded_by' order by a.sort_order, a.created_at)
      from public.content_review_assets a
      where a.draft_id = draft_record.id
    ), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(to_jsonb(c) - 'organization_id' - 'office_id' - 'created_by' order by c.created_at)
      from public.content_review_comments c
      where c.draft_id = draft_record.id
        and c.client_id = client_record.id
        and c.visibility = 'client_visible'
        and c.author_type = 'client'
        and lower(coalesce(c.author_email, '')) = lower(client_record.email)
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.submit_content_client_review_feedback(
  client_token text,
  session_token text,
  login_email text,
  target_draft_id uuid,
  feedback_body text,
  decision text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  client_record public.content_clients%rowtype;
  draft_record public.content_review_drafts%rowtype;
  next_status text;
  activity text;
  next_comment_type text;
begin
  select * into client_record
  from public.content_clients
  where portal_token = client_token
    and lower(email) = lower(trim(login_email))
    and is_active = true
  limit 1;

  if not found or session_token <> public.content_client_session_hash(client_record, login_email) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select * into draft_record
  from public.content_review_drafts
  where id = target_draft_id
    and client_id = client_record.id
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if draft_record.status in ('approved', 'archived', 'published') then
    return jsonb_build_object('ok', false, 'error', 'read_only');
  end if;

  if decision = 'approved' then
    next_status := 'approved';
    activity := 'client_approved';
    next_comment_type := 'approval_note';
  elsif decision = 'changes_requested' then
    next_status := 'changes_requested';
    activity := 'client_requested_changes';
    next_comment_type := 'change_request';
  elsif decision = 'comment' then
    next_status := draft_record.status;
    activity := 'client_commented';
    next_comment_type := 'client_comment';
  else
    return jsonb_build_object('ok', false, 'error', 'invalid_decision');
  end if;

  if coalesce(trim(feedback_body), '') <> '' then
    insert into public.content_review_comments (
      draft_id,
      organization_id,
      office_id,
      client_id,
      author_name,
      author_email,
      author_company,
      body,
      comment,
      source,
      client_visible,
      visibility,
      author_type,
      comment_type
    )
    values (
      draft_record.id,
      draft_record.organization_id,
      draft_record.office_id,
      client_record.id,
      client_record.contact_name,
      client_record.email,
      client_record.company_name,
      trim(feedback_body),
      trim(feedback_body),
      'client',
      true,
      'client_visible',
      'client',
      next_comment_type
    );
  end if;

  update public.content_review_drafts
  set status = next_status,
      review_status = next_status,
      approved_at = case when decision = 'approved' then now() else approved_at end,
      approved_by_name = case when decision = 'approved' then client_record.contact_name else approved_by_name end,
      approved_by_email = case when decision = 'approved' then client_record.email else approved_by_email end,
      changes_requested_at = case when decision = 'changes_requested' then now() else changes_requested_at end
  where id = draft_record.id;

  insert into public.content_review_activity (
    draft_id,
    organization_id,
    office_id,
    client_id,
    actor_type,
    actor_name,
    actor_email,
    activity_type,
    action,
    metadata
  )
  values (
    draft_record.id,
    draft_record.organization_id,
    draft_record.office_id,
    client_record.id,
    'client',
    client_record.contact_name,
    client_record.email,
    activity,
    activity,
    jsonb_build_object('decision', decision, 'portal', true)
  );

  return jsonb_build_object('ok', true, 'status', next_status);
end;
$$;

grant execute on function public.create_content_client(uuid, uuid, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.regenerate_content_client_pin(uuid, timestamptz) to authenticated;
grant execute on function public.login_content_client_portal(text, text, text) to anon, authenticated;
grant execute on function public.get_content_client_portal(text, text, text) to anon, authenticated;
grant execute on function public.get_content_client_review(text, text, text, uuid) to anon, authenticated;
grant execute on function public.submit_content_client_review_feedback(text, text, text, uuid, text, text) to anon, authenticated;
