create or replace function public.can_approve_content_review(
  target_organization_id uuid,
  target_office_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = target_organization_id
      and coalesce(p.account_status, 'active') = 'active'
      and coalesce(p.is_suspended, false) = false
      and p.office_id = target_office_id
      and public.is_its_no_matata_office(target_office_id)
      and p.primary_role::text in (
        'admin',
        'org_admin',
        'super_admin',
        'superadmin',
        'social_media',
        'media_team',
        'manager'
      )
  );
$$;

grant execute on function public.can_approve_content_review(uuid, uuid) to authenticated;

create or replace function public.can_manage_content_review(
  target_organization_id uuid,
  target_office_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.can_approve_content_review(target_organization_id, target_office_id);
$$;

create or replace function public.content_review_internal_feedback_state(
  p_draft_id uuid,
  p_expected_posts integer default 10
)
returns jsonb
language sql
stable
as $$
  with slot_feedback as (
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
    select coalesce(array_agg(slot order by slot), '{}'::integer[]) as slots
    from latest
    where comment_type = 'approval_note'
  ),
  changes as (
    select coalesce(array_agg(slot order by slot), '{}'::integer[]) as slots
    from latest
    where comment_type = 'change_request'
  )
  select jsonb_build_object(
    'expected_posts', p_expected_posts,
    'approved_slots', (select slots from approved),
    'changes_requested_slots', (select slots from changes),
    'approved_count', coalesce(cardinality((select slots from approved)), 0),
    'all_posts_approved', coalesce(cardinality((select slots from approved)), 0) >= p_expected_posts,
    'has_approved', coalesce(cardinality((select slots from approved)), 0) > 0,
    'has_requested_changes', coalesce(cardinality((select slots from changes)), 0) > 0
  );
$$;

grant execute on function public.content_review_internal_feedback_state(uuid, integer) to authenticated, anon;

create or replace function public.get_content_review_by_token(
  target_token text,
  viewer_email text default null
)
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
    'feedback', public.content_review_internal_feedback_state(d.id, 10)
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

  feedback_state := public.content_review_internal_feedback_state(draft_record.id, 10);

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
    and draft_record.status not in ('approved', 'published') then
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

  feedback_state := public.content_review_internal_feedback_state(draft_record.id, 10);

  return jsonb_build_object(
    'ok', true,
    'status', draft_record.status,
    'comment', to_jsonb(inserted_comment) - 'organization_id' - 'office_id' - 'created_by',
    'feedback', feedback_state
  );
end;
$$;

grant execute on function public.submit_internal_content_review_feedback(text, text, text, integer)
  to authenticated;
