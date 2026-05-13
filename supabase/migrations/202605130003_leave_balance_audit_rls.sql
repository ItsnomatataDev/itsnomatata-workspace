
create index if not exists idx_leave_balance_audit_user
  on public.leave_balance_audit using btree (user_id, created_at desc);

create index if not exists idx_leave_balance_audit_org
  on public.leave_balance_audit using btree (organization_id, created_at desc);

create index if not exists idx_leave_balance_audit_modified_by
  on public.leave_balance_audit using btree (modified_by, created_at desc);

alter table public.leave_balance_audit enable row level security;

drop policy if exists "users_read_own_leave_balance_audit" on public.leave_balance_audit;
create policy "users_read_own_leave_balance_audit"
on public.leave_balance_audit
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "org_admins_read_leave_balance_audit" on public.leave_balance_audit;
create policy "org_admins_read_leave_balance_audit"
on public.leave_balance_audit
for select
to authenticated
using (public.is_org_admin(organization_id));

drop policy if exists "org_admins_insert_leave_balance_audit" on public.leave_balance_audit;
create policy "org_admins_insert_leave_balance_audit"
on public.leave_balance_audit
for insert
to authenticated
with check (
  modified_by = auth.uid()
  and public.is_org_admin(organization_id)
);

create or replace function public.prevent_non_admin_leave_balance_profile_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.leave_days_total is distinct from old.leave_days_total
     or new.leave_days_remaining is distinct from old.leave_days_remaining then
    if not public.is_org_admin(coalesce(new.organization_id, old.organization_id)) then
      raise exception 'Only organization admins can adjust leave balances.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_non_admin_leave_balance_profile_updates
  on public.profiles;

create trigger prevent_non_admin_leave_balance_profile_updates
before update of leave_days_total, leave_days_remaining
on public.profiles
for each row
execute function public.prevent_non_admin_leave_balance_profile_updates();

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'leave_request_status'
  ) then
    execute 'alter type public.leave_request_status add value if not exists ''cancelled''';
  end if;
end $$;

drop policy if exists "users_read_own_leave_requests" on public.leave_requests;
create policy "users_read_own_leave_requests"
on public.leave_requests
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users_insert_own_leave_requests" on public.leave_requests;
create policy "users_insert_own_leave_requests"
on public.leave_requests
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = leave_requests.organization_id
  )
);

drop policy if exists "org_admins_manage_leave_requests" on public.leave_requests;
create policy "org_admins_manage_leave_requests"
on public.leave_requests
for all
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));
