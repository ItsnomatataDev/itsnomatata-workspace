create or replace function public.can_manage_location_planner(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    join public.company_offices co on co.id = p.office_id
    where p.id = auth.uid()
      and p.organization_id = target_organization_id
      and co.organization_id = target_organization_id
      and co.slug = 'its-no-matata'
      and coalesce(p.account_status, 'active') = 'active'
      and coalesce(p.is_suspended, false) = false
      and p.primary_role::text in ('admin', 'org_admin', 'super_admin', 'superadmin')
  );
$$;

create or replace function public.can_read_location_planner(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.can_manage_location_planner(target_organization_id);
$$;

grant execute on function public.can_manage_location_planner(uuid) to authenticated;
grant execute on function public.can_read_location_planner(uuid) to authenticated;

notify pgrst, 'reload schema';
