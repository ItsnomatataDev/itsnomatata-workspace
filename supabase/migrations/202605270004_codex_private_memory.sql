create table if not exists public.ai_memory_items (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id text null,
  conversation_id uuid null,
  scope text not null default 'user',
  memory_type text not null default 'summary',
  title text not null,
  content text not null,
  importance integer not null default 3,
  pinned boolean not null default false,
  source text not null default 'chat',
  source_message_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  last_used_at timestamptz null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_memory_items_pkey primary key (id),
  constraint ai_memory_items_scope_check
    check (scope in ('user', 'project', 'conversation')),
  constraint ai_memory_items_memory_type_check
    check (memory_type in ('preference', 'fact', 'decision', 'task', 'summary', 'instruction', 'profile')),
  constraint ai_memory_items_importance_check
    check (importance between 1 and 5)
);

create index if not exists idx_ai_memory_items_user_recent
  on public.ai_memory_items (organization_id, user_id, updated_at desc);

create index if not exists idx_ai_memory_items_project_recent
  on public.ai_memory_items (organization_id, user_id, project_id, updated_at desc)
  where project_id is not null;

create index if not exists idx_ai_memory_items_pinned
  on public.ai_memory_items (organization_id, user_id, pinned, importance desc);

create or replace function public.touch_ai_memory_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_ai_memory_items_updated_at on public.ai_memory_items;
create trigger trg_touch_ai_memory_items_updated_at
  before update on public.ai_memory_items
  for each row
  execute function public.touch_ai_memory_items_updated_at();

alter table public.ai_memory_items enable row level security;

drop policy if exists "users_manage_own_ai_memory_items" on public.ai_memory_items;
create policy "users_manage_own_ai_memory_items"
  on public.ai_memory_items for all to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = ai_memory_items.organization_id
        and om.status = 'active'
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = ai_memory_items.organization_id
        and om.status = 'active'
    )
  );
