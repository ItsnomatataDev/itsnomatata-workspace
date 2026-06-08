with imported_trello_tasks as (
  select distinct
    t.id,
    t.organization_id,
    t.created_by,
    t.assigned_to,
    t.assigned_by,
    t.metadata,
    b.imported_by
  from public.tasks t
  left join public.external_import_mappings m
    on m.organization_id = t.organization_id
   and m.internal_table = 'tasks'
   and m.internal_id = t.id
   and m.source = 'trello'
   and m.external_type in ('card', 'card_short_link')
  left join public.external_import_batches b
    on b.id = m.import_batch_id
  where coalesce(t.metadata, '{}'::jsonb)->>'imported_from' = 'trello_board_json'
     or m.id is not null
),
polluted_importer_links as (
  select task_id, user_id
  from public.task_assignees ta
  join imported_trello_tasks itt
    on itt.id = ta.task_id
   and itt.organization_id = ta.organization_id
  where itt.imported_by is not null
    and ta.user_id = itt.imported_by
    and not (coalesce(itt.metadata->'trello_assignee_profile_ids', '[]'::jsonb) ? (itt.imported_by::text))
    and itt.metadata->>'trello_creator_profile_id' is distinct from itt.imported_by::text
)
delete from public.task_assignees ta
using polluted_importer_links pil
where ta.task_id = pil.task_id
  and ta.user_id = pil.user_id;

with imported_trello_tasks as (
  select distinct
    t.id,
    t.created_by,
    t.assigned_to,
    t.assigned_by,
    t.metadata,
    b.imported_by
  from public.tasks t
  left join public.external_import_mappings m
    on m.organization_id = t.organization_id
   and m.internal_table = 'tasks'
   and m.internal_id = t.id
   and m.source = 'trello'
   and m.external_type in ('card', 'card_short_link')
  left join public.external_import_batches b
    on b.id = m.import_batch_id
  where coalesce(t.metadata, '{}'::jsonb)->>'imported_from' = 'trello_board_json'
     or m.id is not null
)
update public.tasks t
set
  created_by = case
    when itt.imported_by is not null
     and t.created_by = itt.imported_by
     and itt.metadata->>'trello_creator_profile_id' is distinct from itt.imported_by::text
      then null
    else t.created_by
  end,
  assigned_to = case
    when itt.imported_by is not null
     and t.assigned_to = itt.imported_by
     and not (coalesce(itt.metadata->'trello_assignee_profile_ids', '[]'::jsonb) ? (itt.imported_by::text))
      then null
    else t.assigned_to
  end,
  assigned_by = case
    when itt.imported_by is not null
     and t.assigned_to = itt.imported_by
     and t.assigned_by = itt.imported_by
     and not (coalesce(itt.metadata->'trello_assignee_profile_ids', '[]'::jsonb) ? (itt.imported_by::text))
      then null
    else t.assigned_by
  end
from imported_trello_tasks itt
where t.id = itt.id
  and (
    (
      itt.imported_by is not null
      and t.created_by = itt.imported_by
      and itt.metadata->>'trello_creator_profile_id' is distinct from itt.imported_by::text
    )
    or (
      itt.imported_by is not null
      and t.assigned_to = itt.imported_by
      and not (coalesce(itt.metadata->'trello_assignee_profile_ids', '[]'::jsonb) ? (itt.imported_by::text))
    )
  );
