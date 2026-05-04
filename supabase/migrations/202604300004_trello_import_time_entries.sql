alter table public.time_entries
  alter column user_id drop not null;

alter table public.time_entries
  add column if not exists entry_type text default 'timer';

update public.time_entries
set entry_type = case
  when coalesce(source, '') in ('manual', 'card_modal_manual') then 'manual'
  when coalesce(source, '') in ('trello_import', 'everhour_import', 'everhour') then 'imported'
  else 'timer'
end
where entry_type is null;

alter table public.time_entries
  drop constraint if exists time_entries_entry_type_check;

alter table public.time_entries
  add constraint time_entries_entry_type_check
  check (entry_type in ('timer', 'manual', 'imported'));

alter table public.time_entries
  add column if not exists source_entry_id text,
  add column if not exists source_card_id text,
  add column if not exists source_board_id text,
  add column if not exists source_task_id text,
  add column if not exists source_project_id text,
  add column if not exists source_user_id text,
  add column if not exists source_user_name text,
  add column if not exists source_user_email text,
  add column if not exists import_hash text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists delete_reason text;

create unique index if not exists time_entries_trello_import_hash_unique
  on public.time_entries (organization_id, source, import_hash)
  where source = 'trello_import' and import_hash is not null;

create unique index if not exists time_entries_external_import_hash_unique
  on public.time_entries (organization_id, source, import_hash)
  where source in ('trello_import', 'everhour_import', 'everhour') and import_hash is not null;

create unique index if not exists time_entries_everhour_source_entry_unique
  on public.time_entries (organization_id, source, source_entry_id)
  where source in ('everhour', 'everhour_import') and source_entry_id is not null;

create index if not exists idx_time_entries_source_card
  on public.time_entries (organization_id, source, source_card_id);

create index if not exists idx_time_entries_source_user
  on public.time_entries (organization_id, source, source_user_id);

create index if not exists idx_time_entries_task_not_deleted
  on public.time_entries (organization_id, task_id, started_at desc)
  where deleted_at is null;

create unique index if not exists time_entries_source_entry_id_unique
  on public.time_entries (organization_id, source, source_entry_id)
  where source_entry_id is not null and deleted_at is null;

create table if not exists public.time_entry_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  time_entry_id uuid references public.time_entries(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('created', 'updated', 'deleted', 'restored', 'imported', 'mapped_user')),
  previous_data jsonb,
  new_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_time_entry_audit_logs_org_created
  on public.time_entry_audit_logs (organization_id, created_at desc);

create index if not exists idx_time_entry_audit_logs_entry
  on public.time_entry_audit_logs (time_entry_id, created_at desc);

create index if not exists idx_time_entry_audit_logs_task
  on public.time_entry_audit_logs (organization_id, task_id, created_at desc);

create index if not exists idx_time_entries_source_task
  on public.time_entries (organization_id, source, source_task_id);

create index if not exists idx_time_entries_source_project
  on public.time_entries (organization_id, source, source_project_id);

drop policy if exists "Admins managers can import time entries" on public.time_entries;
create policy "Admins managers can import time entries"
on public.time_entries
for insert
to authenticated
with check (
  source in ('trello_import', 'everhour_import', 'everhour')
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = time_entries.organization_id
      and p.primary_role in ('admin', 'manager', 'it')
  )
);

create table if not exists public.everhour_user_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  everhour_user_id text not null,
  everhour_user_name text,
  everhour_user_email text,
  profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, everhour_user_id)
);

create index if not exists idx_everhour_user_mappings_profile
  on public.everhour_user_mappings (organization_id, profile_id);

alter table public.tasks
  add column if not exists imported_time_status text;

update public.task_board_columns
set name = regexp_replace(name, '^Trello - ', 'Codex - ')
where name like 'Trello - %';

create table if not exists public.external_time_user_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source text not null,
  source_user_id text not null,
  source_user_name text,
  source_user_email text,
  user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source, source_user_id)
);

create index if not exists idx_external_time_user_mappings_user
  on public.external_time_user_mappings (organization_id, user_id);

create table if not exists public.import_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source text not null,
  source_board_id text,
  imported_by uuid references public.profiles(id) on delete set null,
  status text not null default 'completed',
  total_boards int not null default 0,
  total_cards int not null default 0,
  total_time_entries int not null default 0,
  unmatched_users_count int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.everhour_import_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  imported_by uuid references public.profiles(id) on delete set null,
  status text not null default 'completed',
  files jsonb not null default '[]'::jsonb,
  total_rows int not null default 0,
  imported_rows int not null default 0,
  skipped_duplicates int not null default 0,
  unmatched_users_count int not null default 0,
  unmatched_tasks_count int not null default 0,
  unmatched_projects_count int not null default 0,
  total_seconds bigint not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_everhour_import_logs_org_created
  on public.everhour_import_logs (organization_id, created_at desc);

create index if not exists idx_import_logs_org_source
  on public.import_logs (organization_id, source, created_at desc);

drop view if exists public.time_entries_calendar cascade;

create view public.time_entries_calendar as
select
  te.organization_id,
  coalesce(te.user_id::text, te.source_user_id, te.source_user_name, 'unmatched') as user_id,
  coalesce(p.full_name, te.source_user_name, 'Unmatched Codex user') as user_name,
  p.email as user_email,
  date(te.started_at) as entry_date,
  sum(te.duration_seconds) as total_seconds,
  count(*) as entry_count,
  json_agg(
    json_build_object(
      'project_id', te.project_id,
      'project_name', pr.name,
      'hours', te.duration_seconds / 3600.0,
      'is_billable', te.is_billable,
      'description', te.description,
      'entry_count', 1,
      'source', te.source,
      'entry_type', te.entry_type,
      'source_user_name', te.source_user_name,
      'source_user_email', te.source_user_email,
      'task_id', te.task_id,
      'client_id', te.client_id
    )
  ) as project_entries
from public.time_entries te
left join public.profiles p on te.user_id = p.id
left join public.projects pr on te.project_id = pr.id
where te.approval_status in ('pending', 'approved')
  and te.deleted_at is null
group by
  te.organization_id,
  coalesce(te.user_id::text, te.source_user_id, te.source_user_name, 'unmatched'),
  coalesce(p.full_name, te.source_user_name, 'Unmatched Codex user'),
  p.email,
  date(te.started_at);

grant select on public.time_entries_calendar to authenticated;

alter table public.external_time_user_mappings enable row level security;
alter table public.everhour_user_mappings enable row level security;
alter table public.import_logs enable row level security;
alter table public.everhour_import_logs enable row level security;
alter table public.time_entry_audit_logs enable row level security;

drop policy if exists "org_admins_manage_external_time_user_mappings" on public.external_time_user_mappings;
create policy "org_admins_manage_external_time_user_mappings"
on public.external_time_user_mappings
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = external_time_user_mappings.organization_id
      and p.primary_role in ('admin', 'manager', 'it')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = external_time_user_mappings.organization_id
      and p.primary_role in ('admin', 'manager', 'it')
  )
);

drop policy if exists "org_admins_manage_everhour_user_mappings" on public.everhour_user_mappings;
create policy "org_admins_manage_everhour_user_mappings"
on public.everhour_user_mappings
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = everhour_user_mappings.organization_id
      and p.primary_role in ('admin', 'manager', 'it')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = everhour_user_mappings.organization_id
      and p.primary_role in ('admin', 'manager', 'it')
  )
);

drop policy if exists "org_admins_managers_read_import_logs" on public.import_logs;
create policy "org_admins_managers_read_import_logs"
on public.import_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = import_logs.organization_id
      and p.primary_role in ('admin', 'manager', 'it')
  )
);

drop policy if exists "org_admins_managers_insert_import_logs" on public.import_logs;
create policy "org_admins_managers_insert_import_logs"
on public.import_logs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = import_logs.organization_id
      and p.primary_role in ('admin', 'manager', 'it')
  )
);

drop policy if exists "org_members_read_own_time_entry_audit_logs" on public.time_entry_audit_logs;
create policy "org_members_read_own_time_entry_audit_logs"
on public.time_entry_audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = time_entry_audit_logs.organization_id
      and (
        p.primary_role in ('admin', 'manager', 'super_admin')
        or time_entry_audit_logs.actor_user_id = auth.uid()
        or time_entry_audit_logs.target_user_id = auth.uid()
      )
  )
);

drop policy if exists "org_members_insert_time_entry_audit_logs" on public.time_entry_audit_logs;
create policy "org_members_insert_time_entry_audit_logs"
on public.time_entry_audit_logs
for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = time_entry_audit_logs.organization_id
  )
);

drop policy if exists "org_admins_managers_read_everhour_import_logs" on public.everhour_import_logs;
create policy "org_admins_managers_read_everhour_import_logs"
on public.everhour_import_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = everhour_import_logs.organization_id
      and p.primary_role in ('admin', 'manager', 'it')
  )
);

drop policy if exists "org_admins_managers_insert_everhour_import_logs" on public.everhour_import_logs;
create policy "org_admins_managers_insert_everhour_import_logs"
on public.everhour_import_logs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = everhour_import_logs.organization_id
      and p.primary_role in ('admin', 'manager', 'it')
  )
);
