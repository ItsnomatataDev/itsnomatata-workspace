create or replace function public.is_ai_automation_reviewer(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = target_organization_id
      and coalesce(p.account_status, 'active') = 'active'
      and coalesce(p.is_suspended, false) = false
      and p.primary_role in ('admin', 'manager', 'it', 'superadmin', 'it-superadmin')
  );
$$;

grant execute on function public.is_ai_automation_reviewer(uuid) to authenticated;

create table if not exists public.automation_flows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  name text not null,
  slug text not null,
  description text null,
  webhook_url text null,
  status text not null default 'draft',
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automation_flows_status_check
    check (status in ('draft', 'active', 'paused', 'disabled', 'archived')),
  constraint automation_flows_org_slug_unique unique (organization_id, slug)
);

create index if not exists automation_flows_org_status_idx
  on public.automation_flows (organization_id, status, created_at desc);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  automation_flow_id uuid null references public.automation_flows(id) on delete set null,
  project_id uuid null references public.projects(id) on delete set null,
  workflow_name text not null,
  status text not null default 'pending',
  message text null,
  triggered_by uuid null references public.profiles(id) on delete set null,
  started_at timestamptz null,
  completed_at timestamptz null,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  error_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint automation_runs_status_check
    check (status in ('pending', 'running', 'success', 'failed', 'cancelled', 'approval_required'))
);

create index if not exists automation_runs_org_created_idx
  on public.automation_runs (organization_id, created_at desc);
create index if not exists automation_runs_flow_created_idx
  on public.automation_runs (automation_flow_id, created_at desc);

create table if not exists public.ai_automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  module text not null,
  source text not null,
  allowed_actions text[] not null default '{}'::text[],
  risk_level text not null default 'needs_approval',
  status text not null default 'draft',
  requires_approval boolean not null default true,
  auto_execute boolean not null default false,
  created_by uuid null references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_automation_rules_risk_check
    check (risk_level in ('safe', 'needs_approval', 'admin_only')),
  constraint ai_automation_rules_status_check
    check (status in ('draft', 'approved', 'active', 'paused', 'disabled', 'archived'))
);

create index if not exists ai_automation_rules_org_module_idx
  on public.ai_automation_rules (organization_id, module, status);

create table if not exists public.ai_automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid null references public.ai_automation_rules(id) on delete set null,
  automation_flow_id uuid null references public.automation_flows(id) on delete set null,
  source text not null,
  requested_by uuid null references public.profiles(id) on delete set null,
  role text null,
  department text null,
  status text not null default 'pending',
  summary text null,
  allowed_actions text[] not null default '{}'::text[],
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint ai_automation_runs_status_check
    check (status in ('pending', 'running', 'success', 'failed', 'approval_required'))
);

create index if not exists ai_automation_runs_org_created_idx
  on public.ai_automation_runs (organization_id, created_at desc);

create table if not exists public.ai_task_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  automation_run_id uuid null references public.ai_automation_runs(id) on delete set null,
  source text not null,
  source_entity_type text null,
  source_entity_id uuid null,
  suggested_title text not null,
  suggested_description text null,
  suggested_priority text not null default 'medium',
  suggested_assignee uuid null references public.profiles(id) on delete set null,
  suggested_due_date timestamptz null,
  suggested_department text null,
  requires_approval boolean not null default true,
  reason text not null,
  confidence numeric(5, 2) null,
  status text not null default 'pending',
  reviewed_by uuid null references public.profiles(id) on delete set null,
  reviewed_at timestamptz null,
  created_task_id uuid null references public.tasks(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ai_task_suggestions_priority_check
    check (suggested_priority in ('low', 'medium', 'high', 'urgent')),
  constraint ai_task_suggestions_status_check
    check (status in ('pending', 'approved', 'rejected', 'created', 'expired'))
);

create index if not exists ai_task_suggestions_org_status_idx
  on public.ai_task_suggestions (organization_id, status, created_at desc);

create table if not exists public.ai_document_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid null,
  document_type text null,
  title text not null,
  summary text not null,
  action_items jsonb not null default '[]'::jsonb,
  key_decisions jsonb not null default '[]'::jsonb,
  deadlines jsonb not null default '[]'::jsonb,
  generated_by uuid null references public.profiles(id) on delete set null,
  automation_run_id uuid null references public.ai_automation_runs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_document_summaries_org_created_idx
  on public.ai_document_summaries (organization_id, created_at desc);

create table if not exists public.ai_chat_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid null references public.chat_conversations(id) on delete set null,
  message_id uuid null references public.chat_messages(id) on delete set null,
  suggestion_type text not null,
  title text not null,
  body text null,
  recommended_action jsonb not null default '{}'::jsonb,
  risk_level text not null default 'safe',
  status text not null default 'pending',
  reason text not null,
  created_by uuid null references public.profiles(id) on delete set null,
  automation_run_id uuid null references public.ai_automation_runs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_chat_suggestions_risk_check
    check (risk_level in ('safe', 'needs_approval', 'admin_only')),
  constraint ai_chat_suggestions_status_check
    check (status in ('pending', 'approved', 'rejected', 'completed', 'expired'))
);

create index if not exists ai_chat_suggestions_org_status_idx
  on public.ai_chat_suggestions (organization_id, status, created_at desc);

create table if not exists public.ai_report_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_id uuid null,
  title text not null,
  summary text not null,
  highlights jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  generated_by uuid null references public.profiles(id) on delete set null,
  automation_run_id uuid null references public.ai_automation_runs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_report_summaries_org_created_idx
  on public.ai_report_summaries (organization_id, created_at desc);

create table if not exists public.ai_activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid null references public.profiles(id) on delete set null,
  source text not null,
  action text not null,
  status text not null default 'success',
  risk_level text not null default 'safe',
  requires_approval boolean not null default false,
  reason text null,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text null,
  created_at timestamptz not null default now(),
  constraint ai_activity_logs_status_check
    check (status in ('success', 'failed', 'blocked', 'approval_required')),
  constraint ai_activity_logs_risk_check
    check (risk_level in ('safe', 'needs_approval', 'admin_only'))
);

create index if not exists ai_activity_logs_org_created_idx
  on public.ai_activity_logs (organization_id, created_at desc);

alter table public.automation_flows enable row level security;
alter table public.automation_runs enable row level security;
alter table public.ai_automation_rules enable row level security;
alter table public.ai_automation_runs enable row level security;
alter table public.ai_task_suggestions enable row level security;
alter table public.ai_document_summaries enable row level security;
alter table public.ai_chat_suggestions enable row level security;
alter table public.ai_report_summaries enable row level security;
alter table public.ai_activity_logs enable row level security;

drop policy if exists "ai_reviewers_manage_automation_flows" on public.automation_flows;
create policy "ai_reviewers_manage_automation_flows"
on public.automation_flows for all to authenticated
using (public.is_ai_automation_reviewer(organization_id))
with check (public.is_ai_automation_reviewer(organization_id));

drop policy if exists "ai_reviewers_read_automation_runs" on public.automation_runs;
create policy "ai_reviewers_read_automation_runs"
on public.automation_runs for select to authenticated
using (public.is_ai_automation_reviewer(organization_id));

drop policy if exists "ai_reviewers_insert_automation_runs" on public.automation_runs;
create policy "ai_reviewers_insert_automation_runs"
on public.automation_runs for insert to authenticated
with check (public.is_ai_automation_reviewer(organization_id));

drop policy if exists "ai_reviewers_manage_ai_automation_rules" on public.ai_automation_rules;
create policy "ai_reviewers_manage_ai_automation_rules"
on public.ai_automation_rules for all to authenticated
using (public.is_ai_automation_reviewer(organization_id))
with check (public.is_ai_automation_reviewer(organization_id));

drop policy if exists "ai_reviewers_read_ai_automation_runs" on public.ai_automation_runs;
create policy "ai_reviewers_read_ai_automation_runs"
on public.ai_automation_runs for select to authenticated
using (public.is_ai_automation_reviewer(organization_id) or requested_by = auth.uid());

drop policy if exists "users_insert_own_ai_automation_runs" on public.ai_automation_runs;
create policy "users_insert_own_ai_automation_runs"
on public.ai_automation_runs for insert to authenticated
with check (requested_by = auth.uid() or public.is_ai_automation_reviewer(organization_id));

drop policy if exists "ai_reviewers_manage_ai_task_suggestions" on public.ai_task_suggestions;
create policy "ai_reviewers_manage_ai_task_suggestions"
on public.ai_task_suggestions for all to authenticated
using (public.is_ai_automation_reviewer(organization_id) or created_by = auth.uid() or suggested_assignee = auth.uid())
with check (public.is_ai_automation_reviewer(organization_id) or created_by = auth.uid());

drop policy if exists "ai_reviewers_read_ai_document_summaries" on public.ai_document_summaries;
create policy "ai_reviewers_read_ai_document_summaries"
on public.ai_document_summaries for select to authenticated
using (public.is_ai_automation_reviewer(organization_id) or generated_by = auth.uid());

drop policy if exists "ai_reviewers_insert_ai_document_summaries" on public.ai_document_summaries;
create policy "ai_reviewers_insert_ai_document_summaries"
on public.ai_document_summaries for insert to authenticated
with check (public.is_ai_automation_reviewer(organization_id) or generated_by = auth.uid());

drop policy if exists "ai_reviewers_manage_ai_chat_suggestions" on public.ai_chat_suggestions;
create policy "ai_reviewers_manage_ai_chat_suggestions"
on public.ai_chat_suggestions for all to authenticated
using (public.is_ai_automation_reviewer(organization_id) or created_by = auth.uid())
with check (public.is_ai_automation_reviewer(organization_id) or created_by = auth.uid());

drop policy if exists "ai_reviewers_read_ai_report_summaries" on public.ai_report_summaries;
create policy "ai_reviewers_read_ai_report_summaries"
on public.ai_report_summaries for select to authenticated
using (public.is_ai_automation_reviewer(organization_id) or generated_by = auth.uid());

drop policy if exists "ai_reviewers_insert_ai_report_summaries" on public.ai_report_summaries;
create policy "ai_reviewers_insert_ai_report_summaries"
on public.ai_report_summaries for insert to authenticated
with check (public.is_ai_automation_reviewer(organization_id) or generated_by = auth.uid());

drop policy if exists "ai_reviewers_read_ai_activity_logs" on public.ai_activity_logs;
create policy "ai_reviewers_read_ai_activity_logs"
on public.ai_activity_logs for select to authenticated
using (public.is_ai_automation_reviewer(organization_id) or user_id = auth.uid());

drop policy if exists "users_insert_own_ai_activity_logs" on public.ai_activity_logs;
create policy "users_insert_own_ai_activity_logs"
on public.ai_activity_logs for insert to authenticated
with check (user_id = auth.uid() or public.is_ai_automation_reviewer(organization_id));

grant select, insert, update, delete on public.automation_flows to authenticated;
grant select, insert on public.automation_runs to authenticated;
grant select, insert, update, delete on public.ai_automation_rules to authenticated;
grant select, insert on public.ai_automation_runs to authenticated;
grant select, insert, update on public.ai_task_suggestions to authenticated;
grant select, insert on public.ai_document_summaries to authenticated;
grant select, insert, update on public.ai_chat_suggestions to authenticated;
grant select, insert on public.ai_report_summaries to authenticated;
grant select, insert on public.ai_activity_logs to authenticated;
