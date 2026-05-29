create or replace function public.user_has_office_access(target_office_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select (
    target_office_id is null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
    )
  )
  or exists (
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
      and coalesce(p.primary_role::text, '') in (
        'admin',
        'org_admin',
        'super_admin',
        'superadmin',
        'it-superadmin',
        'manager'
      )
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
      and (
        public.is_org_admin(t.organization_id)
        or public.user_has_office_access(coalesce(t.office_id, (
          select c.office_id from public.clients c where c.id = t.client_id
        )))
      )
  );
$$;

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
  and (
    public.is_org_admin(tasks.organization_id)
    or public.user_has_office_access(office_id)
  )
);

drop policy if exists "Task access users can add task assignees" on public.task_assignees;
create policy "Task access users can add task assignees"
on public.task_assignees for insert
to authenticated
with check (
  exists (
    select 1
    from public.tasks t
    where t.id = task_assignees.task_id
      and t.organization_id = task_assignees.organization_id
  )
  and (
    public.is_org_admin(task_assignees.organization_id)
    or (
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
            or coalesce(t.office_id, (
              select c.office_id from public.clients c where c.id = t.client_id
            )) is null
          )
      )
    )
  )
);
