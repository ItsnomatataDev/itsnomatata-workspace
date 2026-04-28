
create or replace view leave_day_recalculation_verification as
select 
  lr.id,
  lr.organization_id,
  o.name as organization_name,
  lr.user_id,
  p.full_name,
  p.email,
  lr.start_date,
  lr.end_date,
  lr.requested_days as current_requested_days,
  public.calculate_leave_requested_days(lr.organization_id, lr.start_date, lr.end_date) as calculated_days,
  (public.calculate_leave_requested_days(lr.organization_id, lr.start_date, lr.end_date) - lr.requested_days) as day_difference,
  lr.status,
  lr.created_at
from public.leave_requests lr
join public.organizations o on lr.organization_id = o.id
join public.profiles p on lr.user_id = p.id
where lr.status in ('pending', 'approved')
order by lr.created_at desc;


select * from leave_day_recalculation_verification;


select 
  organization_name,
  status,
  count(*) as total_requests,
  sum(current_requested_days) as total_current_days,
  sum(calculated_days) as total_calculated_days,
  sum(calculated_days - current_requested_days) as total_day_difference
from leave_day_recalculation_verification
group by organization_name, status
order by organization_name, status;
