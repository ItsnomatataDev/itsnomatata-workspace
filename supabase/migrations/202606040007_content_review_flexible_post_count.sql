create or replace function public.content_review_schedule_active_slots(p_draft_id uuid)
returns integer[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_agg(distinct coalesce(a.display_slot, a.sort_order) order by coalesce(a.display_slot, a.sort_order)),
    '{}'::integer[]
  )
  from public.content_review_assets a
  where a.draft_id = p_draft_id
    and a.is_selected is distinct from false
    and coalesce(a.display_slot, a.sort_order) >= 0;
$$;

create or replace function public.content_review_schedule_active_post_count(p_draft_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(cardinality(public.content_review_schedule_active_slots(p_draft_id)), 0);
$$;

grant execute on function public.content_review_schedule_active_slots(uuid) to authenticated, anon;
grant execute on function public.content_review_schedule_active_post_count(uuid) to authenticated, anon;

create or replace function public.content_review_internal_feedback_state(
  p_draft_id uuid,
  p_expected_posts integer default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with active_slots as (
    select unnest(public.content_review_schedule_active_slots(p_draft_id)) as slot
  ),
  expected as (
    select coalesce(nullif(p_expected_posts, 0), public.content_review_schedule_active_post_count(p_draft_id)) as n
  ),
  slot_feedback as (
    select distinct on (
      coalesce(c.display_slot, public.content_review_parse_display_slot(c.body))
    )
      coalesce(c.display_slot, public.content_review_parse_display_slot(c.body)) as slot,
      c.comment_type,
      c.created_at
    from public.content_review_comments c
    where c.draft_id = p_draft_id
      and c.author_type = 'internal'
      and c.comment_type in ('approval_note', 'change_request')
      and coalesce(c.display_slot, public.content_review_parse_display_slot(c.body)) is not null
    order by
      coalesce(c.display_slot, public.content_review_parse_display_slot(c.body)),
      c.created_at desc
  ),
  latest as (
    select slot, comment_type
    from slot_feedback
  ),
  approved as (
    select coalesce(array_agg(l.slot order by l.slot), '{}'::integer[]) as slots
    from latest l
    inner join active_slots a on a.slot = l.slot
    where l.comment_type = 'approval_note'
  ),
  changes as (
    select coalesce(array_agg(l.slot order by l.slot), '{}'::integer[]) as slots
    from latest l
    inner join active_slots a on a.slot = l.slot
    where l.comment_type = 'change_request'
  ),
  approved_on_active as (
    select count(*)::integer as n
    from active_slots a
    where exists (
      select 1
      from latest l
      where l.slot = a.slot
        and l.comment_type = 'approval_note'
    )
  )
  select jsonb_build_object(
    'expected_posts', (select n from expected),
    'approved_slots', (select slots from approved),
    'changes_requested_slots', (select slots from changes),
    'approved_count', coalesce(cardinality((select slots from approved)), 0),
    'all_posts_approved',
      (select n from expected) > 0
      and (select n from approved_on_active) = (select n from expected),
    'has_approved', coalesce(cardinality((select slots from approved)), 0) > 0,
    'has_requested_changes', coalesce(cardinality((select slots from changes)), 0) > 0
  );
$$;

create or replace function public.content_review_client_feedback_state(
  p_draft_id uuid,
  p_client_id uuid default null,
  p_expected_posts integer default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with active_slots as (
    select unnest(public.content_review_schedule_active_slots(p_draft_id)) as slot
  ),
  expected as (
    select coalesce(nullif(p_expected_posts, 0), public.content_review_schedule_active_post_count(p_draft_id)) as n
  ),
  slot_feedback as (
    select distinct on (
      coalesce(c.display_slot, public.content_review_parse_display_slot(c.body))
    )
      coalesce(c.display_slot, public.content_review_parse_display_slot(c.body)) as slot,
      c.comment_type,
      c.created_at
    from public.content_review_comments c
    where c.draft_id = p_draft_id
      and c.author_type = 'client'
      and (p_client_id is null or c.client_id = p_client_id)
      and c.comment_type in ('approval_note', 'change_request')
      and coalesce(c.display_slot, public.content_review_parse_display_slot(c.body)) is not null
    order by
      coalesce(c.display_slot, public.content_review_parse_display_slot(c.body)),
      c.created_at desc
  ),
  latest as (
    select slot, comment_type
    from slot_feedback
  ),
  approved as (
    select coalesce(array_agg(l.slot order by l.slot), '{}'::integer[]) as slots
    from latest l
    inner join active_slots a on a.slot = l.slot
    where l.comment_type = 'approval_note'
  ),
  changes as (
    select coalesce(array_agg(l.slot order by l.slot), '{}'::integer[]) as slots
    from latest l
    inner join active_slots a on a.slot = l.slot
    where l.comment_type = 'change_request'
  ),
  approved_on_active as (
    select count(*)::integer as n
    from active_slots a
    where exists (
      select 1
      from latest l
      where l.slot = a.slot
        and l.comment_type = 'approval_note'
    )
  )
  select jsonb_build_object(
    'expected_posts', (select n from expected),
    'approved_slots', (select slots from approved),
    'changes_requested_slots', (select slots from changes),
    'approved_count', coalesce(cardinality((select slots from approved)), 0),
    'all_posts_approved',
      (select n from expected) > 0
      and (select n from approved_on_active) = (select n from expected),
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

-- Refresh token preview + internal submit to use active post counts
create or replace function public.get_content_review_by_token(target_token text, viewer_email text default null)
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

  if draft_record.expires_at is not null
     and draft_record.expires_at < now()
     and draft_record.status in ('archived', 'published') then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  update public.content_review_drafts
  set expires_at = now() + interval '90 days'
  where id = draft_record.id
    and status not in ('archived', 'published')
    and (
      expires_at is null
      or expires_at < now() + interval '30 days'
    );

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
    'internal_preview_opened',
    jsonb_build_object('token', target_token)
  );

  select jsonb_build_object(
    'ok', true,
    'preview_mode', 'internal',
    'draft', to_jsonb(d.*) - 'organization_id' - 'office_id' - 'created_by' - 'assigned_to',
    'assets', coalesce((
      select jsonb_agg(to_jsonb(a) - 'organization_id' - 'office_id' - 'uploaded_by' order by a.sort_order, a.created_at)
      from public.content_review_assets a
      where a.draft_id = d.id
        and a.is_selected = true
        and a.expires_at >= now()
    ), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(to_jsonb(c) - 'organization_id' - 'office_id' - 'created_by' order by c.created_at)
      from public.content_review_comments c
      where c.draft_id = d.id
        and (
          (c.visibility = 'client_visible' and c.author_type = 'client')
          or (
            c.author_type = 'internal'
            and c.comment_type in ('approval_note', 'change_request', 'internal_comment')
          )
        )
    ), '[]'::jsonb),
    'feedback', public.content_review_internal_feedback_state(d.id, null)
  )
  into result
  from public.content_review_drafts d
  where d.id = draft_record.id;

  return result;
end;
$$;

create or replace function public.submit_internal_content_review_feedback(
  target_token text,
  feedback_body text,
  decision text,
  display_slot integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  draft_record public.content_review_drafts%rowtype;
  profile_record public.profiles%rowtype;
  parsed_slot integer;
  next_comment_type text;
  latest_slot_type text;
  inserted_comment public.content_review_comments%rowtype;
  feedback_state jsonb;
  activity_type text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select *
  into draft_record
  from public.content_review_drafts
  where review_token = target_token
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if draft_record.status in ('archived', 'published') then
    return jsonb_build_object('ok', false, 'error', 'read_only');
  end if;

  if not public.can_approve_content_review(
    draft_record.organization_id,
    draft_record.office_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select *
  into profile_record
  from public.profiles
  where id = auth.uid()
  limit 1;

  parsed_slot := coalesce(display_slot, public.content_review_parse_display_slot(feedback_body));

  if decision = 'approved' then
    activity_type := 'internal_approval';
    if parsed_slot is not null then
      select c.comment_type
      into latest_slot_type
      from public.content_review_comments c
      where c.draft_id = draft_record.id
        and c.author_type = 'internal'
        and c.comment_type in ('approval_note', 'change_request')
        and coalesce(c.display_slot, public.content_review_parse_display_slot(c.body)) = parsed_slot
      order by c.created_at desc
      limit 1;
      if latest_slot_type = 'approval_note' then
        return jsonb_build_object('ok', false, 'error', 'already_approved');
      end if;
    end if;
    next_comment_type := 'approval_note';
  elsif decision = 'changes_requested' then
    next_comment_type := 'change_request';
    activity_type := 'internal_changes_requested';
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
    author_name,
    author_email,
    body,
    comment,
    source,
    client_visible,
    visibility,
    author_type,
    comment_type,
    display_slot,
    created_by
  )
  values (
    draft_record.id,
    draft_record.organization_id,
    draft_record.office_id,
    coalesce(nullif(trim(profile_record.full_name), ''), profile_record.email, 'Staff'),
    profile_record.email,
    trim(feedback_body),
    trim(feedback_body),
    'internal',
    false,
    'internal',
    'internal',
    next_comment_type,
    parsed_slot,
    auth.uid()
  )
  returning * into inserted_comment;

  feedback_state := public.content_review_internal_feedback_state(draft_record.id, null);

  if decision = 'changes_requested' and draft_record.status = 'approved' then
    update public.content_review_drafts
    set status = 'ready_for_review',
        review_status = 'ready_for_review',
        approved_at = null,
        approved_by_name = null,
        approved_by_email = null
    where id = draft_record.id;
  elsif decision = 'approved'
    and (feedback_state->>'all_posts_approved')::boolean
    and draft_record.status not in ('approved', 'published', 'sent_to_client', 'viewed', 'changes_requested') then
    update public.content_review_drafts
    set status = 'approved',
        review_status = 'approved',
        approved_at = now(),
        approved_by_name = coalesce(nullif(trim(profile_record.full_name), ''), profile_record.email, 'Staff'),
        approved_by_email = profile_record.email
    where id = draft_record.id;
  end if;

  select * into draft_record from public.content_review_drafts where id = draft_record.id;

  insert into public.content_review_activity (
    draft_id,
    organization_id,
    office_id,
    actor_user_id,
    actor_name,
    actor_email,
    activity_type,
    metadata
  )
  values (
    draft_record.id,
    draft_record.organization_id,
    draft_record.office_id,
    auth.uid(),
    coalesce(nullif(trim(profile_record.full_name), ''), profile_record.email, 'Staff'),
    profile_record.email,
    activity_type,
    jsonb_build_object(
      'decision', decision,
      'source', 'internal_preview',
      'display_slot', parsed_slot
    )
  );

  feedback_state := public.content_review_internal_feedback_state(draft_record.id, null);

  return jsonb_build_object(
    'ok', true,
    'status', draft_record.status,
    'comment', to_jsonb(inserted_comment) - 'organization_id' - 'office_id' - 'created_by',
    'feedback', feedback_state
  );
end;
$$;

-- Client portal review uses active post count for all_posts_approved
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

  if draft_record.status in ('draft', 'archived') then
    return jsonb_build_object('ok', false, 'error', 'not_available');
  end if;

  if not public.content_review_portal_can_review(draft_record) then
    return jsonb_build_object('ok', false, 'error', 'not_released');
  end if;

  update public.content_review_drafts
  set status = case when status = 'sent_to_client' then 'viewed' else status end,
      last_viewed_at = now()
  where id = draft_record.id;

  select * into draft_record from public.content_review_drafts where id = target_draft_id;

  feedback_state := public.content_review_client_feedback_state(
    draft_record.id,
    client_record.id,
    null
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
        and a.is_selected is distinct from false
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

-- Use active post count when client submits feedback
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

  if draft_record.status in ('draft', 'archived', 'ready_for_review') then
    return jsonb_build_object('ok', false, 'error', 'not_available');
  end if;

  if not public.content_review_portal_can_review(draft_record) then
    return jsonb_build_object('ok', false, 'error', 'not_released');
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
    null
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
      null
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', draft_record.status,
    'feedback', feedback_state
  );
end;
$$;
