-- Required for task_assignees upserts (onConflict: organization_id,task_id,user_id).

delete from public.task_assignees duplicate_row
using public.task_assignees keeper
where duplicate_row.id > keeper.id
  and duplicate_row.organization_id = keeper.organization_id
  and duplicate_row.task_id = keeper.task_id
  and duplicate_row.user_id = keeper.user_id;

alter table public.task_assignees
  drop constraint if exists task_assignees_org_task_user_key;

alter table public.task_assignees
  add constraint task_assignees_org_task_user_key
  unique (organization_id, task_id, user_id);
