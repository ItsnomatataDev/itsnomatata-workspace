create table if not exists public.content_review_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  office_id uuid not null references public.company_offices(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text not null,
  subtitle text,
  body text,
  summary text,
  captions text,
  notes text,
  layout_type text not null default 'article',
  cta_label text,
  cta_url text,
  review_token text not null unique,
  review_url text,
  status text not null default 'draft',
  scheduled_at timestamptz,
  expires_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  approved_by_email text,
  changes_requested_at timestamptz,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_review_drafts_status_check check (
    status in (
      'draft',
      'ready_for_review',
      'sent_to_client',
      'viewed',
      'changes_requested',
      'approved',
      'published',
      'archived'
    )
  ),
  constraint content_review_drafts_layout_check check (
    layout_type in (
      'split_media_text',
      'article',
      'gallery',
      'event_announcement',
      'campaign_preview',
      'testimonial',
      'media_showcase'
    )
  )
);

create table if not exists public.content_review_assets (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.content_review_drafts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  office_id uuid not null references public.company_offices(id) on delete restrict,
  uploaded_by uuid references public.profiles(id) on delete set null,
  file_name text not null,
  file_url text not null,
  storage_path text,
  mime_type text,
  asset_type text not null default 'image',
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.content_review_comments (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.content_review_drafts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  office_id uuid not null references public.company_offices(id) on delete restrict,
  author_name text not null,
  author_email text,
  author_company text,
  body text not null,
  source text not null default 'client',
  client_visible boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.content_review_activity (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.content_review_drafts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  office_id uuid not null references public.company_offices(id) on delete restrict,
  actor_name text,
  actor_email text,
  actor_user_id uuid references public.profiles(id) on delete set null,
  activity_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists content_review_drafts_org_office_status_idx
  on public.content_review_drafts (organization_id, office_id, status, created_at desc);

create index if not exists content_review_drafts_token_idx
  on public.content_review_drafts (review_token);

create index if not exists content_review_assets_draft_idx
  on public.content_review_assets (draft_id, sort_order, created_at);

create index if not exists content_review_comments_draft_idx
  on public.content_review_comments (draft_id, created_at);

create index if not exists content_review_activity_draft_idx
  on public.content_review_activity (draft_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-review-assets',
  'content-review-assets',
  true,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do nothing;

create or replace function public.is_its_no_matata_office(target_office_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.company_offices co
    where co.id = target_office_id
      and co.slug = 'its-no-matata'
  );
$$;

create or replace function public.can_manage_content_review(target_organization_id uuid, target_office_id uuid)
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
      and p.primary_role::text in ('admin', 'social_media', 'media_team')
      and p.office_id = target_office_id
      and public.is_its_no_matata_office(target_office_id)
  );
$$;

grant execute on function public.is_its_no_matata_office(uuid) to authenticated, anon;
grant execute on function public.can_manage_content_review(uuid, uuid) to authenticated;

create or replace function public.set_content_review_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists content_review_drafts_set_updated_at on public.content_review_drafts;
create trigger content_review_drafts_set_updated_at
before update on public.content_review_drafts
for each row
execute function public.set_content_review_updated_at();

alter table public.content_review_drafts enable row level security;
alter table public.content_review_assets enable row level security;
alter table public.content_review_comments enable row level security;
alter table public.content_review_activity enable row level security;

drop policy if exists "content_review_drafts_internal_read" on public.content_review_drafts;
create policy "content_review_drafts_internal_read"
on public.content_review_drafts for select
to authenticated
using (public.can_manage_content_review(organization_id, office_id));

drop policy if exists "content_review_drafts_internal_manage" on public.content_review_drafts;
create policy "content_review_drafts_internal_manage"
on public.content_review_drafts for all
to authenticated
using (public.can_manage_content_review(organization_id, office_id))
with check (public.can_manage_content_review(organization_id, office_id));

drop policy if exists "content_review_assets_internal_read" on public.content_review_assets;
create policy "content_review_assets_internal_read"
on public.content_review_assets for select
to authenticated
using (public.can_manage_content_review(organization_id, office_id));

drop policy if exists "content_review_assets_internal_manage" on public.content_review_assets;
create policy "content_review_assets_internal_manage"
on public.content_review_assets for all
to authenticated
using (public.can_manage_content_review(organization_id, office_id))
with check (public.can_manage_content_review(organization_id, office_id));

drop policy if exists "content_review_comments_internal_read" on public.content_review_comments;
create policy "content_review_comments_internal_read"
on public.content_review_comments for select
to authenticated
using (public.can_manage_content_review(organization_id, office_id));

drop policy if exists "content_review_comments_internal_manage" on public.content_review_comments;
create policy "content_review_comments_internal_manage"
on public.content_review_comments for all
to authenticated
using (public.can_manage_content_review(organization_id, office_id))
with check (public.can_manage_content_review(organization_id, office_id));

drop policy if exists "content_review_activity_internal_read" on public.content_review_activity;
create policy "content_review_activity_internal_read"
on public.content_review_activity for select
to authenticated
using (public.can_manage_content_review(organization_id, office_id));

drop policy if exists "content_review_activity_internal_insert" on public.content_review_activity;
create policy "content_review_activity_internal_insert"
on public.content_review_activity for insert
to authenticated
with check (public.can_manage_content_review(organization_id, office_id));

drop policy if exists "content_review_assets_upload" on storage.objects;
create policy "content_review_assets_upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'content-review-assets');

drop policy if exists "content_review_assets_read" on storage.objects;
create policy "content_review_assets_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'content-review-assets');

create or replace function public.get_content_review_by_token(target_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  draft_record public.content_review_drafts%rowtype;
  result jsonb;
begin
  select *
  into draft_record
  from public.content_review_drafts d
  where d.review_token = target_token
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if draft_record.expires_at is not null and draft_record.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if draft_record.status not in ('approved', 'archived', 'published') then
    update public.content_review_drafts
    set status = case when status in ('sent_to_client', 'ready_for_review') then 'viewed' else status end,
        last_viewed_at = now()
    where id = draft_record.id;
  else
    update public.content_review_drafts
    set last_viewed_at = now()
    where id = draft_record.id;
  end if;

  insert into public.content_review_activity (
    draft_id,
    organization_id,
    office_id,
    activity_type,
    metadata
  )
  values (
    draft_record.id,
    draft_record.organization_id,
    draft_record.office_id,
    'client_viewed',
    jsonb_build_object('token', target_token)
  );

  begin
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
      dedupe_key,
      is_read,
      metadata
    )
    select
      draft_record.organization_id,
      p.id,
      'system_alert',
      'Client viewed review link',
      draft_record.title || ' was opened by a client.',
      'content_review_draft',
      draft_record.id,
      '/admin/content-studio/reviews',
      'medium',
      'content_review',
      'content-review-viewed:' || draft_record.id || ':' || p.id,
      false,
      jsonb_build_object('draftId', draft_record.id)
    from public.profiles p
    join public.company_offices co on co.id = p.office_id
    where p.organization_id = draft_record.organization_id
      and p.primary_role::text in ('admin', 'social_media', 'media_team')
      and co.slug = 'its-no-matata'
      and not exists (
        select 1
        from public.notifications n
        where n.user_id = p.id
          and n.dedupe_key = 'content-review-viewed:' || draft_record.id || ':' || p.id
      );
  exception when others then
    null;
  end;

  select jsonb_build_object(
    'ok', true,
    'draft', to_jsonb(d.*) - 'organization_id' - 'office_id' - 'created_by' - 'assigned_to',
    'assets', coalesce((
      select jsonb_agg(to_jsonb(a) - 'organization_id' - 'office_id' - 'uploaded_by' order by a.sort_order, a.created_at)
      from public.content_review_assets a
      where a.draft_id = d.id
    ), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(to_jsonb(c) - 'organization_id' - 'office_id' - 'created_by' order by c.created_at)
      from public.content_review_comments c
      where c.draft_id = d.id
        and c.client_visible = true
    ), '[]'::jsonb)
  )
  into result
  from public.content_review_drafts d
  where d.id = draft_record.id;

  return result;
end;
$$;

create or replace function public.submit_content_review_feedback(
  target_token text,
  client_name text,
  client_email text,
  client_company text,
  feedback_body text,
  decision text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  draft_record public.content_review_drafts%rowtype;
  next_status text;
  activity text;
begin
  select *
  into draft_record
  from public.content_review_drafts d
  where d.review_token = target_token
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if draft_record.expires_at is not null and draft_record.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if draft_record.status in ('approved', 'archived', 'published') then
    return jsonb_build_object('ok', false, 'error', 'read_only');
  end if;

  if decision = 'approved' then
    next_status := 'approved';
    activity := 'client_approved';
  elsif decision = 'changes_requested' then
    next_status := 'changes_requested';
    activity := 'client_requested_changes';
  elsif decision = 'comment' then
    next_status := draft_record.status;
    activity := 'client_commented';
  else
    return jsonb_build_object('ok', false, 'error', 'invalid_decision');
  end if;

  if coalesce(trim(feedback_body), '') <> '' then
    insert into public.content_review_comments (
      draft_id,
      organization_id,
      office_id,
      author_name,
      author_email,
      author_company,
      body,
      source,
      client_visible
    )
    values (
      draft_record.id,
      draft_record.organization_id,
      draft_record.office_id,
      coalesce(nullif(trim(client_name), ''), 'Client'),
      nullif(trim(client_email), ''),
      nullif(trim(client_company), ''),
      trim(feedback_body),
      'client',
      true
    );
  end if;

  update public.content_review_drafts
  set status = next_status,
      approved_at = case when decision = 'approved' then now() else approved_at end,
      approved_by_name = case when decision = 'approved' then nullif(trim(client_name), '') else approved_by_name end,
      approved_by_email = case when decision = 'approved' then nullif(trim(client_email), '') else approved_by_email end,
      changes_requested_at = case when decision = 'changes_requested' then now() else changes_requested_at end
  where id = draft_record.id;

  insert into public.content_review_activity (
    draft_id,
    organization_id,
    office_id,
    actor_name,
    actor_email,
    activity_type,
    metadata
  )
  values (
    draft_record.id,
    draft_record.organization_id,
    draft_record.office_id,
    nullif(trim(client_name), ''),
    nullif(trim(client_email), ''),
    activity,
    jsonb_build_object('decision', decision, 'company', nullif(trim(client_company), ''))
  );

  begin
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
      dedupe_key,
      is_read,
      metadata
    )
    select
      draft_record.organization_id,
      p.id,
      'system_alert',
      case
        when decision = 'approved' then 'Client approved content'
        when decision = 'changes_requested' then 'Client requested changes'
        else 'Client commented on content'
      end,
      coalesce(nullif(trim(client_name), ''), 'A client') || ' responded to ' || draft_record.title || '.',
      'content_review_draft',
      draft_record.id,
      '/admin/content-studio/reviews',
      case when decision in ('approved', 'changes_requested') then 'high' else 'medium' end,
      'content_review',
      'content-review-feedback:' || draft_record.id || ':' || activity || ':' || p.id || ':' || extract(epoch from now())::text,
      false,
      jsonb_build_object('draftId', draft_record.id, 'decision', decision)
    from public.profiles p
    join public.company_offices co on co.id = p.office_id
    where p.organization_id = draft_record.organization_id
      and p.primary_role::text in ('admin', 'social_media', 'media_team')
      and co.slug = 'its-no-matata';
  exception when others then
    null;
  end;

  return jsonb_build_object('ok', true, 'status', next_status);
end;
$$;

grant execute on function public.get_content_review_by_token(text) to anon, authenticated;
grant execute on function public.submit_content_review_feedback(text, text, text, text, text, text) to anon, authenticated;
