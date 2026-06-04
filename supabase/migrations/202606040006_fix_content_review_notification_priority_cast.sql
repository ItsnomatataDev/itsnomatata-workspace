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
  notification_priority public.notification_priority;
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

  notification_priority := case
    when review_event in ('approval', 'changes_requested') then 'high'::public.notification_priority
    else 'medium'::public.notification_priority
  end;

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
        metadata,
        dedupe_key,
        is_read
      )
      values (
        draft_record.organization_id,
        recipient_id,
        'system_alert'::public.notification_type,
        notification_title,
        notification_message,
        'content_review_draft',
        draft_record.id,
        '/admin/content-studio/editor/' || draft_record.id::text,
        notification_priority,
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
    exception
      when others then
        raise warning 'notify_content_review_change_request skipped for %: %', recipient_id, sqlerrm;
    end;
  end loop;

  return new;
end;
$$;

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
declare
  resolved_priority public.notification_priority;
begin
  resolved_priority := coalesce(
    nullif(trim(p_priority), '')::public.notification_priority,
    'medium'::public.notification_priority
  );

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
    'system_alert'::public.notification_type,
    p_title,
    p_message,
    'content_review_draft',
    p_draft.id,
    '/admin/content-studio/editor/' || p_draft.id::text,
    resolved_priority,
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
  where recipient.user_id is not null
  on conflict do nothing;
exception
  when others then
    raise warning 'notify_content_review_staff skipped: %', sqlerrm;
end;
$$;
