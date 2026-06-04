
create or replace function public.content_review_portal_can_review(d public.content_review_drafts)
returns boolean
language sql
stable
as $$
  select d.status in ('sent_to_client', 'viewed', 'changes_requested', 'published')
    or (
      d.status = 'approved'
      and (d.last_viewed_at is not null or d.changes_requested_at is not null)
    );
$$;

create or replace function public.get_content_client_portal(
  client_token text,
  session_token text,
  login_email text
)
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
          ),
          'can_review', public.content_review_portal_can_review(d)
        )
        order by d.scheduled_at desc nulls last, d.created_at desc
      )
      from public.content_review_drafts d
      where d.client_id = client_record.id
        and d.status not in ('draft', 'archived')
        and coalesce(trim(d.title), '') !~* '^post\s+\d+\s*$'
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




and also if we are using n8n for notifications kinldy create a fully working n8n workflow for emails 