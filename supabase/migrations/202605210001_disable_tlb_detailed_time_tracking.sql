
update public.time_entries te
set
  ended_at = now(),
  is_running = false,
  duration_seconds = greatest(0, floor(extract(epoch from (now() - te.started_at)))::integer),
  metadata = coalesce(te.metadata, '{}'::jsonb) || jsonb_build_object(
    'auto_stopped', true,
    'auto_stop_reason', 'three_little_birds_time_tracking_disabled',
    'auto_stopped_at', now()
  ),
  updated_at = now()
from public.profiles p
join public.company_offices co on co.id = p.office_id
where te.user_id = p.id
  and te.organization_id = p.organization_id
  and co.slug = 'three-little-birds'
  and te.ended_at is null
  and coalesce(te.is_running, true) = true
  and te.deleted_at is null;

create or replace function public.prevent_tlb_detailed_time_tracking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_office_slug text;
begin
  if new.user_id is null then
    return new;
  end if;

  select co.slug
  into target_office_slug
  from public.profiles p
  join public.company_offices co on co.id = p.office_id
  where p.id = new.user_id
    and p.organization_id = new.organization_id
  limit 1;

  if target_office_slug = 'three-little-birds' then
    raise exception 'Detailed time tracking is disabled for Three Little Birds. Please use clock in and clock out only.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_tlb_time_entries_insert on public.time_entries;
create trigger prevent_tlb_time_entries_insert
before insert on public.time_entries
for each row
execute function public.prevent_tlb_detailed_time_tracking();

drop trigger if exists prevent_tlb_running_time_entries_update on public.time_entries;
create trigger prevent_tlb_running_time_entries_update
before update of ended_at, is_running, user_id, organization_id on public.time_entries
for each row
when (new.ended_at is null or coalesce(new.is_running, false) = true)
execute function public.prevent_tlb_detailed_time_tracking();

