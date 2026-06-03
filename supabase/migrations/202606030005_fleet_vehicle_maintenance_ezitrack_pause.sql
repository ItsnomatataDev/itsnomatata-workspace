alter table public.fleet_vehicles
  add column if not exists maintenance_note text,
  add column if not exists maintenance_started_at timestamptz,
  add column if not exists maintenance_started_by uuid references public.profiles(id) on delete set null,
  add column if not exists ezitrack_import_paused boolean not null default false,
  add column if not exists ezitrack_resumed_at timestamptz,
  add column if not exists ezitrack_resumed_import_batch_id uuid references public.fleet_import_batches(id) on delete set null;

do $$
begin
  alter table public.fleet_vehicles
    add constraint fleet_vehicles_status_check
    check (status in ('active', 'maintenance', 'inactive', 'retired'));
exception when duplicate_object then null;
end;
$$;

create index if not exists fleet_vehicles_org_status_idx
  on public.fleet_vehicles (organization_id, status);

-- Allow import rows to record maintenance skips separately from failures.
alter table public.fleet_import_rows
  drop constraint if exists fleet_import_rows_status_check;

alter table public.fleet_import_rows
  add constraint fleet_import_rows_status_check
  check (status in ('pending', 'imported', 'failed', 'unmatched', 'skipped_maintenance'));
