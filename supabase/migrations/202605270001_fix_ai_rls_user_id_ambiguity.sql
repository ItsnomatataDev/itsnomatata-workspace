create or replace function public.user_organizations(user_id uuid)
returns table(organization_id uuid) as $$
begin
  return query
  select om.organization_id
  from public.organization_members om
  where om.user_id = public.user_organizations.user_id
    and om.status = 'active';
end;
$$ language plpgsql security definer;

create or replace function public.is_org_admin_or_manager(
  user_id uuid,
  org_id uuid
)
returns boolean as $$
begin
  return exists (
    select 1
    from public.organization_members om
    join public.profiles p on p.id = om.user_id
    where om.user_id = public.is_org_admin_or_manager.user_id
      and om.organization_id = public.is_org_admin_or_manager.org_id
      and om.status = 'active'
      and p.primary_role in ('admin', 'manager', 'org_admin', 'super_admin')
  );
end;
$$ language plpgsql security definer;
