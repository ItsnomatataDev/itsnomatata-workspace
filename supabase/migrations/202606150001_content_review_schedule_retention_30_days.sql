create or replace function public.purge_content_review_schedules(retention_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  cutoff timestamptz := now() - make_interval(days => greatest(retention_days, 1));
  target_ids uuid[];
  deleted_count integer := 0;
begin
  select array_agg(d.id)
  into target_ids
  from public.content_review_drafts d
  where coalesce(d.scheduled_at, d.created_at) < cutoff;

  if target_ids is null or cardinality(target_ids) = 0 then
    return jsonb_build_object('ok', true, 'deleted', 0);
  end if;

  delete from storage.objects o
  using public.content_review_assets a
  where o.bucket_id = 'content-review-assets'
    and o.name = a.storage_path
    and a.draft_id = any(target_ids);

  delete from public.content_review_drafts
  where id = any(target_ids);

  get diagnostics deleted_count = row_count;

  return jsonb_build_object('ok', true, 'deleted', deleted_count);
end;
$$;

grant execute on function public.purge_content_review_schedules(integer) to authenticated;
