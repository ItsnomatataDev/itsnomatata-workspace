-- Trello-ready task backend.
-- Safe to run on an existing Supabase project: it creates missing tables and
-- adds missing columns without dropping current data.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum (
      'backlog',
      'todo',
      'in_progress',
      'review',
      'approved',
      'done',
      'blocked',
      'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
  end if;
end $$;

create table if not exists public.task_board_columns (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid null references projects(id) on delete cascade,
  client_id uuid null references clients(id) on delete cascade,
  name text not null,
  color text null,
  position integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint task_board_columns_pkey primary key (id)
);

alter table public.task_board_columns add column if not exists organization_id uuid null;
alter table public.task_board_columns add column if not exists project_id uuid null;
alter table public.task_board_columns add column if not exists client_id uuid null;
alter table public.task_board_columns add column if not exists color text null;
alter table public.task_board_columns add column if not exists position integer not null default 0;
alter table public.task_board_columns add column if not exists updated_at timestamp with time zone not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'task_board_columns_organization_id_fkey'
  ) then
    alter table public.task_board_columns
      add constraint task_board_columns_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'task_board_columns_project_id_fkey'
  ) then
    alter table public.task_board_columns
      add constraint task_board_columns_project_id_fkey
      foreign key (project_id) references public.projects(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'task_board_columns_client_id_fkey'
  ) then
    alter table public.task_board_columns
      add constraint task_board_columns_client_id_fkey
      foreign key (client_id) references public.clients(id) on delete cascade;
  end if;
end $$;

create index if not exists task_board_columns_org_project_position_idx
  on public.task_board_columns using btree (organization_id, project_id, position);
create index if not exists task_board_columns_org_client_position_idx
  on public.task_board_columns using btree (organization_id, client_id, position);

create table if not exists public.tasks (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid null references projects(id) on delete set null,
  client_id uuid null references clients(id) on delete set null,
  campaign_id uuid null references campaigns(id) on delete set null,
  parent_task_id uuid null references tasks(id) on delete cascade,
  column_id uuid null references task_board_columns(id) on delete set null,
  title text not null,
  description text null,
  status public.task_status not null default 'todo'::task_status,
  priority public.task_priority not null default 'medium'::task_priority,
  assigned_to uuid null references profiles(id) on delete set null,
  assigned_by uuid null references profiles(id) on delete set null,
  created_by uuid null references profiles(id) on delete set null,
  department text null,
  due_date timestamp with time zone null,
  start_date timestamp with time zone null,
  completed_at timestamp with time zone null,
  blocked_reason text null,
  ai_generated boolean not null default false,
  position integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  tracked_seconds_cache integer not null default 0,
  estimated_seconds integer not null default 0,
  is_billable boolean not null default false,
  archived_at timestamp with time zone null,
  archived_by uuid null references profiles(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint tasks_pkey primary key (id),
  constraint tasks_estimated_seconds_check check (estimated_seconds >= 0),
  constraint tasks_tracked_seconds_cache_check check (tracked_seconds_cache >= 0)
);

alter table public.tasks add column if not exists column_id uuid null;
alter table public.tasks add column if not exists estimated_seconds integer not null default 0;
alter table public.tasks add column if not exists archived_at timestamp with time zone null;
alter table public.tasks add column if not exists archived_by uuid null;
alter table public.tasks add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.tasks add column if not exists tracked_seconds_cache integer not null default 0;
alter table public.tasks add column if not exists is_billable boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_column_id_fkey'
  ) then
    alter table public.tasks
      add constraint tasks_column_id_fkey
      foreign key (column_id) references public.task_board_columns(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'tasks_archived_by_fkey'
  ) then
    alter table public.tasks
      add constraint tasks_archived_by_fkey
      foreign key (archived_by) references public.profiles(id) on delete set null;
  end if;
end $$;

create index if not exists idx_tasks_assigned_to
  on public.tasks using btree (assigned_to, status);
create index if not exists idx_tasks_org_status
  on public.tasks using btree (organization_id, status);
create index if not exists idx_tasks_project
  on public.tasks using btree (project_id);
create index if not exists idx_tasks_column_position
  on public.tasks using btree (organization_id, column_id, position);
create index if not exists idx_tasks_client_status_position
  on public.tasks using btree (client_id, status, position);
create index if not exists idx_tasks_archive
  on public.tasks using btree (organization_id, archived_at);

create table if not exists public.task_assignees (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  constraint task_assignees_pkey primary key (id),
  constraint task_assignees_unique unique (organization_id, task_id, user_id)
);

create table if not exists public.task_watchers (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  constraint task_watchers_pkey primary key (id),
  constraint task_watchers_unique unique (task_id, user_id)
);

create unique index if not exists idx_task_watchers_unique
  on public.task_watchers using btree (organization_id, task_id, user_id);

create table if not exists public.task_members (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  invited_by uuid null references profiles(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  constraint task_members_pkey primary key (id),
  constraint task_members_unique unique (organization_id, task_id, user_id)
);

alter table public.task_members add column if not exists organization_id uuid null;
alter table public.task_members add column if not exists invited_by uuid null;

do $$
begin
  alter table public.task_members drop constraint if exists task_members_task_id_fkey;
  if not exists (
    select 1 from pg_constraint where conname = 'task_members_task_id_fkey'
  ) then
    alter table public.task_members
      add constraint task_members_task_id_fkey
      foreign key (task_id) references public.tasks(id) on delete cascade;
  end if;
end $$;

create table if not exists public.task_labels (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid null references projects(id) on delete cascade,
  client_id uuid null references clients(id) on delete cascade,
  name text not null,
  color text not null default '#f97316',
  position integer not null default 0,
  created_by uuid null references profiles(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint task_labels_pkey primary key (id),
  constraint task_labels_name_scope_unique unique (organization_id, project_id, client_id, name)
);

create table if not exists public.task_label_assignments (
  id uuid not null default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  label_id uuid not null references task_labels(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  constraint task_label_assignments_pkey primary key (id),
  constraint task_label_assignments_task_id_label_id_key unique (task_id, label_id)
);

create table if not exists public.task_comments (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid null references profiles(id) on delete set null,
  comment text not null,
  is_internal boolean not null default false,
  edited_at timestamp with time zone null,
  deleted_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint task_comments_pkey primary key (id)
);

create index if not exists idx_task_comments_task_id
  on public.task_comments using btree (task_id, created_at);

create table if not exists public.task_checklists (
  id uuid not null default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  position integer not null default 0,
  created_by uuid null references profiles(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint task_checklists_pkey primary key (id)
);

create table if not exists public.task_checklist_items (
  id uuid not null default gen_random_uuid(),
  checklist_id uuid not null references task_checklists(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  content text not null,
  is_completed boolean not null default false,
  completed_at timestamp with time zone null,
  completed_by uuid null references profiles(id) on delete set null,
  position integer not null default 0,
  created_by uuid null references profiles(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint task_checklist_items_pkey primary key (id)
);

create index if not exists task_checklists_task_id_idx
  on public.task_checklists using btree (task_id);
create index if not exists task_checklist_items_task_id_idx
  on public.task_checklist_items using btree (task_id);
create index if not exists task_checklist_items_checklist_id_idx
  on public.task_checklist_items using btree (checklist_id);

create table if not exists public.task_attachments (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  uploaded_by uuid null references profiles(id) on delete set null,
  attachment_type text not null default 'file',
  file_name text null,
  file_url text null,
  storage_path text null,
  mime_type text null,
  file_size bigint null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint task_attachments_pkey primary key (id),
  constraint task_attachments_type_check check (attachment_type in ('file', 'link'))
);

alter table public.task_attachments add column if not exists organization_id uuid null;
alter table public.task_attachments add column if not exists project_id uuid null;
alter table public.task_attachments add column if not exists attachment_type text not null default 'file';
alter table public.task_attachments add column if not exists storage_path text null;
alter table public.task_attachments add column if not exists mime_type text null;
alter table public.task_attachments add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.task_attachments
set
  project_id = case
    when exists (
      select 1
      from public.projects
      where projects.id = task_attachments.task_id
    ) then task_attachments.task_id
    else project_id
  end,
  metadata = coalesce(metadata, '{}'::jsonb) ||
    jsonb_build_object(
      'legacy_task_id_value', task_id::text,
      'legacy_task_id_note', 'This value was stored before task_attachments.task_id was repaired to reference tasks.'
    ),
  task_id = null
where task_id is not null
  and not exists (
    select 1
    from public.tasks
    where tasks.id = task_attachments.task_id
  );

do $$
begin
  alter table public.task_attachments drop constraint if exists task_attachments_task_id_fkey;
  if not exists (
    select 1 from pg_constraint where conname = 'task_attachments_task_id_fkey'
  ) then
    alter table public.task_attachments
      add constraint task_attachments_task_id_fkey
      foreign key (task_id) references public.tasks(id) on delete cascade;
  end if;
end $$;

create index if not exists idx_task_attachments_task_id
  on public.task_attachments using btree (task_id);

create table if not exists public.task_custom_field_definitions (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid null references projects(id) on delete cascade,
  client_id uuid null references clients(id) on delete cascade,
  name text not null,
  field_type text not null default 'text',
  options jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  created_by uuid null references profiles(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint task_custom_field_definitions_pkey primary key (id),
  constraint task_custom_field_type_check check (
    field_type in ('text', 'number', 'date', 'checkbox', 'select', 'url')
  )
);

create table if not exists public.task_custom_field_values (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  field_id uuid not null references task_custom_field_definitions(id) on delete cascade,
  value jsonb not null default 'null'::jsonb,
  updated_by uuid null references profiles(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint task_custom_field_values_pkey primary key (id),
  constraint task_custom_field_values_unique unique (task_id, field_id)
);

create table if not exists public.task_updates (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  project_id uuid null references projects(id) on delete set null,
  user_id uuid null references profiles(id) on delete set null,
  update_type text not null default 'manual',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint task_updates_pkey primary key (id)
);

create index if not exists idx_task_updates_task_id_created_at
  on public.task_updates using btree (task_id, created_at desc);

create table if not exists public.task_due_reminders (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  remind_at timestamp with time zone not null,
  sent_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  constraint task_due_reminders_pkey primary key (id),
  constraint task_due_reminders_unique unique (task_id, user_id, remind_at)
);

create table if not exists public.task_submissions (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  submitted_by uuid not null references profiles(id) on delete cascade,
  submission_type text not null,
  title text not null,
  notes text null,
  link_url text null,
  file_path text null,
  file_name text null,
  mime_type text null,
  file_size bigint null,
  approval_status public.approval_status not null default 'pending'::approval_status,
  reviewed_by uuid null references profiles(id) on delete set null,
  reviewed_at timestamp with time zone null,
  review_note text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint task_submissions_pkey primary key (id),
  constraint task_submissions_submission_type_check check (
    submission_type in ('website', 'media', 'document', 'general')
  )
);

create index if not exists idx_task_submissions_task_id
  on public.task_submissions using btree (task_id);
create index if not exists idx_task_submissions_status
  on public.task_submissions using btree (approval_status);

do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists trg_tasks_updated_at on public.tasks;
    create trigger trg_tasks_updated_at
      before update on public.tasks
      for each row execute function set_updated_at();

    drop trigger if exists task_labels_set_updated_at on public.task_labels;
    create trigger task_labels_set_updated_at
      before update on public.task_labels
      for each row execute function set_updated_at();

    drop trigger if exists task_comments_set_updated_at on public.task_comments;
    create trigger task_comments_set_updated_at
      before update on public.task_comments
      for each row execute function set_updated_at();

    drop trigger if exists task_checklists_set_updated_at on public.task_checklists;
    create trigger task_checklists_set_updated_at
      before update on public.task_checklists
      for each row execute function set_updated_at();

    drop trigger if exists task_checklist_items_set_updated_at on public.task_checklist_items;
    create trigger task_checklist_items_set_updated_at
      before update on public.task_checklist_items
      for each row execute function set_updated_at();
  end if;
end $$;
