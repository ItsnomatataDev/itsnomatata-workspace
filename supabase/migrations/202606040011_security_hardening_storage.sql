-- Security hardening: private codex chat files, tighten content-review asset reads.

-- Codex chat files: remove public read; bucket not world-readable.
drop policy if exists "Public read codex chat files" on storage.objects;

update storage.buckets
set public = false
where id = 'codex-chat-files';

-- Content review assets: authenticated Content Studio users only for the
-- matching organization/office. Anonymous clients must use token-gated RPC
-- responses, not direct storage object reads or bucket listing.
drop policy if exists "content_review_assets_read" on storage.objects;

create policy "content_review_assets_read"
on storage.objects for select
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

-- Codex chat files: owner folder only. New uploads are stored as
-- {auth.uid()}/{filename}; root-level legacy objects are no longer broadly
-- readable/updateable/deletable.
drop policy if exists "Users can upload codex chat files" on storage.objects;
drop policy if exists "Users can view codex chat files" on storage.objects;
drop policy if exists "Users can update codex chat files" on storage.objects;
drop policy if exists "Users can delete codex chat files" on storage.objects;

create policy "codex_chat_files_owner_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'codex-chat-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "codex_chat_files_owner_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'codex-chat-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "codex_chat_files_owner_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'codex-chat-files'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'codex-chat-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "codex_chat_files_owner_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'codex-chat-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Chat images: private bucket, owner folder only. New uploads are stored as
-- {auth.uid()}/{filename}.
update storage.buckets
set public = false
where id = 'chat-images';

drop policy if exists "Users can upload chat images" on storage.objects;
drop policy if exists "Users can view own chat images" on storage.objects;
drop policy if exists "Users can update own chat images" on storage.objects;
drop policy if exists "Users can delete own chat images" on storage.objects;

create policy "chat_images_owner_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'chat-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "chat_images_owner_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'chat-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "chat_images_owner_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'chat-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'chat-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "chat_images_owner_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'chat-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Task submission files: remove bucket-wide authenticated access and scope
-- object access to task members/admins based on the task id in the path.
drop policy if exists "authenticated_task_submission_uploads" on storage.objects;
drop policy if exists "authenticated_task_submission_reads" on storage.objects;
drop policy if exists "authenticated_task_submission_updates" on storage.objects;
drop policy if exists "authenticated_task_submission_deletes" on storage.objects;

create or replace function public.can_access_task_submission_storage_object(
  object_name text
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  with path as (
    select
      storage.foldername(object_name) as parts
  ),
  resolved as (
    select
      case
        when parts[1] = 'task-submissions' then public.try_uuid(parts[2])
        else public.try_uuid(parts[2])
      end as task_id,
      case
        when parts[1] = 'task-submissions' then null::uuid
        else public.try_uuid(parts[1])
      end as organization_id
    from path
  )
  select exists (
    select 1
    from resolved r
    join public.tasks t on t.id = r.task_id
    where (r.organization_id is null or t.organization_id = r.organization_id)
      and (
        t.assigned_to = auth.uid()
        or t.created_by = auth.uid()
        or t.assigned_by = auth.uid()
        or exists (
          select 1
          from public.task_assignees ta
          where ta.task_id = t.id
            and ta.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.task_watchers tw
          where tw.task_id = t.id
            and tw.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id = t.organization_id
            and coalesce(p.account_status, 'active') = 'active'
            and coalesce(p.is_suspended, false) = false
            and p.primary_role in ('admin', 'manager')
        )
      )
  );
$$;

grant execute on function public.can_access_task_submission_storage_object(text) to authenticated;

create policy "task_submission_files_member_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'task-submissions'
  and public.can_access_task_submission_storage_object(name)
);

create policy "task_submission_files_member_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'task-submissions'
  and public.can_access_task_submission_storage_object(name)
);

create policy "task_submission_files_member_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'task-submissions'
  and public.can_access_task_submission_storage_object(name)
)
with check (
  bucket_id = 'task-submissions'
  and public.can_access_task_submission_storage_object(name)
);

create policy "task_submission_files_member_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'task-submissions'
  and public.can_access_task_submission_storage_object(name)
);
