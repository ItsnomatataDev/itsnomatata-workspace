create or replace function public.is_org_workforce_admin(target_organization_id uuid)
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
      and coalesce(p.account_status, 'pending') = 'active'
      and coalesce(p.is_suspended, false) = false
      and p.primary_role::text in (
        'admin',
        'org_admin',
        'super_admin',
        'superadmin',
        'it-superadmin',
        'manager',
        'hr',
        'it'
      )
  );
$$;

grant execute on function public.is_org_workforce_admin(uuid) to authenticated;

drop policy if exists "Admin managers can select org attendance" on public.attendance_sessions;
create policy "Admin managers can select org attendance"
on public.attendance_sessions
for select
to authenticated
using (public.is_org_workforce_admin(organization_id));

drop policy if exists "Admin managers can correct org attendance" on public.attendance_sessions;
create policy "Admin managers can correct org attendance"
on public.attendance_sessions
for update
to authenticated
using (public.is_org_workforce_admin(organization_id))
with check (public.is_org_workforce_admin(organization_id));
