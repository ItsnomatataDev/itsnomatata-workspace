create index if not exists idx_time_entries_org_started_not_deleted
  on public.time_entries (organization_id, started_at desc)
  where deleted_at is null;

create index if not exists idx_time_entries_org_user_started_not_deleted
  on public.time_entries (organization_id, user_id, started_at desc)
  where deleted_at is null;

create index if not exists idx_time_entries_org_approval_started_not_deleted
  on public.time_entries (organization_id, approval_status, started_at desc)
  where deleted_at is null;

create index if not exists idx_time_entries_org_running
  on public.time_entries (organization_id, started_at)
  where ended_at is null and deleted_at is null;
