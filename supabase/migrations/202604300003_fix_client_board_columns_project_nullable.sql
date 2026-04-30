alter table public.task_board_columns
  alter column project_id drop not null;

alter table public.task_board_columns
  alter column client_id drop not null;

create index if not exists task_board_columns_org_client_position_idx
  on public.task_board_columns (organization_id, client_id, position);
