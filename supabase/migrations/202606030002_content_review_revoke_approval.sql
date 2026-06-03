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

  if draft_record.status in ('archived', 'published') then
    return jsonb_build_object('ok', false, 'error', 'read_only');
  end if;

  if decision = 'approved' then
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

  update public.content_review_drafts
  set status = next_status,
      review_status = next_status,
      approved_at = case when decision = 'revoke_approval' then null else approved_at end,
      approved_by_name = case when decision = 'revoke_approval' then null else approved_by_name end,
      approved_by_email = case when decision = 'revoke_approval' then null else approved_by_email end,
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
    'client',
    client_record.contact_name,
    client_record.email,
    activity,
    activity,
    jsonb_build_object('decision', decision)
  );

  return jsonb_build_object(
    'ok', true,
    'status', next_status,
    'feedback', jsonb_build_object(
      'has_approved', false,
      'has_commented', false,
      'has_requested_changes', false
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

  if draft_record.status in ('archived', 'published') then
    return jsonb_build_object('ok', false, 'error', 'read_only');
  end if;

  if decision = 'approved' then
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

  update public.content_review_drafts
  set status = next_status,
      review_status = next_status,
      approved_at = case when decision = 'revoke_approval' then null else approved_at end,
      approved_by_name = case when decision = 'revoke_approval' then null else approved_by_name end,
      approved_by_email = case when decision = 'revoke_approval' then null else approved_by_email end,
      changes_requested_at = case
        when decision in ('changes_requested', 'revoke_approval') then now()
        else changes_requested_at
      end
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

  return jsonb_build_object('ok', true, 'status', next_status);
end;
$$;
