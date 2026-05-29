alter table if exists public.assets enable row level security;
alter table if exists public.asset_assignments enable row level security;

drop policy if exists "assets_select_org_members" on public.assets;
create policy "assets_select_org_members"
on public.assets
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "assets_insert_org_admins" on public.assets;
create policy "assets_insert_org_admins"
on public.assets
for insert
to authenticated
with check (public.is_org_admin(organization_id));

drop policy if exists "assets_update_org_admins" on public.assets;
create policy "assets_update_org_admins"
on public.assets
for update
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

drop policy if exists "assets_delete_org_admins" on public.assets;
create policy "assets_delete_org_admins"
on public.assets
for delete
to authenticated
using (public.is_org_admin(organization_id));

drop policy if exists "asset_assignments_select_org_members" on public.asset_assignments;
create policy "asset_assignments_select_org_members"
on public.asset_assignments
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "asset_assignments_insert_org_admins" on public.asset_assignments;
create policy "asset_assignments_insert_org_admins"
on public.asset_assignments
for insert
to authenticated
with check (public.is_org_admin(organization_id));

drop policy if exists "asset_assignments_update_org_admins" on public.asset_assignments;
create policy "asset_assignments_update_org_admins"
on public.asset_assignments
for update
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

drop policy if exists "asset_assignments_delete_org_admins" on public.asset_assignments;
create policy "asset_assignments_delete_org_admins"
on public.asset_assignments
for delete
to authenticated
using (public.is_org_admin(organization_id));
