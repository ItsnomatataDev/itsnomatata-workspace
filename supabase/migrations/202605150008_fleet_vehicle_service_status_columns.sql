alter table public.fleet_vehicles
  add column if not exists service_interval_km numeric(12, 2) not null default 10000,
  add column if not exists service_status text not null default 'service_ok',
  add column if not exists estimated_days_to_service numeric(12, 2),
  add column if not exists latest_odometer_at timestamptz;

do $$
begin
  alter table public.fleet_vehicles
    add constraint fleet_vehicles_service_status_check
    check (service_status in ('service_overdue', 'service_soon', 'service_ok'));
exception when duplicate_object then null;
end;
$$;

create index if not exists fleet_vehicles_org_service_status_idx
  on public.fleet_vehicles (organization_id, service_status);
