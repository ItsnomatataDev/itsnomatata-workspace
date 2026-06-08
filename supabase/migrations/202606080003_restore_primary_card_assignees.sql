-- Creator auto-assignment should make the creator a collaborator, not always
-- the primary owner shown on personal dashboards.

with preferred_assignees as (
  select distinct on (ta.task_id)
    ta.task_id,
    ta.user_id
  from public.task_assignees ta
  join public.tasks t on t.id = ta.task_id
  where t.created_by is not null
    and t.assigned_to = t.created_by
    and ta.user_id is distinct from t.created_by
  order by ta.task_id, ta.created_at asc
)
update public.tasks t
set assigned_to = p.user_id
from preferred_assignees p
where t.id = p.task_id
  and t.assigned_to = t.created_by;
