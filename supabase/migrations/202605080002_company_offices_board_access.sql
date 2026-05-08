create table if not exists public.company_offices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

insert into public.company_offices (organization_id, name, slug, is_primary)
select o.id, 'IT''s No Matata', 'its-no-matata', true
from public.organizations o
where not exists (
  select 1 from public.company_offices co
  where co.organization_id = o.id and co.slug = 'its-no-matata'
);

insert into public.company_offices (organization_id, name, slug, is_primary)
select o.id, 'Three Little Birds', 'three-little-birds', false
from public.organizations o
where not exists (
  select 1 from public.company_offices co
  where co.organization_id = o.id and co.slug = 'three-little-birds'
);

alter table public.profiles
  add column if not exists office_id uuid references public.company_offices(id) on delete set null;

alter table public.clients
  add column if not exists office_id uuid references public.company_offices(id) on delete set null;

alter table public.tasks
  add column if not exists office_id uuid references public.company_offices(id) on delete set null;

alter table public.time_entries
  add column if not exists office_id uuid references public.company_offices(id) on delete set null;

update public.profiles p
set office_id = co.id
from public.company_offices co
where p.office_id is null
  and co.organization_id = p.organization_id
  and co.slug = 'its-no-matata';

update public.clients c
set office_id = co.id
from public.company_offices co
where c.office_id is null
  and co.organization_id = c.organization_id
  and co.slug = 'its-no-matata';

update public.tasks t
set office_id = c.office_id
from public.clients c
where t.office_id is null
  and t.client_id = c.id
  and c.office_id is not null;

update public.tasks t
set office_id = co.id
from public.company_offices co
where t.office_id is null
  and co.organization_id = t.organization_id
  and co.slug = 'its-no-matata';

update public.time_entries te
set office_id = c.office_id
from public.clients c
where te.office_id is null
  and te.client_id = c.id
  and c.office_id is not null;

update public.time_entries te
set office_id = t.office_id
from public.tasks t
where te.office_id is null
  and te.task_id = t.id
  and t.office_id is not null;

update public.time_entries te
set office_id = co.id
from public.company_offices co
where te.office_id is null
  and co.organization_id = te.organization_id
  and co.slug = 'its-no-matata';

create index if not exists profiles_office_idx on public.profiles (organization_id, office_id);
create index if not exists clients_office_idx on public.clients (organization_id, office_id);
create index if not exists tasks_office_idx on public.tasks (organization_id, office_id);
create index if not exists time_entries_office_idx on public.time_entries (organization_id, office_id);

create or replace function public.current_user_organization_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select p.organization_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.current_user_office_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select p.office_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.user_can_manage_all_offices()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    join public.company_offices co on co.id = p.office_id
    where p.id = auth.uid()
      and p.organization_id = co.organization_id
      and co.is_primary = true
      and coalesce(p.primary_role::text, '') in ('admin', 'super_admin', 'superadmin', 'it-superadmin')
  );
$$;

create or replace function public.user_has_office_access(target_office_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.company_offices co
    join public.profiles p on p.id = auth.uid()
    where co.id = target_office_id
      and co.organization_id = p.organization_id
      and (
        public.user_can_manage_all_offices()
        or co.id = p.office_id
      )
  );
$$;

create or replace function public.user_can_access_board(target_board_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.clients c
    join public.profiles p on p.id = auth.uid()
    where c.id = target_board_id
      and c.organization_id = p.organization_id
      and public.user_has_office_access(c.office_id)
  );
$$;

create or replace function public.user_can_access_task(target_task_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.tasks t
    join public.profiles p on p.id = auth.uid()
    where t.id = target_task_id
      and t.organization_id = p.organization_id
      and public.user_has_office_access(coalesce(t.office_id, (
        select c.office_id from public.clients c where c.id = t.client_id
      )))
  );
$$;

create or replace function public.resolve_company_office_id(
  target_organization_id uuid,
  target_slug text
)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select co.id
  from public.company_offices co
  where co.organization_id = target_organization_id
    and co.slug = target_slug
  limit 1;
$$;

grant execute on function public.current_user_organization_id() to authenticated;
grant execute on function public.current_user_office_id() to authenticated;
grant execute on function public.user_can_manage_all_offices() to authenticated;
grant execute on function public.user_has_office_access(uuid) to authenticated;
grant execute on function public.user_can_access_board(uuid) to authenticated;
grant execute on function public.user_can_access_task(uuid) to authenticated;
grant execute on function public.resolve_company_office_id(uuid, text) to authenticated;

alter table public.company_offices enable row level security;
alter table public.clients enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;

drop policy if exists "Office members can read company offices" on public.company_offices;
create policy "Office members can read company offices"
on public.company_offices for select
to authenticated
using (
  organization_id = public.current_user_organization_id()
  and (
    public.user_can_manage_all_offices()
    or id = public.current_user_office_id()
  )
);

drop policy if exists "Org users can read collaborator profile basics" on public.profiles;
drop policy if exists "Office users can read accessible profile basics" on public.profiles;
create policy "Office users can read accessible profile basics"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or (
    organization_id = public.current_user_organization_id()
    and (
      public.user_can_manage_all_offices()
      or office_id = public.current_user_office_id()
    )
  )
);

drop policy if exists "Users can select accessible office boards" on public.clients;
create policy "Users can select accessible office boards"
on public.clients for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = clients.organization_id
  )
  and public.user_has_office_access(office_id)
);

drop policy if exists "Managers can insert accessible office boards" on public.clients;
create policy "Managers can insert accessible office boards"
on public.clients for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = clients.organization_id
      and coalesce(p.primary_role::text, '') in ('admin', 'manager', 'it', 'super_admin', 'superadmin', 'it-superadmin')
  )
  and public.user_has_office_access(office_id)
);

drop policy if exists "Managers can update accessible office boards" on public.clients;
create policy "Managers can update accessible office boards"
on public.clients for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = clients.organization_id
      and coalesce(p.primary_role::text, '') in ('admin', 'manager', 'it', 'super_admin', 'superadmin', 'it-superadmin')
  )
  and public.user_has_office_access(office_id)
)
with check (public.user_has_office_access(office_id));

drop policy if exists "Managers can delete accessible office boards" on public.clients;
create policy "Managers can delete accessible office boards"
on public.clients for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = clients.organization_id
      and coalesce(p.primary_role::text, '') in ('admin', 'manager', 'it', 'super_admin', 'superadmin', 'it-superadmin')
  )
  and public.user_has_office_access(office_id)
);

drop policy if exists "Users can select accessible office tasks" on public.tasks;
create policy "Users can select accessible office tasks"
on public.tasks for select
to authenticated
using (public.user_can_access_task(id));

drop policy if exists "Users can insert accessible office tasks" on public.tasks;
create policy "Users can insert accessible office tasks"
on public.tasks for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = tasks.organization_id
  )
  and public.user_has_office_access(office_id)
);

drop policy if exists "Users can update accessible office tasks" on public.tasks;
create policy "Users can update accessible office tasks"
on public.tasks for update
to authenticated
using (public.user_can_access_task(id))
with check (public.user_has_office_access(office_id));

drop policy if exists "Users can delete accessible office tasks" on public.tasks;
create policy "Users can delete accessible office tasks"
on public.tasks for delete
to authenticated
using (public.user_can_access_task(id));

drop policy if exists "Task access users can read task assignees" on public.task_assignees;
create policy "Task access users can read task assignees"
on public.task_assignees for select
to authenticated
using (public.user_can_access_task(task_id));

drop policy if exists "Task access users can add task assignees" on public.task_assignees;
create policy "Task access users can add task assignees"
on public.task_assignees for insert
to authenticated
with check (
  public.user_can_access_task(task_id)
  and exists (
    select 1
    from public.tasks t
    join public.profiles target on target.id = task_assignees.user_id
    where t.id = task_assignees.task_id
      and target.organization_id = t.organization_id
      and (
        public.user_can_manage_all_offices()
        or target.office_id = coalesce(t.office_id, (
          select c.office_id from public.clients c where c.id = t.client_id
        ))
      )
  )
);

drop policy if exists "Task access users can remove task assignees" on public.task_assignees;
create policy "Task access users can remove task assignees"
on public.task_assignees for delete
to authenticated
using (public.user_can_access_task(task_id));
