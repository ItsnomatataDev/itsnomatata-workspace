create table if not exists public.ai_workspace_projects (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  title text not null,
  description text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_workspace_projects_pkey primary key (id),
  constraint ai_workspace_projects_user_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade
);

create index if not exists idx_ai_workspace_projects_user
  on public.ai_workspace_projects (user_id, updated_at desc);

create index if not exists idx_ai_workspace_projects_org
  on public.ai_workspace_projects (organization_id, updated_at desc);

alter table public.ai_workspace_projects enable row level security;

drop policy if exists "users_manage_own_ai_workspace_projects"
  on public.ai_workspace_projects;

create policy "users_manage_own_ai_workspace_projects"
  on public.ai_workspace_projects for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.set_ai_workspace_project_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ai_workspace_projects_updated_at
  on public.ai_workspace_projects;

create trigger trg_ai_workspace_projects_updated_at
  before update on public.ai_workspace_projects
  for each row
  execute function public.set_ai_workspace_project_updated_at();
