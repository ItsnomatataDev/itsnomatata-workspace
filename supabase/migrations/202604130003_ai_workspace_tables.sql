create table if not exists public.ai_conversations (
  id            uuid        not null default gen_random_uuid(),
  organization_id uuid     not null,
  user_id       uuid        not null,
  title         text        null,
  tool_id       text        null,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint ai_conversations_pkey primary key (id),
  constraint ai_conversations_user_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade
);

create index if not exists idx_ai_conversations_user
  on public.ai_conversations (user_id, updated_at desc);

create index if not exists idx_ai_conversations_org
  on public.ai_conversations (organization_id, updated_at desc);

-- 2. Messages (user + assistant turns)
create table if not exists public.ai_messages (
  id              uuid        not null default gen_random_uuid(),
  conversation_id uuid        not null,
  role            text        not null default 'user',       -- 'user' | 'assistant' | 'system'
  content         text        not null default '',
  type            text        not null default 'text',       -- matches AssistantResponseType
  tool_id         text        null,
  data            jsonb       not null default '{}'::jsonb,
  sources         jsonb       not null default '[]'::jsonb,
  actions         jsonb       not null default '[]'::jsonb,
  requires_approval boolean  not null default false,
  approval_id     uuid        null,
  error           boolean     not null default false,
  created_at      timestamptz not null default now(),
  constraint ai_messages_pkey primary key (id),
  constraint ai_messages_conversation_fkey
    foreign key (conversation_id) references public.ai_conversations (id) on delete cascade
);

create index if not exists idx_ai_messages_conversation
  on public.ai_messages (conversation_id, created_at asc);

-- 3. Approvals
create table if not exists public.ai_approvals (
  id              uuid        not null default gen_random_uuid(),
  organization_id uuid        not null,
  conversation_id uuid        null,
  message_id      uuid        null,
  user_id         uuid        not null,                       -- who requested
  reviewer_id     uuid        null,                           -- who approved/rejected
  tool_id         text        null,
  title           text        not null,
  description     text        null,
  status          text        not null default 'pending',     -- 'pending' | 'approved' | 'rejected'
  review_note     text        null,
  payload         jsonb       not null default '{}'::jsonb,   -- the action payload to execute on approval
  reviewed_at     timestamptz null,
  created_at      timestamptz not null default now(),
  constraint ai_approvals_pkey primary key (id),
  constraint ai_approvals_user_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade,
  constraint ai_approvals_reviewer_fkey
    foreign key (reviewer_id) references public.profiles (id) on delete set null,
  constraint ai_approvals_conversation_fkey
    foreign key (conversation_id) references public.ai_conversations (id) on delete set null,
  constraint ai_approvals_message_fkey
    foreign key (message_id) references public.ai_messages (id) on delete set null
);

create index if not exists idx_ai_approvals_org_status
  on public.ai_approvals (organization_id, status, created_at desc);

create index if not exists idx_ai_approvals_user
  on public.ai_approvals (user_id, created_at desc);

create index if not exists idx_ai_approvals_reviewer
  on public.ai_approvals (reviewer_id, created_at desc)
  where reviewer_id is not null;

alter table public.ai_conversations enable row level security;
alter table public.ai_messages     enable row level security;
alter table public.ai_approvals    enable row level security;

drop policy if exists "users_manage_own_ai_conversations" on public.ai_conversations;
create policy "users_manage_own_ai_conversations"
  on public.ai_conversations for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users_manage_own_ai_messages" on public.ai_messages;
create policy "users_manage_own_ai_messages"
  on public.ai_messages for all to authenticated
  using (
    conversation_id in (
      select id from public.ai_conversations where user_id = auth.uid()
    )
  )
  with check (
    conversation_id in (
      select id from public.ai_conversations where user_id = auth.uid()
    )
  );

drop policy if exists "users_read_own_ai_approvals" on public.ai_approvals;
create policy "users_read_own_ai_approvals"
  on public.ai_approvals for select to authenticated
  using (
    user_id = auth.uid()
    or organization_id in (
      select om.organization_id
      from public.organization_members om
      join public.profiles p on p.id = om.user_id
      where om.user_id = auth.uid()
        and om.status = 'active'
        and p.primary_role in ('admin', 'manager')
    )
  );

drop policy if exists "users_insert_own_ai_approvals" on public.ai_approvals;
create policy "users_insert_own_ai_approvals"
  on public.ai_approvals for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "reviewers_update_ai_approvals" on public.ai_approvals;
create policy "reviewers_update_ai_approvals"
  on public.ai_approvals for update to authenticated
  using (
    user_id = auth.uid()
    or organization_id in (
      select om.organization_id
      from public.organization_members om
      join public.profiles p on p.id = om.user_id
      where om.user_id = auth.uid()
        and om.status = 'active'
        and p.primary_role in ('admin', 'manager')
    )
  );

-- ============================================================
-- Updated_at trigger
-- ============================================================

create or replace function public.update_ai_conversation_timestamp()
returns trigger as $$
begin
  update public.ai_conversations
  set updated_at = now()
  where id = NEW.conversation_id;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_ai_messages_update_conversation on public.ai_messages;
create trigger trg_ai_messages_update_conversation
  after insert on public.ai_messages
  for each row
  execute function public.update_ai_conversation_timestamp();