alter table public.content_review_assets
  add column if not exists display_slot integer;

update public.content_review_assets
set display_slot = sort_order
where display_slot is null;

alter table public.content_review_assets
  alter column display_slot set not null;

alter table public.content_review_assets
  alter column display_slot set default 0;

create index if not exists content_review_assets_display_slot_idx
  on public.content_review_assets (draft_id, display_slot, sort_order, created_at);

create or replace function public.notify_content_review_staff(
  p_draft public.content_review_drafts,
  p_title text,
  p_message text,
  p_priority text default 'medium',
  p_dedupe_suffix text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
  select distinct
    p_draft.organization_id,
    recipient.user_id,
    'system_alert',
    p_title,
    p_message,
    'content_review_draft',
    p_draft.id,
    '/admin/content-studio/reviews',
    p_priority,
    'content_review',
  'content-review:' || p_draft.id || ':' || p_dedupe_suffix || ':' || recipient.user_id,
    false,
    jsonb_build_object('draftId', p_draft.id)
  from (
    select p_draft.created_by as user_id
    where p_draft.created_by is not null
    union
    select p_draft.assigned_to
    where p_draft.assigned_to is not null
    union
    select p.id
    from public.profiles p
    join public.company_offices co on co.id = p.office_id
    where p.organization_id = p_draft.organization_id
      and p.primary_role::text = 'admin'
      and co.slug = 'its-no-matata'
  ) recipient
  where recipient.user_id is not null;
exception
  when others then
    null;
end;
$$;


create or replace function public.purge_content_review_schedules(retention_days integer default 60)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  cutoff timestamptz := now() - make_interval(days => greatest(retention_days, 1));
  target_ids uuid[];
  deleted_count integer := 0;
begin
  select array_agg(d.id)
  into target_ids
  from public.content_review_drafts d
  where coalesce(d.scheduled_at, d.created_at) < cutoff;

  if target_ids is null or cardinality(target_ids) = 0 then
    return jsonb_build_object('ok', true, 'deleted', 0);
  end if;

  delete from storage.objects o
  using public.content_review_assets a
  where o.bucket_id = 'content-review-assets'
    and o.name = a.storage_path
    and a.draft_id = any(target_ids);

  delete from public.content_review_drafts
  where id = any(target_ids);

  get diagnostics deleted_count = row_count;

  return jsonb_build_object('ok', true, 'deleted', deleted_count);
end;
$$;

grant execute on function public.purge_content_review_schedules(integer) to authenticated;
grant execute on function public.notify_content_review_staff(public.content_review_drafts, text, text, text, text) to authenticated;

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
  has_approved boolean;
  has_commented boolean;
  has_requested_changes boolean;
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

  select exists (
    select 1
    from public.content_review_comments c
    where c.draft_id = draft_record.id
      and c.client_id = client_record.id
      and c.author_type = 'client'
      and c.comment_type = 'approval_note'
  ) into has_approved;

  select exists (
    select 1
    from public.content_review_comments c
    where c.draft_id = draft_record.id
      and c.client_id = client_record.id
      and c.author_type = 'client'
      and c.comment_type = 'client_comment'
  ) into has_commented;

  select exists (
    select 1
    from public.content_review_comments c
    where c.draft_id = draft_record.id
      and c.client_id = client_record.id
      and c.author_type = 'client'
      and c.comment_type = 'change_request'
  ) into has_requested_changes;

  if decision = 'approved' then
    if has_approved or draft_record.approved_at is not null then
      return jsonb_build_object('ok', false, 'error', 'already_approved');
    end if;
    next_status := 'approved';
    activity := 'client_approved';
    next_comment_type := 'approval_note';
  elsif decision = 'changes_requested' then
    if has_requested_changes or draft_record.changes_requested_at is not null then
      return jsonb_build_object('ok', false, 'error', 'already_requested_changes');
    end if;
    next_status := 'changes_requested';
    activity := 'client_requested_changes';
    next_comment_type := 'change_request';
  elsif decision = 'comment' then
    if has_commented then
      return jsonb_build_object('ok', false, 'error', 'already_commented');
    end if;
    if coalesce(trim(feedback_body), '') = '' then
      return jsonb_build_object('ok', false, 'error', 'comment_required');
    end if;
    next_status := draft_record.status;
    activity := 'client_commented';
    next_comment_type := 'client_comment';
  else
    return jsonb_build_object('ok', false, 'error', 'invalid_decision');
  end if;

  if decision in ('approved', 'changes_requested') and coalesce(trim(feedback_body), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'comment_required');
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

  select * into draft_record from public.content_review_drafts where id = target_draft_id;

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

  perform public.notify_content_review_staff(
    draft_record,
    case
      when decision = 'approved' then 'Client approved content'
      when decision = 'changes_requested' then 'Client requested changes'
      else 'Client commented on content'
    end,
    client_record.contact_name || ' responded to ' || draft_record.title || '.',
    case when decision in ('approved', 'changes_requested') then 'high' else 'medium' end,
    activity
  );

  return jsonb_build_object(
    'ok', true,
    'status', next_status,
    'feedback', jsonb_build_object(
      'has_approved', decision = 'approved' or has_approved,
      'has_commented', decision = 'comment' or has_commented,
      'has_requested_changes', decision = 'changes_requested' or has_requested_changes
    )
  );
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
  next_comment_type text;
  normalized_email text;
  has_approved boolean;
  has_commented boolean;
  has_requested_changes boolean;
begin
  normalized_email := lower(nullif(trim(coalesce(client_email, '')), ''));

  select * into draft_record
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

  select exists (
    select 1 from public.content_review_comments c
    where c.draft_id = draft_record.id
      and c.author_type = 'client'
      and lower(coalesce(c.author_email, '')) = coalesce(normalized_email, '')
      and c.comment_type = 'approval_note'
  ) into has_approved;

  select exists (
    select 1 from public.content_review_comments c
    where c.draft_id = draft_record.id
      and c.author_type = 'client'
      and lower(coalesce(c.author_email, '')) = coalesce(normalized_email, '')
      and c.comment_type = 'client_comment'
  ) into has_commented;

  select exists (
    select 1 from public.content_review_comments c
    where c.draft_id = draft_record.id
      and c.author_type = 'client'
      and lower(coalesce(c.author_email, '')) = coalesce(normalized_email, '')
      and c.comment_type = 'change_request'
  ) into has_requested_changes;

  if decision = 'approved' then
    if has_approved or draft_record.approved_at is not null then
      return jsonb_build_object('ok', false, 'error', 'already_approved');
    end if;
    next_status := 'approved';
    activity := 'client_approved';
    next_comment_type := 'approval_note';
  elsif decision = 'changes_requested' then
    if has_requested_changes or draft_record.changes_requested_at is not null then
      return jsonb_build_object('ok', false, 'error', 'already_requested_changes');
    end if;
    next_status := 'changes_requested';
    activity := 'client_requested_changes';
    next_comment_type := 'change_request';
  elsif decision = 'comment' then
    if has_commented then
      return jsonb_build_object('ok', false, 'error', 'already_commented');
    end if;
    if coalesce(trim(feedback_body), '') = '' then
      return jsonb_build_object('ok', false, 'error', 'comment_required');
    end if;
    next_status := draft_record.status;
    activity := 'client_commented';
    next_comment_type := 'client_comment';
  else
    return jsonb_build_object('ok', false, 'error', 'invalid_decision');
  end if;

  if decision in ('approved', 'changes_requested') and coalesce(trim(feedback_body), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'comment_required');
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
      client_visible,
      visibility,
      author_type,
      comment_type
    )
    values (
      draft_record.id,
      draft_record.organization_id,
      draft_record.office_id,
      coalesce(nullif(trim(client_name), ''), 'Client'),
      normalized_email,
      nullif(trim(client_company), ''),
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
      approved_by_name = case when decision = 'approved' then nullif(trim(client_name), '') else approved_by_name end,
      approved_by_email = case when decision = 'approved' then normalized_email else approved_by_email end,
      changes_requested_at = case when decision = 'changes_requested' then now() else changes_requested_at end
  where id = draft_record.id;

  select * into draft_record from public.content_review_drafts where id = draft_record.id;

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
    normalized_email,
    activity,
    jsonb_build_object('decision', decision, 'company', nullif(trim(client_company), ''))
  );

  perform public.notify_content_review_staff(
    draft_record,
    case
      when decision = 'approved' then 'Client approved content'
      when decision = 'changes_requested' then 'Client requested changes'
      else 'Client commented on content'
    end,
    coalesce(nullif(trim(client_name), ''), 'A client') || ' responded to ' || draft_record.title || '.',
    case when decision in ('approved', 'changes_requested') then 'high' else 'medium' end,
    activity
  );

  return jsonb_build_object('ok', true, 'status', next_status);
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
  retention_cutoff timestamptz := now() - interval '60 days';
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
            order by a.display_slot, a.sort_order, a.created_at
            limit 1
          )
        )
        order by d.scheduled_at desc nulls last, d.created_at desc
      )
      from public.content_review_drafts d
      where d.client_id = client_record.id
        and d.status not in ('draft')
        and coalesce(d.scheduled_at, d.created_at) >= retention_cutoff
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

  select * into draft_record from public.content_review_drafts where id = target_draft_id;

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
      select jsonb_agg(to_jsonb(a) - 'organization_id' - 'office_id' - 'uploaded_by' order by a.display_slot, a.sort_order, a.created_at)
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
    ), '[]'::jsonb),
    'feedback', jsonb_build_object(
      'has_approved', exists (
        select 1 from public.content_review_comments c
        where c.draft_id = draft_record.id
          and c.client_id = client_record.id
          and c.author_type = 'client'
          and c.comment_type = 'approval_note'
      ) or draft_record.approved_at is not null,
      'has_commented', exists (
        select 1 from public.content_review_comments c
        where c.draft_id = draft_record.id
          and c.client_id = client_record.id
          and c.author_type = 'client'
          and c.comment_type = 'client_comment'
      ),
      'has_requested_changes', exists (
        select 1 from public.content_review_comments c
        where c.draft_id = draft_record.id
          and c.client_id = client_record.id
          and c.author_type = 'client'
          and c.comment_type = 'change_request'
      ) or draft_record.changes_requested_at is not null
    )
  );
end;
$$;
