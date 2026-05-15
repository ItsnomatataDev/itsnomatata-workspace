create or replace function public.delete_content_review_draft(target_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  draft_record public.content_review_drafts%rowtype;
begin
  select *
  into draft_record
  from public.content_review_drafts
  where id = target_draft_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if not public.can_manage_content_review(draft_record.organization_id, draft_record.office_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  delete from public.content_review_drafts
  where id = draft_record.id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.delete_content_client(target_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  client_record public.content_clients%rowtype;
begin
  select *
  into client_record
  from public.content_clients
  where id = target_client_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if not public.can_manage_content_review(client_record.organization_id, client_record.office_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  delete from public.content_review_drafts
  where client_id = client_record.id;

  delete from public.content_clients
  where id = client_record.id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.delete_content_review_draft(uuid) to authenticated;
grant execute on function public.delete_content_client(uuid) to authenticated;

drop policy if exists "content_review_assets_delete" on storage.objects;
create policy "content_review_assets_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'content-review-assets'
  and exists (
    select 1
    from public.content_review_assets a
    where a.storage_path = storage.objects.name
      and public.can_manage_content_review(a.organization_id, a.office_id)
  )
);

notify pgrst, 'reload schema';
