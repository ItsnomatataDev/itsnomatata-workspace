create extension if not exists pgcrypto;

create or replace function public.can_manage_tourism(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_active_org_admin(target_organization_id)
    or exists (
      select 1
      from public.organization_members om
      left join public.profiles p on p.id = om.user_id
      where om.user_id = auth.uid()
        and om.organization_id = target_organization_id
        and om.status::text = 'active'
        and coalesce(p.account_status, 'active') = 'active'
        and coalesce(p.is_active, true) = true
        and coalesce(p.is_suspended, false) = false
        and om.role::text in (
          'tourism_operations_manager',
          'reservations_agent',
          'guest_relations',
          'activity_coordinator',
          'fleet_coordinator',
          'manager'
        )
    );
$$;

grant execute on function public.can_manage_tourism(uuid) to authenticated;

create table if not exists public.tourism_guests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  nationality text,
  guest_count integer not null default 1 check (guest_count > 0),
  preferences text,
  special_requests text,
  status text not null default 'active' check (status in ('active', 'vip', 'watchlist', 'archived')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tourism_bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  guest_id uuid references public.tourism_guests(id) on delete set null,
  booking_reference text,
  activity_name text not null,
  booking_date date not null,
  pickup_time time,
  pickup_location text,
  guest_count integer not null default 1 check (guest_count > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'deposit_paid', 'paid', 'refunded')),
  notes text,
  assigned_guide_id uuid references public.profiles(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tourism_itinerary_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  booking_id uuid references public.tourism_bookings(id) on delete cascade,
  guest_id uuid references public.tourism_guests(id) on delete set null,
  title text not null,
  item_type text not null default 'activity' check (item_type in ('arrival', 'transfer', 'activity', 'meal', 'accommodation', 'departure', 'note')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  status text not null default 'planned' check (status in ('planned', 'confirmed', 'in_progress', 'done', 'cancelled')),
  notes text,
  assigned_user_id uuid references public.profiles(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tourism_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  booking_id uuid references public.tourism_bookings(id) on delete set null,
  guest_id uuid references public.tourism_guests(id) on delete set null,
  transfer_type text not null default 'pickup' check (transfer_type in ('pickup', 'dropoff', 'activity_transfer', 'airport', 'border', 'custom')),
  pickup_location text not null,
  dropoff_location text not null,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'dispatched', 'picked_up', 'completed', 'cancelled')),
  driver_id uuid references public.profiles(id),
  vehicle_id uuid references public.fleet_vehicles(id),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tourism_guests_org_created
  on public.tourism_guests (organization_id, created_at desc);
create index if not exists idx_tourism_bookings_org_date
  on public.tourism_bookings (organization_id, booking_date desc, status);
create index if not exists idx_tourism_bookings_guest
  on public.tourism_bookings (guest_id);
create index if not exists idx_tourism_itinerary_org_start
  on public.tourism_itinerary_items (organization_id, starts_at desc, status);
create index if not exists idx_tourism_itinerary_booking
  on public.tourism_itinerary_items (booking_id);
create index if not exists idx_tourism_transfers_org_scheduled
  on public.tourism_transfers (organization_id, scheduled_at desc, status);
create index if not exists idx_tourism_transfers_driver
  on public.tourism_transfers (driver_id, scheduled_at desc);

alter table public.tourism_guests enable row level security;
alter table public.tourism_bookings enable row level security;
alter table public.tourism_itinerary_items enable row level security;
alter table public.tourism_transfers enable row level security;

drop policy if exists "tourism_guests_select_org" on public.tourism_guests;
create policy "tourism_guests_select_org"
on public.tourism_guests for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "tourism_guests_manage_org" on public.tourism_guests;
create policy "tourism_guests_manage_org"
on public.tourism_guests for all to authenticated
using (public.can_manage_tourism(organization_id))
with check (public.can_manage_tourism(organization_id));

drop policy if exists "tourism_bookings_select_org" on public.tourism_bookings;
create policy "tourism_bookings_select_org"
on public.tourism_bookings for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "tourism_bookings_manage_org" on public.tourism_bookings;
create policy "tourism_bookings_manage_org"
on public.tourism_bookings for all to authenticated
using (public.can_manage_tourism(organization_id))
with check (public.can_manage_tourism(organization_id));

drop policy if exists "tourism_itinerary_select_org" on public.tourism_itinerary_items;
create policy "tourism_itinerary_select_org"
on public.tourism_itinerary_items for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "tourism_itinerary_manage_org" on public.tourism_itinerary_items;
create policy "tourism_itinerary_manage_org"
on public.tourism_itinerary_items for all to authenticated
using (public.can_manage_tourism(organization_id))
with check (public.can_manage_tourism(organization_id));

drop policy if exists "tourism_transfers_select_org" on public.tourism_transfers;
create policy "tourism_transfers_select_org"
on public.tourism_transfers for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "tourism_transfers_manage_org" on public.tourism_transfers;
create policy "tourism_transfers_manage_org"
on public.tourism_transfers for all to authenticated
using (public.can_manage_tourism(organization_id))
with check (public.can_manage_tourism(organization_id));
