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
begin
  if new.comment_type not in ('change_request', 'approval_note') then
    return new;
  end if;

  if new.author_type is distinct from 'client' then
    return new;
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

  notification_title := case
    when new.comment_type = 'approval_note' then 'Content slide approved'
    else 'Content changes requested'
  end;

  notification_message := coalesce(new.author_name, 'Client')
    || coalesce(' (' || nullif(client_record.company_name, '') || ')', '')
    || case when new.comment_type = 'approval_note' then ' approved slide feedback on "' else ' requested changes on "' end
    || draft_record.title
    || '".';

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
        where p.organization_id = draft_record.organization_id
          and p.primary_role::text in ('admin', 'org_admin', 'super_admin', 'superadmin')
      ) recipients
      where user_id is not null
    )
  loop
    dedupe := concat('content-client-feedback:', new.id::text, ':', recipient_id::text);

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
      'high',
      'content_review',
      jsonb_build_object(
        'draft_id', draft_record.id,
        'comment_id', new.id,
        'author_name', new.author_name,
        'author_email', new.author_email,
        'comment_type', new.comment_type,
        'client_id', new.client_id,
        'client_company', client_record.company_name,
        'draft_title', draft_record.title
      ),
      dedupe,
      false
    )
    on conflict do nothing;
  end loop;

  return new;
end;
$$;
