insert into public.task_assignees (
  organization_id,
  task_id,
  user_id
)
select
  t.organization_id,
  t.id,
  t.created_by
from public.tasks t
where t.created_by is not null
  and t.organization_id is not null
on conflict (organization_id, task_id, user_id) do nothing;

update public.tasks
set
  assigned_to = created_by,
  assigned_by = coalesce(assigned_by, created_by)
where created_by is not null
  and assigned_to is null;
