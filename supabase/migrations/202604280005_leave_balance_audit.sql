-- Create leave_balance_audit table for tracking balance modifications
create table if not exists public.leave_balance_audit (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null,
  user_id uuid not null,
  modified_by uuid not null,
  previous_total integer not null,
  new_total integer not null,
  previous_remaining integer not null,
  new_remaining integer not null,
  reason text not null,
  created_at timestamp with time zone not null default now(),
  constraint leave_balance_audit_organization_id_fkey foreign key (organization_id) references organizations(id) on delete cascade,
  constraint leave_balance_audit_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade,
  constraint leave_balance_audit_modified_by_fkey foreign key (modified_by) references profiles(id) on delete cascade
);

-- Create indexes
create index if not exists idx_leave_balance_audit_user on public.leave_balance_audit (user_id, created_at desc);
create index if not exists idx_leave_balance_audit_org on public.leave_balance_audit (organization_id, created_at desc);
create index if not exists idx_leave_balance_audit_modified_by on public.leave_balance_audit (modified_by, created_at desc);
