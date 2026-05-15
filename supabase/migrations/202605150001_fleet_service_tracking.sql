alter table public.fleet_vehicles
  add column if not exists office_id uuid references public.company_offices(id) on delete set null,
  add column if not exists last_service_date date,
  add column if not exists last_service_odometer_km numeric(12, 2),
  add column if not exists next_service_date date,
  add column if not exists next_service_odometer_km numeric(12, 2);

create index if not exists fleet_vehicles_org_office_idx
  on public.fleet_vehicles (organization_id, office_id);

create table if not exists public.fleet_service_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  schedule_name text not null default 'Routine service',
  service_type text not null default 'service',
  interval_km numeric(12, 2),
  interval_months integer,
  last_service_date date,
  last_service_odometer_km numeric(12, 2),
  next_service_date date,
  next_service_odometer_km numeric(12, 2),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fleet_service_schedules_status_check
    check (status in ('active', 'paused', 'completed', 'archived'))
);

create table if not exists public.fleet_maintenance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  service_date date not null,
  odometer_km numeric(12, 2),
  service_type text not null default 'service',
  description text,
  notes text,
  provider text,
  cost numeric(12, 2),
  currency text not null default 'USD',
  receipt_url text,
  invoice_url text,
  next_service_date date,
  next_service_odometer_km numeric(12, 2),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists fleet_service_schedules_org_next_date_idx
  on public.fleet_service_schedules (organization_id, next_service_date);

create index if not exists fleet_service_schedules_vehicle_idx
  on public.fleet_service_schedules (vehicle_id);

create index if not exists fleet_maintenance_records_org_date_idx
  on public.fleet_maintenance_records (organization_id, service_date desc);

create index if not exists fleet_maintenance_records_vehicle_date_idx
  on public.fleet_maintenance_records (vehicle_id, service_date desc);

create or replace function public.set_fleet_service_schedules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists fleet_service_schedules_set_updated_at on public.fleet_service_schedules;
create trigger fleet_service_schedules_set_updated_at
before update on public.fleet_service_schedules
for each row
execute function public.set_fleet_service_schedules_updated_at();

alter table public.fleet_service_schedules enable row level security;
alter table public.fleet_maintenance_records enable row level security;

drop policy if exists "fleet_service_schedules_read" on public.fleet_service_schedules;
create policy "fleet_service_schedules_read"
on public.fleet_service_schedules
for select
to authenticated
using (public.can_read_fleet(organization_id));

drop policy if exists "fleet_service_schedules_manage" on public.fleet_service_schedules;
create policy "fleet_service_schedules_manage"
on public.fleet_service_schedules
for all
to authenticated
using (public.can_manage_fleet(organization_id))
with check (public.can_manage_fleet(organization_id));

drop policy if exists "fleet_maintenance_records_read" on public.fleet_maintenance_records;
create policy "fleet_maintenance_records_read"
on public.fleet_maintenance_records
for select
to authenticated
using (public.can_read_fleet(organization_id));

drop policy if exists "fleet_maintenance_records_manage" on public.fleet_maintenance_records;
create policy "fleet_maintenance_records_manage"
on public.fleet_maintenance_records
for all
to authenticated
using (public.can_manage_fleet(organization_id))
with check (public.can_manage_fleet(organization_id));

insert into storage.buckets (id, name, public)
values ('fleet-service-receipts', 'fleet-service-receipts', false)
on conflict (id) do nothing;
