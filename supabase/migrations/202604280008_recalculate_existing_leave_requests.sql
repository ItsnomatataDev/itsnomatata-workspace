-- Recalculate existing leave requests with new weekend and holiday exclusion logic
-- This will update requested_days for all existing leave requests based on organization settings

do $$
declare
  request_record record;
  new_days integer;
  previous_days integer;
  balance_diff integer;
begin
  -- Loop through all leave requests
  for request_record in 
    select lr.id, lr.organization_id, lr.user_id, lr.start_date, lr.end_date, lr.requested_days, lr.status
    from public.leave_requests lr
    where lr.status in ('pending', 'approved')
  loop
    -- Calculate new days using the updated function
    select public.calculate_leave_requested_days(
      request_record.organization_id,
      request_record.start_date,
      request_record.end_date
    ) into new_days;
    
    previous_days := coalesce(request_record.requested_days, 0);
    
    -- Update the leave request with new calculated days
    update public.leave_requests
    set requested_days = new_days
    where id = request_record.id;
    
    -- If the request was approved, adjust the user's balance
    if request_record.status = 'approved' then
      balance_diff := new_days - previous_days;
      
      if balance_diff > 0 then
        -- Need to deduct more days
        update public.profiles
        set leave_days_remaining = greatest(0, leave_days_remaining - balance_diff)
        where id = request_record.user_id;
      elsif balance_diff < 0 then
        -- Return days to the user
        update public.profiles
        set leave_days_remaining = least(
          leave_days_total,
          leave_days_remaining + abs(balance_diff)
        )
        where id = request_record.user_id;
      end if;
    end if;
  end loop;
  
  raise notice 'Successfully recalculated leave days for all existing requests.';
end $$;
