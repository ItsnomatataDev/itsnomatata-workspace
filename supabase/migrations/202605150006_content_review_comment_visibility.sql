alter table public.content_review_comments
  add column if not exists visibility text not null default 'client_visible',
  add column if not exists author_type text not null default 'client',
  add column if not exists comment_type text not null default 'client_comment';

update public.content_review_comments
set
  visibility = case
    when coalesce(client_visible, false) then 'client_visible'
    else 'internal'
  end,
  author_type = case
    when source = 'internal' then 'internal'
    else 'client'
  end,
  comment_type = case
    when source = 'internal' then 'internal_comment'
    else 'client_comment'
  end
where visibility is null
   or author_type is null
   or comment_type is null;

do $$
begin
  alter table public.content_review_comments
    add constraint content_review_comments_visibility_check
    check (visibility in ('internal', 'client_visible'));
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.content_review_comments
    add constraint content_review_comments_author_type_check
    check (author_type in ('internal', 'client'));
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.content_review_comments
    add constraint content_review_comments_comment_type_check
    check (comment_type in ('internal_comment', 'client_comment', 'change_request', 'approval_note'));
exception when duplicate_object then null;
end;
$$;

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
      lower(nullif(trim(client_email), '')),
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
      approved_at = case when decision = 'approved' then now() else approved_at end,
      approved_by_name = case when decision = 'approved' then nullif(trim(client_name), '') else approved_by_name end,
      approved_by_email = case when decision = 'approved' then lower(nullif(trim(client_email), '')) else approved_by_email end,
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
    lower(nullif(trim(client_email), '')),
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

grant execute on function public.get_content_review_by_token(text, text) to anon, authenticated;
grant execute on function public.submit_content_review_feedback(text, text, text, text, text, text) to anon, authenticated;
