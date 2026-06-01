drop policy if exists "Users can view own memberships" on public.chat_conversation_members;
drop policy if exists "Users can view all members in their conversations" on public.chat_conversation_members;
drop policy if exists "Users can view members in their conversations" on public.chat_conversation_members;

create or replace function public.user_is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.chat_conversation_members
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
  );
$$;

grant execute on function public.user_is_conversation_member(uuid) to authenticated;

create policy "Users can view members in their conversations"
on public.chat_conversation_members
for select
to authenticated
using (public.user_is_conversation_member(conversation_id));
