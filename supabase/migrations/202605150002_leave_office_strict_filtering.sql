alter table public.leave_requests
  add column if not exists office_id uuid references public.company_offices(id) on delete set null;

alter table public.leave_balance_audit
  add column if not exists office_id uuid references public.company_offices(id) on delete set null;

update public.leave_requests lr
set office_id = p.office_id
from public.profiles p
where lr.office_id is null
  and lr.user_id = p.id
  and lr.organization_id = p.organization_id
  and p.office_id is not null;

update public.leave_balance_audit audit
set office_id = p.office_id
from public.profiles p
where audit.office_id is null
  and audit.user_id = p.id
  and audit.organization_id = p.organization_id
  and p.office_id is not null;

create index if not exists leave_requests_org_office_status_dates_idx
  on public.leave_requests (organization_id, office_id, status, start_date, end_date);

create index if not exists leave_balance_audit_org_office_created_idx
  on public.leave_balance_audit (organization_id, office_id, created_at desc);

create or replace function public.set_leave_request_office_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.office_id is null then
    select p.office_id
    into new.office_id
    from public.profiles p
    where p.id = new.user_id
      and p.organization_id = new.organization_id
    limit 1;
  end if;

  return new;
end;
$$;

drop trigger if exists leave_requests_set_office_id on public.leave_requests;
create trigger leave_requests_set_office_id
before insert or update of user_id, organization_id, office_id on public.leave_requests
for each row
execute function public.set_leave_request_office_id();
