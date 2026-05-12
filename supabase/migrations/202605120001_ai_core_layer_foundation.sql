
create extension if not exists vector;


create table if not exists public.ai_assistants (
  id              uuid        not null default gen_random_uuid(),
  organization_id uuid        not null,
  name            text        not null,
  assistant_type  text        not null,
  description     text        null,
  system_prompt   text        null,
  enabled         boolean     not null default true,
  settings        jsonb       not null default '{}'::jsonb,
  created_by      uuid        not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint ai_assistants_pkey primary key (id),
  constraint ai_assistants_org_fkey
    foreign key (organization_id) references public.organizations (id) on delete cascade,
  constraint ai_assistants_creator_fkey
    foreign key (created_by) references public.profiles (id) on delete cascade,
  constraint ai_assistants_type_check check (assistant_type in (
    'internal_workspace',
    'website_chat', 
    'whatsapp_support',
    'admin_command_center',
    'client_company_assistant'
  ))
);

create index if not exists idx_ai_assistants_org_type on public.ai_assistants (organization_id, assistant_type);
create index if not exists idx_ai_assistants_enabled on public.ai_assistants (enabled) where enabled = true;

-- Create table for AI conversations
alter table public.ai_conversations 
add column if not exists assistant_id uuid null,
add column if not exists customer_id uuid null,
add column if not exists channel text not null default 'internal',
add column if not exists status text not null default 'active',
add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Add foreign key constraint for assistant_id in conversations
alter table if exists public.ai_conversations 
  add constraint if not exists ai_conversations_assistant_fkey 
  foreign key (assistant_id) references public.ai_assistants(id) on delete set null;

-- Add check constraint for channel in conversations
alter table public.ai_conversations 
add constraint if not exists ai_conversations_channel_check 
  check (channel in ('internal', 'website', 'whatsapp', 'email'));

alter table public.ai_conversations
add constraint if not exists ai_conversations_status_check
  check (status in ('active', 'archived', 'closed'));

create index if not exists idx_ai_conversations_assistant on public.ai_conversations (assistant_id, updated_at desc);
create index if not exists idx_ai_conversations_customer on public.ai_conversations (customer_id, updated_at desc);
create index if not exists idx_ai_conversations_channel on public.ai_conversations (channel, updated_at desc);
create index if not exists idx_ai_conversations_status on public.ai_conversations (status, updated_at desc);


alter table public.ai_messages
add column if not exists organization_id uuid not null default (select organization_id from public.profiles where id = auth.uid()),
add column if not exists sender_type text not null default 'employee',
add column if not exists sender_id uuid null,
add column if not exists metadata jsonb not null default '{}'::jsonb,
add column if not exists role text not null default 'user';

alter table public.ai_messages
add constraint if not exists ai_messages_org_fkey
  foreign key (organization_id) references public.organizations (id) on delete cascade;

alter table public.ai_messages
add constraint if not exists ai_messages_sender_type_check
  check (sender_type in ('employee', 'customer', 'ai'));

alter table public.ai_messages
add constraint if not exists ai_messages_role_check
  check (role in ('user', 'assistant', 'system', 'tool'));

create index if not exists idx_ai_messages_org on public.ai_messages (organization_id, created_at desc);
create index if not exists idx_ai_messages_sender on public.ai_messages (sender_type, sender_id, created_at desc);

create table if not exists public.ai_knowledge_sources (
  id              uuid        not null default gen_random_uuid(),
  organization_id uuid        not null,
  title           text        not null,
  source_type     text        not null,
  file_url        text        null,
  raw_text        text        null,
  metadata        jsonb       not null default '{}'::jsonb,
  uploaded_by     uuid        not null,
  created_at      timestamptz not null default now(),
  constraint ai_knowledge_sources_pkey primary key (id),
  constraint ai_knowledge_sources_org_fkey
    foreign key (organization_id) references public.organizations (id) on delete cascade,
  constraint ai_knowledge_sources_uploader_fkey
    foreign key (uploaded_by) references public.profiles (id) on delete cascade,
  constraint ai_knowledge_sources_type_check check (source_type in (
    'document',
    'faq',
    'website', 
    'policy',
    'sop',
    'support_article'
  )),
  constraint ai_knowledge_sources_content_check check (
    (file_url is not null) or (raw_text is not null)
  )
);

create index if not exists idx_ai_knowledge_sources_org on public.ai_knowledge_sources (organization_id, source_type);
create index if not exists idx_ai_knowledge_sources_type on public.ai_knowledge_sources (source_type);


create table if not exists public.ai_knowledge_chunks (
  id              uuid        not null default gen_random_uuid(),
  source_id       uuid        not null,
  organization_id uuid        not null,
  chunk_text      text        not null,
  embedding       vector(1536), 
  metadata        jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  constraint ai_knowledge_chunks_pkey primary key (id),
  constraint ai_knowledge_chunks_source_fkey
    foreign key (source_id) references public.ai_knowledge_sources (id) on delete cascade,
  constraint ai_knowledge_chunks_org_fkey
    foreign key (organization_id) references public.organizations (id) on delete cascade
);

create index if not exists idx_ai_knowledge_chunks_embedding 
  on public.ai_knowledge_chunks using ivfflat (embedding vector_cosine_ops);

create index if not exists idx_ai_knowledge_chunks_source on public.ai_knowledge_chunks (source_id);
create index if not exists idx_ai_knowledge_chunks_org on public.ai_knowledge_chunks (organization_id);


create table if not exists public.ai_tools (
  id              uuid        not null default gen_random_uuid(),
  organization_id uuid        null, -- null for global tools
  name            text        not null,
  tool_key        text        not null unique,
  description     text        null,
  enabled         boolean     not null default true,
  settings        jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  constraint ai_tools_pkey primary key (id),
  constraint ai_tools_org_fkey
    foreign key (organization_id) references public.organizations (id) on delete cascade
);

create index if not exists idx_ai_tools_org on public.ai_tools (organization_id, enabled);
create index if not exists idx_ai_tools_key on public.ai_tools (tool_key);
create index if not exists idx_ai_tools_enabled on public.ai_tools (enabled) where enabled = true;

create table if not exists public.ai_actions (
  id              uuid        not null default gen_random_uuid(),
  organization_id uuid        not null,
  conversation_id uuid        null,
  action_type     text        not null,
  requested_by    uuid        not null,
  target_type     text        null,
  target_id       uuid        null,
  payload         jsonb       not null default '{}'::jsonb,
  status          text        not null default 'pending',
  requires_approval boolean   not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint ai_actions_pkey primary key (id),
  constraint ai_actions_org_fkey
    foreign key (organization_id) references public.organizations (id) on delete cascade,
  constraint ai_actions_conversation_fkey
    foreign key (conversation_id) references public.ai_conversations (id) on delete set null,
  constraint ai_actions_requester_fkey
    foreign key (requested_by) references public.profiles (id) on delete cascade,
  constraint ai_actions_status_check check (status in (
    'pending',
    'approved', 
    'rejected',
    'executed',
    'failed'
  ))
);

create index if not exists idx_ai_actions_org_status on public.ai_actions (organization_id, status, created_at desc);
create index if not exists idx_ai_actions_conversation on public.ai_actions (conversation_id, created_at desc);
create index if not exists idx_ai_actions_requester on public.ai_actions (requested_by, created_at desc);
create index if not exists idx_ai_actions_approval on public.ai_actions (requires_approval, status, created_at desc) where requires_approval = true;


create table if not exists public.ai_action_approvals (
  id              uuid        not null default gen_random_uuid(),
  action_id       uuid        not null,
  organization_id uuid        not null,
  approved_by     uuid        null,
  status          text        not null default 'pending',
  notes           text        null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint ai_action_approvals_pkey primary key (id),
  constraint ai_action_approvals_action_fkey
    foreign key (action_id) references public.ai_actions (id) on delete cascade,
  constraint ai_action_approvals_org_fkey
    foreign key (organization_id) references public.organizations (id) on delete cascade,
  constraint ai_action_approvals_approver_fkey
    foreign key (approved_by) references public.profiles (id) on delete set null,
  constraint ai_action_approvals_status_check check (status in (
    'pending',
    'approved',
    'rejected'
  ))
);

create index if not exists idx_ai_action_approvals_action on public.ai_action_approvals (action_id);
create index if not exists idx_ai_action_approvals_org_status on public.ai_action_approvals (organization_id, status, created_at desc);
create index if not exists idx_ai_action_approvals_approver on public.ai_action_approvals (approved_by, created_at desc);


create table if not exists public.ai_audit_logs (
  id              uuid        not null default gen_random_uuid(),
  organization_id uuid        not null,
  actor_id        uuid        null,
  actor_type      text        not null,
  event_type      text        not null,
  reference_type  text        null,
  reference_id    uuid        null,
  payload         jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  constraint ai_audit_logs_pkey primary key (id),
  constraint ai_audit_logs_org_fkey
    foreign key (organization_id) references public.organizations (id) on delete cascade,
  constraint ai_audit_logs_actor_fkey
    foreign key (actor_id) references public.profiles (id) on delete set null,
  constraint ai_audit_logs_actor_type_check check (actor_type in (
    'employee',
    'customer',
    'ai',
    'system'
  ))
);

create index if not exists idx_ai_audit_logs_org on public.ai_audit_logs (organization_id, created_at desc);
create index if not exists idx_ai_audit_logs_actor on public.ai_audit_logs (actor_type, actor_id, created_at desc);
create index if not exists idx_ai_audit_logs_event on public.ai_audit_logs (event_type, created_at desc);
create index if not exists idx_ai_audit_logs_reference on public.ai_audit_logs (reference_type, reference_id, created_at desc);


create table if not exists public.ai_customer_profiles (
  id              uuid        not null default gen_random_uuid(),
  organization_id uuid        not null,
  full_name       text        not null,
  email           text        null,
  phone           text        null,
  company         text        null,
  preferences     jsonb       not null default '{}'::jsonb,
  sentiment_score decimal(3,2) null,
  metadata        jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint ai_customer_profiles_pkey primary key (id),
  constraint ai_customer_profiles_org_fkey
    foreign key (organization_id) references public.organizations (id) on delete cascade,
  constraint ai_customer_profiles_email_unique unique (organization_id, email),
  constraint ai_customer_profiles_phone_unique unique (organization_id, phone),
  constraint ai_customer_profiles_sentiment_check check (
    sentiment_score is null or (sentiment_score >= -1.0 and sentiment_score <= 1.0)
  )
);

create index if not exists idx_ai_customer_profiles_org on public.ai_customer_profiles (organization_id, created_at desc);
create index if not exists idx_ai_customer_profiles_email on public.ai_customer_profiles (email) where email is not null;
create index if not exists idx_ai_customer_profiles_phone on public.ai_customer_profiles (phone) where phone is not null;
create index if not exists idx_ai_customer_profiles_company on public.ai_customer_profiles (company) where company is not null;

alter table public.ai_conversations 
add constraint if not exists ai_conversations_customer_fkey
  foreign key (customer_id) references public.ai_customer_profiles (id) on delete set null;

create table if not exists public.ai_channel_integrations (
  id              uuid        not null default gen_random_uuid(),
  organization_id uuid        not null,
  channel_type    text        not null,
  provider        text        not null,
  configuration   jsonb       not null default '{}'::jsonb,
  enabled         boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint ai_channel_integrations_pkey primary key (id),
  constraint ai_channel_integrations_org_fkey
    foreign key (organization_id) references public.organizations (id) on delete cascade,
  constraint ai_channel_integrations_type_check check (channel_type in (
    'whatsapp',
    'website',
    'email'
  ))
);

create index if not exists idx_ai_channel_integrations_org on public.ai_channel_integrations (organization_id, channel_type);
create index if not exists idx_ai_channel_integrations_enabled on public.ai_channel_integrations (enabled, channel_type) where enabled = true;

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;


create trigger if not exists trg_ai_assistants_updated_at
  before update on public.ai_assistants
  for each row
  execute function public.update_updated_at_column();

create trigger if not exists trg_ai_actions_updated_at
  before update on public.ai_actions
  for each row
  execute function public.update_updated_at_column();

create trigger if not exists trg_ai_action_approvals_updated_at
  before update on public.ai_action_approvals
  for each row
  execute function public.update_updated_at_column();

create trigger if not exists trg_ai_customer_profiles_updated_at
  before update on public.ai_customer_profiles
  for each row
  execute function public.update_updated_at_column();

create trigger if not exists trg_ai_channel_integrations_updated_at
  before update on public.ai_channel_integrations
  for each row
  execute function public.update_updated_at_column();


alter table if exists public.ai_assistants enable row level security;
alter table if exists public.ai_knowledge_sources enable row level security;
alter table if exists public.ai_knowledge_chunks enable row level security;
alter table if exists public.ai_tools enable row level security;
alter table if exists public.ai_actions enable row level security;
alter table if exists public.ai_action_approvals enable row level security;
alter table if exists public.ai_audit_logs enable row level security;
alter table if exists public.ai_customer_profiles enable row level security;
alter table if exists public.ai_channel_integrations enable row level security;

