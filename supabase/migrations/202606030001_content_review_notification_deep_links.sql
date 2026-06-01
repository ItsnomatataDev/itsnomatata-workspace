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
    '/admin/content-studio/editor/' || p_draft.id::text,
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

grant execute on function public.notify_content_review_staff(public.content_review_drafts, text, text, text, text) to authenticated;
