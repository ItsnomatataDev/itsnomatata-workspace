alter table if exists public.task_assignees enable row level security;

create index if not exists task_assignees_task_user_idx
  on public.task_assignees (task_id, user_id);

create index if not exists attendance_sessions_auto_clock_out_idx
  on public.attendance_sessions (status, clock_out_at, clock_in_at)
  where status = 'active' and clock_out_at is null;

create or replace function public.current_profile_can_access_task(p_task_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  with current_profile as (
    select p.id, p.organization_id, p.primary_role
    from public.profiles p
    where p.id = auth.uid()
  ),
  target_task as (
    select t.id, t.organization_id, t.created_by, t.assigned_to, t.client_id
    from public.tasks t
    where t.id = p_task_id
  )
  select exists (
    select 1
    from target_task t
    join current_profile p on p.organization_id = t.organization_id
    where
      p.id = t.created_by
      or p.id = t.assigned_to
      or coalesce(p.primary_role::text, '') in ('admin', 'manager', 'it', 'super_admin')
      or exists (
        select 1
        from public.task_assignees ta
        where ta.task_id = t.id
          and ta.user_id = p.id
      )
      or exists (
        select 1
        from public.organization_members om
        where om.organization_id = t.organization_id
          and om.user_id = p.id
          and coalesce(om.status, 'active') = 'active'
      )
  );
$$;

grant execute on function public.current_profile_can_access_task(uuid) to authenticated;

create or replace function public.current_profile_organization_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select p.organization_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

grant execute on function public.current_profile_organization_id() to authenticated;

drop policy if exists "Task access users can read task assignees" on public.task_assignees;
create policy "Task access users can read task assignees"
on public.task_assignees
for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_profile_can_access_task(task_id)
);

drop policy if exists "Task access users can add task assignees" on public.task_assignees;
create policy "Task access users can add task assignees"
on public.task_assignees
for insert
to authenticated
with check (
  public.current_profile_can_access_task(task_id)
  and exists (
    select 1
    from public.profiles target_profile
    join public.tasks target_task on target_task.id = task_assignees.task_id
    where target_profile.id = task_assignees.user_id
      and target_profile.organization_id = target_task.organization_id
      and target_task.organization_id = task_assignees.organization_id
  )
);

drop policy if exists "Task access users can remove task assignees" on public.task_assignees;
create policy "Task access users can remove task assignees"
on public.task_assignees
for delete
to authenticated
using (public.current_profile_can_access_task(task_id));

drop policy if exists "Org users can read collaborator profile basics" on public.profiles;
create policy "Org users can read collaborator profile basics"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or organization_id = public.current_profile_organization_id()
);

-- Optional Supabase scheduled function setup:
-- Enable pg_cron/pg_net in the dashboard or SQL editor, then schedule:
--
-- select cron.schedule(
--   'auto-clock-out-harare-1800',
--   '0 16 * * *',
--   $$
--   select net.http_post(
--     url := current_setting('app.supabase_url') || '/functions/v1/auto-clock-out',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
--
-- 18:00 Africa/Harare is 16:00 UTC.
