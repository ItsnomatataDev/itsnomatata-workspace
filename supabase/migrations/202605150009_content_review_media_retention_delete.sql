alter table public.content_review_assets
  add column if not exists expires_at timestamptz not null default (now() + interval '60 days'),
  add column if not exists original_size_bytes bigint,
  add column if not exists stored_size_bytes bigint,
  add column if not exists compression_status text not null default 'not_applicable';

do $$
begin
  alter table public.content_review_assets
    add constraint content_review_assets_compression_status_check
    check (compression_status in ('compressed', 'stored_original', 'not_applicable'));
exception when duplicate_object then null;
end;
$$;

create index if not exists content_review_assets_expires_idx
  on public.content_review_assets (expires_at);

create or replace function public.cleanup_expired_content_review_assets()
returns integer
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  deleted_count integer := 0;
begin
  delete from public.content_review_assets
  where expires_at < now();

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

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

grant execute on function public.cleanup_expired_content_review_assets() to authenticated;
grant execute on function public.delete_content_review_draft(uuid) to authenticated;
