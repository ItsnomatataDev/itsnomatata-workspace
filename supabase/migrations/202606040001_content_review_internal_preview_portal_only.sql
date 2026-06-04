update public.content_review_drafts
set review_url = replace(review_url, '/client-review/', '/internal-preview/')
where review_url like '%/client-review/%';

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
        and c.visibility = 'client_visible'
        and c.author_type = 'client'
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
begin
  return jsonb_build_object(
    'ok', false,
    'error', 'portal_required',
    'message', 'Client reviews must be submitted through the client portal. Schedule preview links are for internal staff only.'
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
    client_record.id,
    'client',
    client_record.contact_name,
    client_record.email,
    activity,
    activity,
    jsonb_build_object('decision', decision, 'source', 'client_portal')
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
        and d.status in (
          'sent_to_client',
          'viewed',
          'changes_requested',
          'approved',
          'published'
        )
        and coalesce(d.scheduled_at, d.created_at) >= retention_cutoff
    ), '[]'::jsonb)
  );
end;
$$;
