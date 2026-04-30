
create table if not exists public.external_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source text not null,
  import_type text not null,
  file_name text,
  status text not null default 'completed',
  imported_by uuid references public.profiles(id) on delete set null,
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.external_import_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source text not null,
  external_type text not null,
  external_id text not null,
  internal_table text not null,
  internal_id uuid,
  import_batch_id uuid references public.external_import_batches(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists external_import_mappings_unique
  on public.external_import_mappings (
    organization_id,
    source,
    external_type,
    external_id
  );

create index if not exists idx_external_import_mappings_internal
  on public.external_import_mappings (organization_id, internal_table, internal_id);

create table if not exists public.client_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  invoice_number text,
  invoice_date date,
  period_start date,
  period_end date,
  currency text default 'USD',
  subtotal numeric,
  tax_total numeric,
  total numeric,
  status text not null default 'imported',
  source text not null default 'manual',
  external_id text,
  file_name text,
  storage_path text,
  public_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists client_invoices_external_unique
  on public.client_invoices (organization_id, source, external_id)
  where external_id is not null;

create index if not exists idx_client_invoices_client_date
  on public.client_invoices (organization_id, client_id, invoice_date desc);

alter table public.external_import_batches enable row level security;
alter table public.external_import_mappings enable row level security;
alter table public.client_invoices enable row level security;

drop policy if exists "org_admins_manage_external_import_batches" on public.external_import_batches;
create policy "org_admins_manage_external_import_batches"
on public.external_import_batches
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = external_import_batches.organization_id
      and p.primary_role in ('admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = external_import_batches.organization_id
      and p.primary_role in ('admin', 'manager')
  )
);

drop policy if exists "org_admins_manage_external_import_mappings" on public.external_import_mappings;
create policy "org_admins_manage_external_import_mappings"
on public.external_import_mappings
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = external_import_mappings.organization_id
      and p.primary_role in ('admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = external_import_mappings.organization_id
      and p.primary_role in ('admin', 'manager')
  )
);

drop policy if exists "org_members_read_client_invoices" on public.client_invoices;
create policy "org_members_read_client_invoices"
on public.client_invoices
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = client_invoices.organization_id
  )
);

drop policy if exists "org_admins_manage_client_invoices" on public.client_invoices;
create policy "org_admins_manage_client_invoices"
on public.client_invoices
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = client_invoices.organization_id
      and p.primary_role in ('admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = client_invoices.organization_id
      and p.primary_role in ('admin', 'manager')
  )
);
