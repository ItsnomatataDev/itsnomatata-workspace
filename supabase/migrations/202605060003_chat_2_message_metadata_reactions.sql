alter table public.chat_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  constraint message_reactions_unique unique (message_id, user_id, emoji)
);

create index if not exists message_reactions_message_id_idx
  on public.message_reactions (message_id, created_at);

create index if not exists message_reactions_user_id_idx
  on public.message_reactions (user_id);

alter table public.message_reactions enable row level security;

drop policy if exists "Members can view reactions in their conversations"
  on public.message_reactions;
create policy "Members can view reactions in their conversations"
  on public.message_reactions
  for select
  using (
    exists (
      select 1
      from public.chat_messages cm
      join public.chat_conversation_members ccm
        on ccm.conversation_id = cm.conversation_id
      where cm.id = message_reactions.message_id
        and ccm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can react in their conversations"
  on public.message_reactions;
create policy "Members can react in their conversations"
  on public.message_reactions
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.chat_messages cm
      join public.chat_conversation_members ccm
        on ccm.conversation_id = cm.conversation_id
      where cm.id = message_reactions.message_id
        and ccm.user_id = auth.uid()
    )
  );

drop policy if exists "Users can remove own reactions"
  on public.message_reactions;
create policy "Users can remove own reactions"
  on public.message_reactions
  for delete
  using (user_id = auth.uid());

grant all on public.message_reactions to authenticated;

comment on column public.chat_messages.metadata is
  'Chat 2.0 message metadata for lightweight rich payloads such as GIFs and memes.';

comment on table public.message_reactions is
  'Emoji reactions for chat messages scoped by existing conversation membership RLS.';
