alter table public.duty_definitions
  add column if not exists category text,
  add column if not exists frequency text not null default 'weekly',
  add column if not exists allow_managers boolean not null default true,
  add column if not exists allow_bosses boolean not null default true,
  add column if not exists fixed_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists fixed_starts_at date,
  add column if not exists fixed_ends_at date,
  add column if not exists included_roles text[] not null default '{}',
  add column if not exists excluded_roles text[] not null default '{}';

update public.duty_definitions
set category = case
  when duty_type = 'weekly_rotating' then 'normal_rotation'
  when duty_type = 'single_day' and day_of_week = 5 then 'friday_rotation'
  when duty_type = 'single_day' then 'custom_rotation'
  else 'normal_rotation'
end
where category is null;

update public.duty_definitions
set frequency = case
  when category = 'friday_rotation' then 'weekly_friday'
  when category = 'fixed_person' then 'permanent'
  when category = 'custom_rotation' and day_of_week is not null then 'weekly_day'
  else 'weekly'
end
where frequency = 'weekly'
  and category in ('friday_rotation', 'fixed_person', 'custom_rotation');

alter table public.duty_definitions
  alter column category set default 'normal_rotation';

update public.duty_definitions
set category = 'normal_rotation'
where category is null;

alter table public.duty_definitions
  alter column category set not null;

alter table public.duty_definitions
  drop constraint if exists duty_definitions_category_check;

alter table public.duty_definitions
  add constraint duty_definitions_category_check check (
    category = any (
      array[
        'normal_rotation'::text,
        'fixed_person'::text,
        'friday_rotation'::text,
        'custom_rotation'::text
      ]
    )
  );

create table if not exists public.duty_eligibility_overrides (
  id uuid primary key default gen_random_uuid(),
  duty_id uuid not null references public.duty_definitions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_excluded boolean not null default false,
  is_forced_included boolean not null default false,
  reason text,
  created_at timestamptz not null default now(),
  unique (duty_id, user_id),
  constraint duty_eligibility_override_mode_check check (
    not (is_excluded and is_forced_included)
  )
);

create index if not exists duty_eligibility_overrides_duty_idx
  on public.duty_eligibility_overrides (duty_id);

create table if not exists public.duty_assignment_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  office_id uuid references public.company_offices(id) on delete set null,
  roster_id uuid not null references public.duty_rosters(id) on delete cascade,
  duty_id uuid not null references public.duty_definitions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assignment_week date not null,
  assignment_date date,
  source text not null default 'generated',
  created_at timestamptz not null default now(),
  unique (roster_id, duty_id, assignment_week),
  constraint duty_assignment_history_source_check check (
    source = any (
      array['generated'::text, 'manual'::text, 'fixed'::text, 'regenerated'::text]
    )
  )
);

create index if not exists duty_assignment_history_roster_week_idx
  on public.duty_assignment_history (roster_id, assignment_week);

create index if not exists duty_assignment_history_duty_week_idx
  on public.duty_assignment_history (duty_id, assignment_week desc);

create index if not exists duty_assignment_history_user_idx
  on public.duty_assignment_history (user_id, assignment_week desc);

alter table public.duty_eligibility_overrides enable row level security;
alter table public.duty_assignment_history enable row level security;

drop policy if exists "Office users can read duty eligibility overrides"
  on public.duty_eligibility_overrides;
create policy "Office users can read duty eligibility overrides"
on public.duty_eligibility_overrides for select
using (
  duty_id in (
    select dd.id
    from public.duty_definitions dd
    where dd.organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
      and public.user_has_office_access(dd.office_id)
  )
);

drop policy if exists "Admins can manage duty eligibility overrides"
  on public.duty_eligibility_overrides;
create policy "Admins can manage duty eligibility overrides"
on public.duty_eligibility_overrides for all
using (
  duty_id in (
    select dd.id
    from public.duty_definitions dd
    where dd.organization_id in (
      select organization_id
      from public.profiles
      where id = auth.uid()
        and primary_role in ('admin', 'manager', 'it-superadmin', 'superadmin', 'org_admin')
    )
      and public.user_has_office_access(dd.office_id)
  )
)
with check (
  duty_id in (
    select dd.id
    from public.duty_definitions dd
    where dd.organization_id in (
      select organization_id
      from public.profiles
      where id = auth.uid()
        and primary_role in ('admin', 'manager', 'it-superadmin', 'superadmin', 'org_admin')
    )
      and public.user_has_office_access(dd.office_id)
  )
);

drop policy if exists "Office users can read duty assignment history"
  on public.duty_assignment_history;
create policy "Office users can read duty assignment history"
on public.duty_assignment_history for select
using (
  organization_id in (select organization_id from public.profiles where id = auth.uid())
  and public.user_has_office_access(office_id)
);

drop policy if exists "Admins can manage duty assignment history"
  on public.duty_assignment_history;
create policy "Admins can manage duty assignment history"
on public.duty_assignment_history for all
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
      and primary_role in ('admin', 'manager', 'it-superadmin', 'superadmin', 'org_admin')
  )
  and public.user_has_office_access(office_id)
)
with check (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
      and primary_role in ('admin', 'manager', 'it-superadmin', 'superadmin', 'org_admin')
  )
  and public.user_has_office_access(office_id)
);
