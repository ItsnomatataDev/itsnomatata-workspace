create table if not exists public.fleet_daily_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  summary_date date not null,
  source text not null default 'ezitrack_email',
  period_start timestamptz,
  period_end timestamptz,
  route_start timestamptz,
  route_end timestamptz,
  route_length_km numeric(12, 2) not null default 0,
  move_duration_seconds integer not null default 0,
  stop_duration_seconds integer not null default 0,
  stop_count integer not null default 0,
  top_speed_kmh numeric(10, 2),
  average_speed_kmh numeric(10, 2),
  overspeed_count integer not null default 0,
  fuel_consumption_litres numeric(10, 2),
  average_fuel_consumption_per_100km numeric(10, 2),
  fuel_cost numeric(12, 2),
  currency text not null default 'USD',
  engine_work_seconds integer not null default 0,
  engine_idle_seconds integer not null default 0,
  odometer_km numeric(12, 2),
  engine_hours_seconds integer not null default 0,
  driver_name text,
  raw_data jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (vehicle_id, summary_date, source)
);

create table if not exists public.fleet_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source text not null default 'ezitrack_email',
  import_type text not null default 'daily_report',
  file_name text,
  status text not null default 'processing',
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  failed_rows integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint fleet_import_batches_status_check
    check (status in ('processing', 'completed', 'partial_failed', 'failed'))
);

create table if not exists public.fleet_import_rows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid not null references public.fleet_import_batches(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null default '{}'::jsonb,
  mapped_data jsonb not null default '{}'::jsonb,
  vehicle_id uuid references public.fleet_vehicles(id) on delete set null,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default now(),
  constraint fleet_import_rows_status_check
    check (status in ('pending', 'imported', 'failed', 'unmatched'))
);

create index if not exists fleet_daily_summaries_org_date_idx
  on public.fleet_daily_summaries (organization_id, summary_date desc);

create index if not exists fleet_daily_summaries_vehicle_date_idx
  on public.fleet_daily_summaries (vehicle_id, summary_date desc);

create index if not exists fleet_import_batches_org_created_idx
  on public.fleet_import_batches (organization_id, created_at desc);

create index if not exists fleet_import_rows_batch_idx
  on public.fleet_import_rows (batch_id, row_number);

create or replace function public.can_manage_fleet(target_organization_id uuid)
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
      and p.primary_role::text in ('admin', 'manager', 'it', 'superadmin', 'it-superadmin')
  );
$$;

create or replace function public.can_read_fleet(target_organization_id uuid)
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
      and p.primary_role::text in ('admin', 'manager', 'it', 'superadmin', 'it-superadmin')
  );
$$;

grant execute on function public.can_manage_fleet(uuid) to authenticated;
grant execute on function public.can_read_fleet(uuid) to authenticated;

alter table public.fleet_daily_summaries enable row level security;
alter table public.fleet_import_batches enable row level security;
alter table public.fleet_import_rows enable row level security;

drop policy if exists "fleet_daily_summaries_read" on public.fleet_daily_summaries;
create policy "fleet_daily_summaries_read"
on public.fleet_daily_summaries
for select
to authenticated
using (public.can_read_fleet(organization_id));

drop policy if exists "fleet_daily_summaries_manage" on public.fleet_daily_summaries;
create policy "fleet_daily_summaries_manage"
on public.fleet_daily_summaries
for all
to authenticated
using (public.can_manage_fleet(organization_id))
with check (public.can_manage_fleet(organization_id));

drop policy if exists "fleet_import_batches_read" on public.fleet_import_batches;
create policy "fleet_import_batches_read"
on public.fleet_import_batches
for select
to authenticated
using (public.can_manage_fleet(organization_id));

drop policy if exists "fleet_import_batches_manage" on public.fleet_import_batches;
create policy "fleet_import_batches_manage"
on public.fleet_import_batches
for all
to authenticated
using (public.can_manage_fleet(organization_id))
with check (public.can_manage_fleet(organization_id));

drop policy if exists "fleet_import_rows_read" on public.fleet_import_rows;
create policy "fleet_import_rows_read"
on public.fleet_import_rows
for select
to authenticated
using (public.can_manage_fleet(organization_id));

drop policy if exists "fleet_import_rows_manage" on public.fleet_import_rows;
create policy "fleet_import_rows_manage"
on public.fleet_import_rows
for all
to authenticated
using (public.can_manage_fleet(organization_id))
with check (public.can_manage_fleet(organization_id));
