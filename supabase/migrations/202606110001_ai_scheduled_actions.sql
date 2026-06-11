create table if not exists public.ai_scheduled_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid null references public.profiles(id) on delete set null,
  tool_id text not null,
  payload jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  last_error text null,
  executed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_scheduled_actions_due_idx
  on public.ai_scheduled_actions (status, scheduled_for)
  where status = 'pending';

create index if not exists ai_scheduled_actions_org_user_idx
  on public.ai_scheduled_actions (organization_id, target_user_id, scheduled_for desc);

alter table public.ai_scheduled_actions enable row level security;

drop policy if exists "ai_scheduled_actions_read_access" on public.ai_scheduled_actions;
create policy "ai_scheduled_actions_read_access"
on public.ai_scheduled_actions for select
to authenticated
using (
  organization_id = (
    select p.organization_id from public.profiles p where p.id = auth.uid()
  )
  and (
    requested_by = auth.uid()
    or target_user_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = ai_scheduled_actions.organization_id
        and p.primary_role::text in ('admin', 'org_admin', 'superadmin', 'super_admin', 'it-superadmin', 'manager', 'hr', 'it')
    )
  )
);

drop policy if exists "ai_scheduled_actions_insert_own_org" on public.ai_scheduled_actions;
create policy "ai_scheduled_actions_insert_own_org"
on public.ai_scheduled_actions for insert
to authenticated
with check (
  organization_id = (
    select p.organization_id from public.profiles p where p.id = auth.uid()
  )
  and requested_by = auth.uid()
);
