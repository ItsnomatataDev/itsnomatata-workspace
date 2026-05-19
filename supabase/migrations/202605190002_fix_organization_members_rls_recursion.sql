create or replace function public.current_profile_is_org_admin(target_organization_id uuid)
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
      and coalesce(p.primary_role::text, '') in (
        'admin',
        'org_admin',
        'super_admin',
        'superadmin',
        'it-superadmin',
        'it'
      )
  );
$$;

grant execute on function public.current_profile_is_org_admin(uuid) to authenticated;

create or replace function public.current_profile_is_org_member(target_organization_id uuid)
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
  );
$$;

grant execute on function public.current_profile_is_org_member(uuid) to authenticated;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'organization_members'
  loop
    execute format(
      'drop policy if exists %I on public.organization_members',
      policy_record.policyname
    );
  end loop;
end;
$$;

alter table public.organization_members enable row level security;

create policy "organization_members_select_safe"
on public.organization_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_profile_is_org_admin(organization_id)
);

create policy "organization_members_insert_self_safe"
on public.organization_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    (
      public.current_profile_is_org_member(organization_id)
      and coalesce(status::text, 'active') in ('active', 'pending_approval', 'pending')
      and coalesce(role::text, '') = coalesce((
        select p.primary_role::text
        from public.profiles p
        where p.id = auth.uid()
        limit 1
      ), role::text, '')
    )
    or exists (
      select 1
      from public.organization_invitations oi
      where oi.organization_id = organization_members.organization_id
        and lower(oi.email) = lower(coalesce(auth.email(), ''))
        and oi.status = 'pending'
        and (oi.expires_at is null or oi.expires_at > now())
    )
  )
);

create policy "organization_members_insert_admin_safe"
on public.organization_members
for insert
to authenticated
with check (public.current_profile_is_org_admin(organization_id));

create policy "organization_members_update_self_safe"
on public.organization_members
for update
to authenticated
using (
  user_id = auth.uid()
  or public.current_profile_is_org_admin(organization_id)
)
with check (
  public.current_profile_is_org_admin(organization_id)
  or (
    user_id = auth.uid()
    and public.current_profile_is_org_member(organization_id)
    and coalesce(status::text, 'active') in ('active', 'pending_approval', 'pending')
    and coalesce(role::text, '') = coalesce((
      select p.primary_role::text
      from public.profiles p
      where p.id = auth.uid()
      limit 1
    ), role::text, '')
  )
  or (
    user_id = auth.uid()
    and exists (
      select 1
      from public.organization_invitations oi
      where oi.organization_id = organization_members.organization_id
        and lower(oi.email) = lower(coalesce(auth.email(), ''))
        and oi.status = 'pending'
        and (oi.expires_at is null or oi.expires_at > now())
    )
  )
);

create policy "organization_members_delete_admin_safe"
on public.organization_members
for delete
to authenticated
using (public.current_profile_is_org_admin(organization_id));
