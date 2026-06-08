alter table if exists public.company_roles
  add column if not exists location_id uuid references public.company_locations(id) on delete set null;

create index if not exists company_roles_org_location_idx
  on public.company_roles (organization_id, location_id, is_active, name);
