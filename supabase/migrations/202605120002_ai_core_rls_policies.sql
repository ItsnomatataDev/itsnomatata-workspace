
create or replace function public.is_org_admin_or_manager(user_id uuid, org_id uuid)
returns boolean as $$
begin
  return exists (
    select 1
    from public.organization_members om
    join public.profiles p on p.id = om.user_id
    where om.user_id = user_id
      and om.organization_id = org_id
      and om.status = 'active'
      and p.primary_role in ('admin', 'manager')
  );
end;
$$ language plpgsql security definer;

create or replace function public.user_organizations(user_id uuid)
returns table(organization_id uuid) as $$
begin
  return query
  select om.organization_id
  from public.organization_members om
  where om.user_id = user_id
    and om.status = 'active';
end;
$$ language plpgsql security definer;


drop policy if exists "users_view_ai_assistants" on public.ai_assistants;
create policy "users_view_ai_assistants"
  on public.ai_assistants for select to authenticated
  using (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
  );

drop policy if exists "admins_manage_ai_assistants" on public.ai_assistants;
create policy "admins_manage_ai_assistants"
  on public.ai_assistants for all to authenticated
  using (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and public.is_org_admin_or_manager(auth.uid(), organization_id)
  )
  with check (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and public.is_org_admin_or_manager(auth.uid(), organization_id)
  );


drop policy if exists "users_manage_own_ai_conversations" on public.ai_conversations;

drop policy if exists "users_view_ai_conversations" on public.ai_conversations;
create policy "users_view_ai_conversations"
  on public.ai_conversations for select to authenticated
  using (
    user_id = auth.uid()
    or (
      customer_id is not null
      and organization_id in (select organization_id from public.user_organizations(auth.uid()))
    )
    or (
      organization_id in (select organization_id from public.user_organizations(auth.uid()))
      and public.is_org_admin_or_manager(auth.uid(), organization_id)
    )
  );

drop policy if exists "users_manage_own_ai_conversations" on public.ai_conversations;
create policy "users_manage_own_ai_conversations"
  on public.ai_conversations for all to authenticated
  using (
    user_id = auth.uid()
    and organization_id in (select organization_id from public.user_organizations(auth.uid()))
  )
  with check (
    user_id = auth.uid()
    and organization_id in (select organization_id from public.user_organizations(auth.uid()))
  );

drop policy if exists "admins_manage_ai_conversations" on public.ai_conversations;
create policy "admins_manage_ai_conversations"
  on public.ai_conversations for all to authenticated
  using (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and public.is_org_admin_or_manager(auth.uid(), organization_id)
  )
  with check (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and public.is_org_admin_or_manager(auth.uid(), organization_id)
  );

drop policy if exists "users_manage_own_ai_messages" on public.ai_messages;

drop policy if exists "users_view_ai_messages" on public.ai_messages;
create policy "users_view_ai_messages"
  on public.ai_messages for select to authenticated
  using (
    conversation_id in (
      select id from public.ai_conversations 
      where user_id = auth.uid()
        or (
          customer_id is not null
          and organization_id in (select organization_id from public.user_organizations(auth.uid()))
        )
    )
    or (
      organization_id in (select organization_id from public.user_organizations(auth.uid()))
      and public.is_org_admin_or_manager(auth.uid(), organization_id)
    )
  );

drop policy if exists "users_manage_own_ai_messages" on public.ai_messages;
create policy "users_manage_own_ai_messages"
  on public.ai_messages for all to authenticated
  using (
    conversation_id in (
      select id from public.ai_conversations 
      where user_id = auth.uid()
        and organization_id in (select organization_id from public.user_organizations(auth.uid()))
    )
  )
  with check (
    conversation_id in (
      select id from public.ai_conversations 
      where user_id = auth.uid()
        and organization_id in (select organization_id from public.user_organizations(auth.uid()))
    )
  );

drop policy if exists "users_view_ai_knowledge_sources" on public.ai_knowledge_sources;
create policy "users_view_ai_knowledge_sources"
  on public.ai_knowledge_sources for select to authenticated
  using (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
  );

drop policy if exists "admins_manage_ai_knowledge_sources" on public.ai_knowledge_sources;
create policy "admins_manage_ai_knowledge_sources"
  on public.ai_knowledge_sources for all to authenticated
  using (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and (
      uploaded_by = auth.uid()
      or public.is_org_admin_or_manager(auth.uid(), organization_id)
    )
  )
  with check (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and uploaded_by = auth.uid()
  );


drop policy if exists "users_view_ai_knowledge_chunks" on public.ai_knowledge_chunks;
create policy "users_view_ai_knowledge_chunks"
  on public.ai_knowledge_chunks for select to authenticated
  using (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
  );

drop policy if exists "admins_manage_ai_knowledge_chunks" on public.ai_knowledge_chunks;
create policy "admins_manage_ai_knowledge_chunks"
  on public.ai_knowledge_chunks for all to authenticated
  using (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and public.is_org_admin_or_manager(auth.uid(), organization_id)
  )
  with check (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and public.is_org_admin_or_manager(auth.uid(), organization_id)
  );

drop policy if exists "users_view_ai_tools" on public.ai_tools;
create policy "users_view_ai_tools"
  on public.ai_tools for select to authenticated
  using (
    organization_id is null
    or organization_id in (select organization_id from public.user_organizations(auth.uid()))
  );

drop policy if exists "admins_manage_ai_tools" on public.ai_tools;
create policy "admins_manage_ai_tools"
  on public.ai_tools for all to authenticated
  using (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and public.is_org_admin_or_manager(auth.uid(), organization_id)
  )
  with check (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and public.is_org_admin_or_manager(auth.uid(), organization_id)
  );


drop policy if exists "users_view_ai_actions" on public.ai_actions;
create policy "users_view_ai_actions"
  on public.ai_actions for select to authenticated
  using (
    requested_by = auth.uid()
    or (
      organization_id in (select organization_id from public.user_organizations(auth.uid()))
      and public.is_org_admin_or_manager(auth.uid(), organization_id)
    )
  );

drop policy if exists "users_create_ai_actions" on public.ai_actions;
create policy "users_create_ai_actions"
  on public.ai_actions for insert to authenticated
  with check (
    requested_by = auth.uid()
    and organization_id in (select organization_id from public.user_organizations(auth.uid()))
  );

drop policy if exists "admins_manage_ai_actions" on public.ai_actions;
create policy "admins_manage_ai_actions"
  on public.ai_actions for update to authenticated
  using (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and public.is_org_admin_or_manager(auth.uid(), organization_id)
  );

drop policy if exists "users_view_ai_action_approvals" on public.ai_action_approvals;
create policy "users_view_ai_action_approvals"
  on public.ai_action_approvals for select to authenticated
  using (
    action_id in (
      select id from public.ai_actions 
      where requested_by = auth.uid()
    )
    or (
      organization_id in (select organization_id from public.user_organizations(auth.uid()))
      and public.is_org_admin_or_manager(auth.uid(), organization_id)
    )
  );

drop policy if exists "users_create_ai_action_approvals" on public.ai_action_approvals;
create policy "users_create_ai_action_approvals"
  on public.ai_action_approvals for insert to authenticated
  with check (
    action_id in (
      select id from public.ai_actions 
      where requested_by = auth.uid()
    )
    and organization_id in (select organization_id from public.user_organizations(auth.uid()))
  );

drop policy if exists "admins_manage_ai_action_approvals" on public.ai_action_approvals;
create policy "admins_manage_ai_action_approvals"
  on public.ai_action_approvals for update to authenticated
  using (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and public.is_org_admin_or_manager(auth.uid(), organization_id)
  )
  with check (
    approved_by = auth.uid()
    and organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and public.is_org_admin_or_manager(auth.uid(), organization_id)
  );

drop policy if exists "users_view_ai_audit_logs" on public.ai_audit_logs;
create policy "users_view_ai_audit_logs"
  on public.ai_audit_logs for select to authenticated
  using (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and public.is_org_admin_or_manager(auth.uid(), organization_id)
  );

drop policy if exists "users_view_ai_customer_profiles" on public.ai_customer_profiles;
create policy "users_view_ai_customer_profiles"
  on public.ai_customer_profiles for select to authenticated
  using (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
  );

drop policy if exists "admins_manage_ai_customer_profiles" on public.ai_customer_profiles;
create policy "admins_manage_ai_customer_profiles"
  on public.ai_customer_profiles for all to authenticated
  using (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and public.is_org_admin_or_manager(auth.uid(), organization_id)
  )
  with check (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and public.is_org_admin_or_manager(auth.uid(), organization_id)
  );

drop policy if exists "users_view_ai_channel_integrations" on public.ai_channel_integrations;
create policy "users_view_ai_channel_integrations"
  on public.ai_channel_integrations for select to authenticated
  using (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
  );

drop policy if exists "admins_manage_ai_channel_integrations" on public.ai_channel_integrations;
create policy "admins_manage_ai_channel_integrations"
  on public.ai_channel_integrations for all to authenticated
  using (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and public.is_org_admin_or_manager(auth.uid(), organization_id)
  )
  with check (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and public.is_org_admin_or_manager(auth.uid(), organization_id)
  );

drop policy if exists "users_read_own_ai_approvals" on public.ai_approvals;
drop policy if exists "users_insert_own_ai_approvals" on public.ai_approvals;
drop policy if exists "reviewers_update_ai_approvals" on public.ai_approvals;

create policy "users_read_ai_approvals"
  on public.ai_approvals for select to authenticated
  using (
    user_id = auth.uid()
    or (
      organization_id in (select organization_id from public.user_organizations(auth.uid()))
      and public.is_org_admin_or_manager(auth.uid(), organization_id)
    )
  );


create policy "users_insert_ai_approvals"
  on public.ai_approvals for insert to authenticated
  with check (
    user_id = auth.uid()
    and organization_id in (select organization_id from public.user_organizations(auth.uid()))
  );


create policy "admins_update_ai_approvals"
  on public.ai_approvals for update to authenticated
  using (
    organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and public.is_org_admin_or_manager(auth.uid(), organization_id)
  )
  with check (
    reviewer_id = auth.uid()
    and organization_id in (select organization_id from public.user_organizations(auth.uid()))
    and public.is_org_admin_or_manager(auth.uid(), organization_id)
  );


create or replace function public.log_ai_activity(
  p_organization_id uuid,
  p_actor_id uuid,
  p_actor_type text,
  p_event_type text,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns void as $$
begin
  insert into public.ai_audit_logs (
    organization_id,
    actor_id,
    actor_type,
    event_type,
    reference_type,
    reference_id,
    payload
  ) values (
    p_organization_id,
    p_actor_id,
    p_actor_type,
    p_event_type,
    p_reference_type,
    p_reference_id,
    p_payload
  );
end;
$$ language plpgsql security definer;


grant usage on all tables in schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert on all tables in schema public to authenticated;
grant update on all tables in schema public to authenticated;
grant delete on all tables in schema public to authenticated;


revoke all on all tables in schema public from public;
