with matching_slots as (
  select
    a.id as assignment_id,
    (array_agg(s.id))[1] as slot_id,
    count(*) as match_count
  from public.employee_assignments a
  join public.assignment_slots s
    on s.organization_id = a.organization_id
   and s.location_id = a.location_id
   and s.status = 'open'
   and s.start_date <= a.end_date
   and s.end_date >= a.start_date
   and coalesce(s.temporary_role_id, '00000000-0000-0000-0000-000000000000'::uuid) =
       coalesce(a.temporary_role_id, '00000000-0000-0000-0000-000000000000'::uuid)
   and coalesce(s.start_time::text, '') = coalesce(a.start_time::text, '')
   and coalesce(s.end_time::text, '') = coalesce(a.end_time::text, '')
  where a.slot_id is null
    and a.status <> 'cancelled'
  group by a.id
)
update public.employee_assignments a
set
  slot_id = m.slot_id,
  updated_at = now()
from matching_slots m
where a.id = m.assignment_id
  and m.match_count = 1;
