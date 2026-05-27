create table if not exists public.ai_generated_files (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid null references public.profiles(id) on delete set null,
  conversation_id uuid null,
  file_name text not null,
  file_type text not null,
  mime_type text null,
  storage_provider text not null default 'supabase',
  storage_path text null,
  url text null,
  download_url text null,
  source_type text not null default 'ai_output',
  source_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_generated_files_pkey primary key (id),
  constraint ai_generated_files_file_type_check
    check (file_type in ('pdf', 'txt', 'md', 'json', 'csv', 'html', 'other'))
);

create index if not exists idx_ai_generated_files_org_created
  on public.ai_generated_files (organization_id, created_at desc);

create table if not exists public.ai_generated_images (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid null references public.profiles(id) on delete set null,
  conversation_id uuid null,
  prompt text not null,
  improved_prompt text null,
  model text null,
  image_url text null,
  download_url text null,
  storage_provider text not null default 'supabase',
  storage_path text null,
  width integer null,
  height integer null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_generated_images_pkey primary key (id)
);

create index if not exists idx_ai_generated_images_org_created
  on public.ai_generated_images (organization_id, created_at desc);

create table if not exists public.ai_file_logs (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid null references public.profiles(id) on delete set null,
  file_id uuid null references public.ai_generated_files(id) on delete set null,
  image_id uuid null references public.ai_generated_images(id) on delete set null,
  action text not null,
  status text not null default 'success',
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_file_logs_pkey primary key (id),
  constraint ai_file_logs_status_check
    check (status in ('success', 'failed', 'pending', 'blocked'))
);

create index if not exists idx_ai_file_logs_org_created
  on public.ai_file_logs (organization_id, created_at desc);

alter table public.ai_generated_files enable row level security;
alter table public.ai_generated_images enable row level security;
alter table public.ai_file_logs enable row level security;

drop policy if exists "members_view_ai_generated_files" on public.ai_generated_files;
create policy "members_view_ai_generated_files"
  on public.ai_generated_files for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = ai_generated_files.organization_id
        and om.status = 'active'
    )
  );

drop policy if exists "members_insert_ai_generated_files" on public.ai_generated_files;
create policy "members_insert_ai_generated_files"
  on public.ai_generated_files for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = ai_generated_files.organization_id
        and om.status = 'active'
    )
  );

drop policy if exists "members_view_ai_generated_images" on public.ai_generated_images;
create policy "members_view_ai_generated_images"
  on public.ai_generated_images for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = ai_generated_images.organization_id
        and om.status = 'active'
    )
  );

drop policy if exists "members_insert_ai_generated_images" on public.ai_generated_images;
create policy "members_insert_ai_generated_images"
  on public.ai_generated_images for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = ai_generated_images.organization_id
        and om.status = 'active'
    )
  );

drop policy if exists "members_view_ai_file_logs" on public.ai_file_logs;
create policy "members_view_ai_file_logs"
  on public.ai_file_logs for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = ai_file_logs.organization_id
        and om.status = 'active'
        and om.role in ('admin', 'manager', 'org_admin', 'super_admin')
    )
  );

drop policy if exists "members_insert_ai_file_logs" on public.ai_file_logs;
create policy "members_insert_ai_file_logs"
  on public.ai_file_logs for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = ai_file_logs.organization_id
        and om.status = 'active'
    )
  );
