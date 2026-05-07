alter table public.leave_requests enable row level security;

drop policy if exists "Org members can view approved leave calendar rows"
  on public.leave_requests;

create policy "Org members can view approved leave calendar rows"
  on public.leave_requests
  for select
  to authenticated
  using (
    status = 'approved'
    and exists (
      select 1
      from public.profiles requester
      join public.profiles viewer
        on viewer.organization_id = requester.organization_id
      where requester.id = leave_requests.user_id
        and viewer.id = auth.uid()
        and requester.organization_id = leave_requests.organization_id
    )
  );
