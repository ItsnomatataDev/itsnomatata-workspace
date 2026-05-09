create table if not exists public.fleet_fuel_purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  purchase_date timestamptz not null,
  litres numeric(10, 2) not null check (litres > 0),
  unit_price numeric(12, 4),
  total_cost numeric(12, 2) not null check (total_cost >= 0),
  currency text not null default 'USD',
  odometer_km numeric(12, 2),
  station_name text,
  payment_method text,
  receipt_number text,
  receipt_url text,
  recorded_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fleet_fuel_purchases_org_date_idx
  on public.fleet_fuel_purchases (organization_id, purchase_date desc);

create index if not exists fleet_fuel_purchases_vehicle_date_idx
  on public.fleet_fuel_purchases (vehicle_id, purchase_date desc);

create or replace function public.set_fleet_fuel_purchases_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists fleet_fuel_purchases_set_updated_at on public.fleet_fuel_purchases;
create trigger fleet_fuel_purchases_set_updated_at
before update on public.fleet_fuel_purchases
for each row
execute function public.set_fleet_fuel_purchases_updated_at();

alter table public.fleet_fuel_purchases enable row level security;

drop policy if exists "fleet_fuel_purchases_read" on public.fleet_fuel_purchases;
create policy "fleet_fuel_purchases_read"
on public.fleet_fuel_purchases
for select
to authenticated
using (public.can_read_fleet(organization_id));

drop policy if exists "fleet_fuel_purchases_manage" on public.fleet_fuel_purchases;
create policy "fleet_fuel_purchases_manage"
on public.fleet_fuel_purchases
for all
to authenticated
using (public.can_manage_fleet(organization_id))
with check (public.can_manage_fleet(organization_id));
