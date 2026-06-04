alter table public.content_review_comments
  add column if not exists display_slot integer;

create or replace function public.content_review_parse_display_slot(feedback_body text)
returns integer
language sql
immutable
as $$
  select case
    when (regexp_match(trim(coalesce(feedback_body, '')), '^\[Post\s+(\d+)\]', 'i'))[1] is not null
      then greatest(0, (regexp_match(trim(coalesce(feedback_body, '')), '^\[Post\s+(\d+)\]', 'i'))[1]::integer - 1)
    else null
  end;
$$;

create or replace function public.content_review_client_feedback_state(
  p_draft_id uuid,
  p_client_id uuid default null,
  p_expected_posts integer default 10
)
returns jsonb
language sql
stable
as $$
  with slot_feedback as (
    select distinct
      coalesce(
        c.display_slot,
        public.content_review_parse_display_slot(c.body)
      ) as slot,
      c.comment_type
    from public.content_review_comments c
    where c.draft_id = p_draft_id
      and c.author_type = 'client'
      and (p_client_id is null or c.client_id = p_client_id)
      and c.comment_type in ('approval_note', 'change_request')
      and coalesce(c.display_slot, public.content_review_parse_display_slot(c.body)) is not null
  ),
  approved as (
    select coalesce(array_agg(slot order by slot), '{}'::integer[]) as slots
    from slot_feedback
    where comment_type = 'approval_note'
  ),
  changes as (
    select coalesce(array_agg(slot order by slot), '{}'::integer[]) as slots
    from slot_feedback
    where comment_type = 'change_request'
  )
  select jsonb_build_object(
    'expected_posts', p_expected_posts,
    'approved_slots', (select slots from approved),
    'changes_requested_slots', (select slots from changes),
    'approved_count', coalesce(cardinality((select slots from approved)), 0),
    'all_posts_approved', coalesce(cardinality((select slots from approved)), 0) >= p_expected_posts,
    'has_approved', coalesce(cardinality((select slots from approved)), 0) > 0,
    'has_requested_changes', coalesce(cardinality((select slots from changes)), 0) > 0,
    'has_commented', exists (
      select 1
      from public.content_review_comments c
      where c.draft_id = p_draft_id
        and c.author_type = 'client'
        and c.comment_type = 'client_comment'
        and (p_client_id is null or c.client_id = p_client_id)
    )
  );
$$;

create or replace function public.notify_content_review_change_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  draft_record public.content_review_drafts%rowtype;
  client_record public.content_clients%rowtype;
  recipient_id uuid;
  dedupe text;
  notification_title text;
  notification_message text;
  feedback_source text;
  review_event text;
  source_badge text;
  slot_label text;
begin
  if new.author_type = 'client' and new.comment_type in ('change_request', 'approval_note', 'client_comment') then
    feedback_source := 'client';
  elsif new.author_type = 'internal' and new.comment_type in ('internal_comment', 'change_request', 'approval_note') then
    feedback_source := 'internal';
  else
    return new;
  end if;

  if new.comment_type = 'approval_note' then
    review_event := 'approval';
  elsif new.comment_type = 'change_request' then
    review_event := 'changes_requested';
  elsif new.comment_type = 'internal_comment' then
    review_event := 'internal_note';
  else
    review_event := 'client_comment';
  end if;

  select *
  into draft_record
  from public.content_review_drafts
  where id = new.draft_id
  limit 1;

  if not found then
    return new;
  end if;

  if new.client_id is not null then
    select *
    into client_record
    from public.content_clients
    where id = new.client_id
    limit 1;
  end if;

  source_badge := case
    when feedback_source = 'client' then 'Client review'
    else 'Internal review'
  end;

  slot_label := case
    when coalesce(new.display_slot, public.content_review_parse_display_slot(new.body)) is not null
      then 'Post ' || (coalesce(new.display_slot, public.content_review_parse_display_slot(new.body)) + 1)::text
    else null
  end;

  notification_title := '[' || source_badge || '] ' || case review_event
    when 'approval' then 'Approval'
    when 'changes_requested' then 'Changes requested'
    when 'internal_note' then 'Internal note'
    else 'Comment'
  end || ' — ' || draft_record.title;

  notification_message := coalesce(new.author_name, case when feedback_source = 'client' then 'Client' else 'Team' end)
    || coalesce(' (' || nullif(client_record.company_name, '') || ')', '')
    || case review_event
      when 'approval' then ' approved '
      when 'changes_requested' then ' requested changes on '
      when 'internal_note' then ' added an internal note on '
      else ' commented on '
    end
    || coalesce(slot_label || ' in ', '')
    || '"' || draft_record.title || '".';

  for recipient_id in
    (
      select distinct user_id
      from (
        select draft_record.created_by as user_id
        union all
        select draft_record.assigned_to as user_id
        union all
        select p.id as user_id
        from public.profiles p
        join public.company_offices co on co.id = p.office_id
        where p.organization_id = draft_record.organization_id
          and p.primary_role::text in ('admin', 'org_admin', 'super_admin', 'superadmin', 'social_media', 'media_team')
          and co.slug = 'its-no-matata'
      ) recipients
      where user_id is not null
    )
  loop
    dedupe := concat('content-review-feedback:', new.id::text, ':', recipient_id::text);

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
      metadata,
      dedupe_key,
      is_read
    )
    values (
      draft_record.organization_id,
      recipient_id,
      'system_alert',
      notification_title,
      notification_message,
      'content_review_draft',
      draft_record.id,
      '/admin/content-studio/editor/' || draft_record.id::text,
      case when review_event in ('approval', 'changes_requested') then 'high' else 'medium' end,
      'content_review',
      jsonb_build_object(
        'draft_id', draft_record.id,
        'draftId', draft_record.id,
        'comment_id', new.id,
        'author_name', new.author_name,
        'author_email', new.author_email,
        'comment_type', new.comment_type,
        'feedback_source', feedback_source,
        'review_event', review_event,
        'source_badge', source_badge,
        'display_slot', coalesce(new.display_slot, public.content_review_parse_display_slot(new.body)),
        'client_id', new.client_id,
        'client_company', client_record.company_name,
        'draft_title', draft_record.title,
        'comment_preview', left(new.body, 500)
      ),
      dedupe,
      false
    )
    on conflict do nothing;
  end loop;

  return new;
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
  parsed_slot integer;
  feedback_state jsonb;
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

  if draft_record.status not in (
    'sent_to_client',
    'viewed',
    'changes_requested',
    'approved'
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_available');
  end if;

  if draft_record.status in ('archived', 'published') then
    return jsonb_build_object('ok', false, 'error', 'read_only');
  end if;

  parsed_slot := public.content_review_parse_display_slot(feedback_body);

  if decision = 'approved' then
    if parsed_slot is not null and exists (
      select 1
      from public.content_review_comments c
      where c.draft_id = draft_record.id
        and c.client_id = client_record.id
        and c.author_type = 'client'
        and c.comment_type = 'approval_note'
        and coalesce(c.display_slot, public.content_review_parse_display_slot(c.body)) = parsed_slot
    ) then
      return jsonb_build_object('ok', false, 'error', 'already_approved');
    end if;
    next_status := draft_record.status;
    activity := 'client_approved';
    next_comment_type := 'approval_note';
  elsif decision = 'changes_requested' then
    next_status := 'changes_requested';
    activity := 'client_requested_changes';
    next_comment_type := 'change_request';
  elsif decision = 'revoke_approval' then
    if draft_record.status <> 'approved' then
      return jsonb_build_object('ok', false, 'error', 'not_approved');
    end if;
    next_status := case
      when draft_record.last_viewed_at is not null then 'viewed'
      else 'sent_to_client'
    end;
    activity := 'client_revoked_approval';
    next_comment_type := 'change_request';
  elsif decision = 'comment' then
    next_status := draft_record.status;
    activity := 'client_commented';
    next_comment_type := 'client_comment';
  else
    return jsonb_build_object('ok', false, 'error', 'invalid_decision');
  end if;

  if coalesce(trim(feedback_body), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'comment_required');
  end if;

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
    comment_type,
    display_slot
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
    next_comment_type,
    parsed_slot
  );

  update public.content_review_drafts
  set status = next_status,
      review_status = next_status,
      approved_at = case
        when decision = 'revoke_approval' then null
        when decision = 'approved' then now()
        else approved_at
      end,
      approved_by_name = case
        when decision = 'revoke_approval' then null
        when decision = 'approved' then client_record.contact_name
        else approved_by_name
      end,
      approved_by_email = case
        when decision = 'revoke_approval' then null
        when decision = 'approved' then client_record.email
        else approved_by_email
      end,
      changes_requested_at = case
        when decision in ('changes_requested', 'revoke_approval') then now()
        else changes_requested_at
      end
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
    jsonb_build_object(
      'decision', decision,
      'source', 'client_portal',
      'display_slot', parsed_slot
    )
  );

  feedback_state := public.content_review_client_feedback_state(
    draft_record.id,
    client_record.id,
    10
  );

  if (feedback_state->>'all_posts_approved')::boolean then
    update public.content_review_drafts
    set status = 'approved',
        review_status = 'approved',
        approved_at = coalesce(approved_at, now()),
        approved_by_name = coalesce(approved_by_name, client_record.contact_name),
        approved_by_email = coalesce(approved_by_email, client_record.email)
    where id = draft_record.id;

    select * into draft_record from public.content_review_drafts where id = target_draft_id;
    feedback_state := public.content_review_client_feedback_state(
      draft_record.id,
      client_record.id,
      10
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', draft_record.status,
    'feedback', feedback_state
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
  feedback_state jsonb;
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

  if draft_record.status not in (
    'sent_to_client',
    'viewed',
    'changes_requested',
    'approved',
    'published'
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_available');
  end if;

  update public.content_review_drafts
  set status = case when status = 'sent_to_client' then 'viewed' else status end,
      last_viewed_at = now()
  where id = draft_record.id;

  select * into draft_record from public.content_review_drafts where id = target_draft_id;

  feedback_state := public.content_review_client_feedback_state(
    draft_record.id,
    client_record.id,
    10
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
    'feedback', feedback_state
  );
end;
$$;
