alter table public.duty_rosters
  add column if not exists office_id uuid references public.company_offices(id) on delete set null,
  add column if not exists status text not null default 'active',
  add column if not exists rotation_seed integer not null default 0,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

create table if not exists public.duty_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  office_id uuid references public.company_offices(id) on delete cascade,
  name text not null,
  description text,
  duty_type text not null default 'weekly_rotating',
  day_of_week integer,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint duty_definitions_type_check check (duty_type in ('weekly_rotating', 'single_day')),
  constraint duty_definitions_day_check check (day_of_week is null or day_of_week between 1 and 7)
);

create table if not exists public.duty_roster_members (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.duty_rosters(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (roster_id, user_id)
);

create table if not exists public.duty_roster_duties (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.duty_rosters(id) on delete cascade,
  duty_id uuid not null references public.duty_definitions(id) on delete cascade,
  rotation_offset integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (roster_id, duty_id)
);

create index if not exists duty_rosters_office_status_idx
  on public.duty_rosters (organization_id, office_id, status, week_start);

create index if not exists duty_definitions_office_active_idx
  on public.duty_definitions (organization_id, office_id, is_active);

create index if not exists duty_roster_members_roster_idx
  on public.duty_roster_members (roster_id, sort_order);

create index if not exists duty_roster_duties_roster_idx
  on public.duty_roster_duties (roster_id, sort_order);

update public.duty_rosters dr
set office_id = co.id
from public.company_offices co
where dr.office_id is null
  and co.organization_id = dr.organization_id
  and co.slug = 'its-no-matata';

insert into public.duty_definitions (
  organization_id,
  office_id,
  name,
  description,
  duty_type,
  day_of_week,
  is_active
)
select co.organization_id, co.id, duty.name, duty.description, duty.duty_type, duty.day_of_week, true
from public.company_offices co
cross join (
  values
    ('Washing', 'Weekly washing duty rotation.', 'weekly_rotating', null::integer),
    ('Plates', 'Weekly plates and dishes duty rotation.', 'weekly_rotating', null::integer),
    ('Kitchen', 'Weekly kitchen reset and upkeep duty.', 'weekly_rotating', null::integer),
    ('Cleaning', 'Weekly shared workspace cleaning duty.', 'weekly_rotating', null::integer),
    ('Fat Friday', 'Friday-only special team duty.', 'single_day', 5)
) as duty(name, description, duty_type, day_of_week)
where co.slug = 'its-no-matata'
  and not exists (
    select 1
    from public.duty_definitions existing
    where existing.organization_id = co.organization_id
      and existing.office_id = co.id
      and lower(existing.name) = lower(duty.name)
  );

alter table public.duty_definitions enable row level security;
alter table public.duty_roster_members enable row level security;
alter table public.duty_roster_duties enable row level security;

drop policy if exists "Office users can read duty definitions" on public.duty_definitions;
create policy "Office users can read duty definitions"
on public.duty_definitions for select
using (
  organization_id in (select organization_id from public.profiles where id = auth.uid())
  and public.user_has_office_access(office_id)
);

drop policy if exists "Admins can manage duty definitions" on public.duty_definitions;
create policy "Admins can manage duty definitions"
on public.duty_definitions for all
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
      and primary_role in ('admin', 'manager', 'it-superadmin', 'superadmin')
  )
  and public.user_has_office_access(office_id)
)
with check (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
      and primary_role in ('admin', 'manager', 'it-superadmin', 'superadmin')
  )
  and public.user_has_office_access(office_id)
);

drop policy if exists "Office users can read roster members" on public.duty_roster_members;
create policy "Office users can read roster members"
on public.duty_roster_members for select
using (
  roster_id in (
    select id
    from public.duty_rosters
    where organization_id in (select organization_id from public.profiles where id = auth.uid())
      and public.user_has_office_access(office_id)
  )
);

drop policy if exists "Admins can manage roster members" on public.duty_roster_members;
create policy "Admins can manage roster members"
on public.duty_roster_members for all
using (
  roster_id in (
    select id
    from public.duty_rosters
    where organization_id in (
      select organization_id
      from public.profiles
      where id = auth.uid()
        and primary_role in ('admin', 'manager', 'it-superadmin', 'superadmin')
    )
      and public.user_has_office_access(office_id)
  )
)
with check (
  roster_id in (
    select id
    from public.duty_rosters
    where organization_id in (
      select organization_id
      from public.profiles
      where id = auth.uid()
        and primary_role in ('admin', 'manager', 'it-superadmin', 'superadmin')
    )
      and public.user_has_office_access(office_id)
  )
);

drop policy if exists "Office users can read roster duties" on public.duty_roster_duties;
create policy "Office users can read roster duties"
on public.duty_roster_duties for select
using (
  roster_id in (
    select id
    from public.duty_rosters
    where organization_id in (select organization_id from public.profiles where id = auth.uid())
      and public.user_has_office_access(office_id)
  )
);

drop policy if exists "Admins can manage roster duties" on public.duty_roster_duties;
create policy "Admins can manage roster duties"
on public.duty_roster_duties for all
using (
  roster_id in (
    select id
    from public.duty_rosters
    where organization_id in (
      select organization_id
      from public.profiles
      where id = auth.uid()
        and primary_role in ('admin', 'manager', 'it-superadmin', 'superadmin')
    )
      and public.user_has_office_access(office_id)
  )
)
with check (
  roster_id in (
    select id
    from public.duty_rosters
    where organization_id in (
      select organization_id
      from public.profiles
      where id = auth.uid()
        and primary_role in ('admin', 'manager', 'it-superadmin', 'superadmin')
    )
      and public.user_has_office_access(office_id)
  )
);
