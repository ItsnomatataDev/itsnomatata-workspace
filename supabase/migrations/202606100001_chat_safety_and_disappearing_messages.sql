alter table public.chat_conversations
  add column if not exists disappearing_seconds integer
  check (
    disappearing_seconds is null
    or disappearing_seconds in (3600, 86400, 604800, 2592000)
  );

alter table public.chat_messages
  add column if not exists expires_at timestamptz;

create index if not exists chat_messages_expires_at_idx
  on public.chat_messages (expires_at)
  where expires_at is not null;

create table if not exists public.chat_user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.chat_conversations(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint chat_user_blocks_no_self_block check (blocker_id <> blocked_id),
  constraint chat_user_blocks_unique unique (blocker_id, blocked_id)
);

create index if not exists chat_user_blocks_blocker_idx
  on public.chat_user_blocks (blocker_id, created_at desc);

create index if not exists chat_user_blocks_blocked_idx
  on public.chat_user_blocks (blocked_id);

alter table public.chat_user_blocks enable row level security;

drop policy if exists "Users can view own chat blocks" on public.chat_user_blocks;
create policy "Users can view own chat blocks"
on public.chat_user_blocks
for select
to authenticated
using (blocker_id = auth.uid() or blocked_id = auth.uid());

drop policy if exists "Users can create own chat blocks" on public.chat_user_blocks;
create policy "Users can create own chat blocks"
on public.chat_user_blocks
for insert
to authenticated
with check (blocker_id = auth.uid());

drop policy if exists "Users can remove own chat blocks" on public.chat_user_blocks;
create policy "Users can remove own chat blocks"
on public.chat_user_blocks
for delete
to authenticated
using (blocker_id = auth.uid());

grant all on public.chat_user_blocks to authenticated;

drop policy if exists "Conversation members can update disappearing messages" on public.chat_conversations;
create policy "Conversation members can update disappearing messages"
on public.chat_conversations
for update
to authenticated
using (public.user_is_conversation_member(id))
with check (public.user_is_conversation_member(id));

drop policy if exists "Users can edit own chat messages" on public.chat_messages;
create policy "Users can edit own chat messages"
on public.chat_messages
for update
to authenticated
using (
  sender_id = auth.uid()
  and is_deleted = false
  and exists (
    select 1
    from public.chat_conversation_members ccm
    where ccm.conversation_id = chat_messages.conversation_id
      and ccm.user_id = auth.uid()
  )
)
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.chat_conversation_members ccm
    where ccm.conversation_id = chat_messages.conversation_id
      and ccm.user_id = auth.uid()
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_user_blocks'
  ) then
    alter publication supabase_realtime add table public.chat_user_blocks;
  end if;
end $$;

comment on column public.chat_conversations.disappearing_seconds is
  'Optional retention timer for new chat messages in this conversation.';

comment on column public.chat_messages.expires_at is
  'When set, clients should hide the message after this timestamp.';

comment on table public.chat_user_blocks is
  'Per-user chat blocks used to prevent unsafe direct messaging.';
