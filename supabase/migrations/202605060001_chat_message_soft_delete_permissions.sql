-- Allow senders, workspace admins/managers, and conversation owners/admins to
-- soft-delete chat messages through UPDATE while preserving participant read RLS.

drop policy if exists "Authorized users can soft delete chat messages" on public.chat_messages;

create policy "Authorized users can soft delete chat messages"
on public.chat_messages
for update
using (
  exists (
    select 1
    from public.chat_conversation_members ccm
    where ccm.conversation_id = chat_messages.conversation_id
      and ccm.user_id = auth.uid()
  )
  and (
    chat_messages.sender_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = chat_messages.organization_id
        and p.primary_role in ('admin', 'manager')
    )
    or exists (
      select 1
      from public.chat_conversation_members ccm
      where ccm.conversation_id = chat_messages.conversation_id
        and ccm.user_id = auth.uid()
        and ccm.role in ('owner', 'admin')
    )
  )
)
with check (
  exists (
    select 1
    from public.chat_conversation_members ccm
    where ccm.conversation_id = chat_messages.conversation_id
      and ccm.user_id = auth.uid()
  )
);
