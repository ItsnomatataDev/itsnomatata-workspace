create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  email text,
  full_name text,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'completed', 'rejected')),
  requested_from text not null default 'mobile',
  admin_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_deletion_requests enable row level security;

create policy "Users can create their own deletion request"
on public.account_deletion_requests
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can view their own deletion requests"
on public.account_deletion_requests
for select
to authenticated
using (auth.uid() = user_id);

create policy "Admins can view organization deletion requests"
on public.account_deletion_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = account_deletion_requests.organization_id
      and p.primary_role in ('admin', 'org_admin', 'super_admin', 'manager', 'hr')
  )
);

create policy "Admins can update organization deletion requests"
on public.account_deletion_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = account_deletion_requests.organization_id
      and p.primary_role in ('admin', 'org_admin', 'super_admin', 'manager', 'hr')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = account_deletion_requests.organization_id
      and p.primary_role in ('admin', 'org_admin', 'super_admin', 'manager', 'hr')
  )
);
