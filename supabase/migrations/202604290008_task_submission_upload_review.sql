insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-submissions',
  'task-submissions',
  false,
52428800,
array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'video/mp4',
    'video/quicktime',
    'audio/mpeg',
    'audio/wav'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.task_submissions
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists file_size bigint,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

alter table public.task_submissions enable row level security;

drop policy if exists "task_submitters_insert_submissions" on public.task_submissions;
create policy "task_submitters_insert_submissions"
on public.task_submissions
for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and exists (
    select 1
    from public.tasks t
    where t.id = task_submissions.task_id
      and t.organization_id = task_submissions.organization_id
      and (
        t.assigned_to = auth.uid()
        or t.created_by = auth.uid()
        or t.assigned_by = auth.uid()
        or exists (
          select 1
          from public.task_assignees ta
          where ta.task_id = t.id and ta.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.task_watchers tw
          where tw.task_id = t.id and tw.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "task_members_read_submissions" on public.task_submissions;
create policy "task_members_read_submissions"
on public.task_submissions
for select
to authenticated
using (
  submitted_by = auth.uid()
  or exists (
    select 1
    from public.tasks t
    where t.id = task_submissions.task_id
      and (
        t.assigned_to = auth.uid()
        or t.created_by = auth.uid()
        or t.assigned_by = auth.uid()
        or exists (
          select 1
          from public.task_assignees ta
          where ta.task_id = t.id and ta.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.task_watchers tw
          where tw.task_id = t.id and tw.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "task_reviewers_update_submissions" on public.task_submissions;
create policy "task_reviewers_update_submissions"
on public.task_submissions
for update
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_submissions.task_id
      and (
        t.created_by = auth.uid()
        or t.assigned_by = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id = t.organization_id
            and p.primary_role in ('admin', 'manager')
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.tasks t
    where t.id = task_submissions.task_id
      and (
        t.created_by = auth.uid()
        or t.assigned_by = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id = t.organization_id
            and p.primary_role in ('admin', 'manager')
        )
      )
  )
);

drop policy if exists "task_submitters_update_own_pending_submissions" on public.task_submissions;
create policy "task_submitters_update_own_pending_submissions"
on public.task_submissions
for update
to authenticated
using (
  submitted_by = auth.uid()
  and approval_status = 'pending'
  and exists (
    select 1
    from public.tasks t
    where t.id = task_submissions.task_id
      and t.organization_id = task_submissions.organization_id
      and (
        t.assigned_to = auth.uid()
        or t.created_by = auth.uid()
        or t.assigned_by = auth.uid()
        or exists (
          select 1
          from public.task_assignees ta
          where ta.task_id = t.id and ta.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.task_watchers tw
          where tw.task_id = t.id and tw.user_id = auth.uid()
        )
      )
  )
)
with check (
  submitted_by = auth.uid()
  and approval_status = 'pending'
  and exists (
    select 1
    from public.tasks t
    where t.id = task_submissions.task_id
      and t.organization_id = task_submissions.organization_id
      and (
        t.assigned_to = auth.uid()
        or t.created_by = auth.uid()
        or t.assigned_by = auth.uid()
        or exists (
          select 1
          from public.task_assignees ta
          where ta.task_id = t.id and ta.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.task_watchers tw
          where tw.task_id = t.id and tw.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "authenticated_task_submission_uploads" on storage.objects;
create policy "authenticated_task_submission_uploads"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'task-submissions');

drop policy if exists "authenticated_task_submission_reads" on storage.objects;
create policy "authenticated_task_submission_reads"
on storage.objects
for select
to authenticated
using (bucket_id = 'task-submissions');

drop policy if exists "authenticated_task_submission_updates" on storage.objects;
create policy "authenticated_task_submission_updates"
on storage.objects
for update
to authenticated
using (bucket_id = 'task-submissions')
with check (bucket_id = 'task-submissions');

drop policy if exists "authenticated_task_submission_deletes" on storage.objects;
create policy "authenticated_task_submission_deletes"
on storage.objects
for delete
to authenticated
using (bucket_id = 'task-submissions');
