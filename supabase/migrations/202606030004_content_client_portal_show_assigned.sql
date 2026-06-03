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
          'ready_for_review',
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
