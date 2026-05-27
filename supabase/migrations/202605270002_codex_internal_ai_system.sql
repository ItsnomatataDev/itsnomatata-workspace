create table if not exists public.ai_documents (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_name text not null,
  file_type text not null,
  source text not null default 'upload',
  source_url text null,
  uploaded_by uuid null references public.profiles(id) on delete set null,
  department text null,
  module text null,
  access_level text not null default 'internal',
  status text not null default 'pending',
  summary_short text null,
  summary_detailed text null,
  tags jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_documents_pkey primary key (id),
  constraint ai_documents_status_check
    check (status in ('pending', 'processing', 'trained', 'failed')),
  constraint ai_documents_access_level_check
    check (access_level in ('private', 'department', 'internal', 'management', 'admin'))
);

create index if not exists idx_ai_documents_org_status
  on public.ai_documents (organization_id, status, created_at desc);

create index if not exists idx_ai_documents_org_department
  on public.ai_documents (organization_id, department, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_documents_pkey'
      and conrelid = 'public.ai_documents'::regclass
  ) then
    alter table public.ai_documents add constraint ai_documents_pkey primary key (id);
  end if;
end $$;

create table if not exists public.ai_document_chunks (
  id uuid not null default gen_random_uuid(),
  document_id uuid not null references public.ai_documents(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  chunk_index integer not null,
  chunk_text text not null,
  chunk_summary text null,
  embedding_id text null,
  access_level text not null default 'internal',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_document_chunks_pkey primary key (id),
  constraint ai_document_chunks_access_level_check
    check (access_level in ('private', 'department', 'internal', 'management', 'admin'))
);

create index if not exists idx_ai_document_chunks_document
  on public.ai_document_chunks (document_id, chunk_index);

create index if not exists idx_ai_document_chunks_org
  on public.ai_document_chunks (organization_id, created_at desc);

create table if not exists public.team_members (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  role text not null,
  department text null,
  email text null,
  phone text null,
  manager_id uuid null references public.team_members(id) on delete set null,
  permissions jsonb not null default '[]'::jsonb,
  active_status text not null default 'active',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_members_pkey primary key (id),
  constraint team_members_active_status_check
    check (active_status in ('active', 'inactive', 'suspended'))
);

create index if not exists idx_team_members_org_department
  on public.team_members (organization_id, department, active_status);

create table if not exists public.ai_tool_logs (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid null references public.profiles(id) on delete set null,
  tool_name text not null,
  input_summary text null,
  status text not null default 'success',
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_tool_logs_pkey primary key (id),
  constraint ai_tool_logs_status_check
    check (status in ('success', 'failed', 'blocked', 'fallback'))
);

create index if not exists idx_ai_tool_logs_org_created
  on public.ai_tool_logs (organization_id, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_documents_pkey'
      and conrelid = 'public.ai_documents'::regclass
  ) then
    alter table public.ai_documents add constraint ai_documents_pkey primary key (id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_document_chunks_pkey'
      and conrelid = 'public.ai_document_chunks'::regclass
  ) then
    alter table public.ai_document_chunks add constraint ai_document_chunks_pkey primary key (id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'team_members_pkey'
      and conrelid = 'public.team_members'::regclass
  ) then
    alter table public.team_members add constraint team_members_pkey primary key (id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_tool_logs_pkey'
      and conrelid = 'public.ai_tool_logs'::regclass
  ) then
    alter table public.ai_tool_logs add constraint ai_tool_logs_pkey primary key (id);
  end if;
end $$;

alter table public.ai_messages
  add column if not exists tool_used text null;

alter table public.ai_documents enable row level security;
alter table public.ai_document_chunks enable row level security;
alter table public.team_members enable row level security;
alter table public.ai_tool_logs enable row level security;

drop policy if exists "members_view_ai_documents" on public.ai_documents;
create policy "members_view_ai_documents"
  on public.ai_documents for select to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = ai_documents.organization_id
        and om.status = 'active'
    )
  );

drop policy if exists "members_insert_ai_documents" on public.ai_documents;
create policy "members_insert_ai_documents"
  on public.ai_documents for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = ai_documents.organization_id
        and om.status = 'active'
    )
  );

drop policy if exists "members_view_ai_document_chunks" on public.ai_document_chunks;
create policy "members_view_ai_document_chunks"
  on public.ai_document_chunks for select to authenticated
  using (
    exists (
      select 1
      from public.ai_documents d
      join public.organization_members om
        on om.organization_id = d.organization_id
      where d.id = ai_document_chunks.document_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

drop policy if exists "members_view_team_members" on public.team_members;
create policy "members_view_team_members"
  on public.team_members for select to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = team_members.organization_id
        and om.status = 'active'
    )
  );

drop policy if exists "members_insert_ai_tool_logs" on public.ai_tool_logs;
create policy "members_insert_ai_tool_logs"
  on public.ai_tool_logs for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = ai_tool_logs.organization_id
        and om.status = 'active'
    )
  );

drop policy if exists "members_view_ai_tool_logs" on public.ai_tool_logs;
create policy "members_view_ai_tool_logs"
  on public.ai_tool_logs for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = ai_tool_logs.organization_id
        and om.status = 'active'
        and om.role in ('admin', 'manager', 'org_admin', 'super_admin')
    )
  );
