alter table public.content_review_assets
  add column if not exists is_selected boolean not null default true,
  add column if not exists heading text,
  add column if not exists crop_x numeric not null default 50,
  add column if not exists crop_y numeric not null default 50,
  add column if not exists crop_zoom numeric not null default 1;

create index if not exists content_review_assets_selected_idx
  on public.content_review_assets (draft_id, is_selected, sort_order, created_at);

create or replace function public.get_content_review_by_token(target_token text, viewer_email text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  draft_record public.content_review_drafts%rowtype;
  result jsonb;   
  normalized_email text;
begin
  normalized_email := lower(nullif(trim(coalesce(viewer_email, '')), ''));

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
        and a.is_selected = true
    ), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(to_jsonb(c) - 'organization_id' - 'office_id' - 'created_by' order by c.created_at)
      from public.content_review_comments c
      where c.draft_id = d.id
        and c.visibility = 'client_visible'
        and c.author_type = 'client'
        and normalized_email is not null
        and lower(coalesce(c.author_email, '')) = normalized_email
    ), '[]'::jsonb)
  )
  into result
  from public.content_review_drafts d
  where d.id = draft_record.id;

  return result;
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
        and a.is_selected = true
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

grant execute on function public.get_content_review_by_token(text, text) to anon, authenticated;
grant execute on function public.get_content_client_review(text, text, text, uuid) to anon, authenticated;
