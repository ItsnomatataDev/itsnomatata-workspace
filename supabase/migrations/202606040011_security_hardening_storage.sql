-- Security hardening: private codex chat files, tighten content-review asset reads.

-- Codex chat files: remove public read; bucket not world-readable.
drop policy if exists "Public read codex chat files" on storage.objects;

update storage.buckets
set public = false
where id = 'codex-chat-files';

-- Content review assets: authenticated org members only (no anonymous bucket listing).
drop policy if exists "content_review_assets_read" on storage.objects;

create policy "content_review_assets_read"
on storage.objects for select
to authenticated, anon
using (
  bucket_id = 'content-review-assets'
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.account_status, 'active') = 'active'
        and coalesce(p.is_suspended, false) = false
    )
    or exists (
      select 1
      from public.content_review_assets a
      join public.content_review_drafts d on d.id = a.draft_id
      where a.storage_path = storage.objects.name
        and d.status in (
          'sent_to_client',
          'viewed',
          'changes_requested',
          'approved',
          'published',
          'archived'
        )
    )
  )
);
