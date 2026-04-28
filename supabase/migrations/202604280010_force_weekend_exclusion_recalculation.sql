-- Force recalculation of leave days with weekend exclusion for IT'sNomatata
-- This specifically targets IT'sNomatata organization to ensure weekends are excluded

do $$
declare
  request_record record;
  new_days integer;
  previous_days integer;
  balance_diff integer;
  weekend_count integer;
  v_current_date date;
  v_is_weekend boolean;
begin
  -- Loop through all leave requests for IT'sNomatata
  for request_record in 
    select lr.id, lr.organization_id, lr.user_id, lr.start_date, lr.end_date, lr.requested_days, lr.status
    from public.leave_requests lr
    join public.organizations o on lr.organization_id = o.id
    where lr.status in ('pending', 'approved')
    and (o.slug = 'itsnomatata' or o.name ilike '%itsnomatata%')
  loop
    -- Calculate days excluding weekends manually for IT'sNomatata
    new_days := 0;
    v_current_date := request_record.start_date;
    
    while v_current_date <= request_record.end_date loop
      -- Check if it's a weekend (Saturday=6, Sunday=0 in PostgreSQL)
      v_is_weekend := extract(dow from v_current_date) in (0, 6);
      
      if not v_is_weekend then
        new_days := new_days + 1;
      end if;
      
      v_current_date := v_current_date + interval '1 day';
    end loop;
    
    previous_days := coalesce(request_record.requested_days, 0);
    
    -- Only update if there's a difference
    if new_days != previous_days then
      raise notice 'Updating request % for user %: % days -> % days', 
        request_record.id, request_record.user_id, previous_days, new_days;
      
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
          
          raise notice 'Deducting % additional days from user % balance', balance_diff, request_record.user_id;
        elsif balance_diff < 0 then
          -- Return days to the user
          update public.profiles
          set leave_days_remaining = least(
            leave_days_total,
            leave_days_remaining + abs(balance_diff)
          )
          where id = request_record.user_id;
          
          raise notice 'Returning % days to user % balance', abs(balance_diff), request_record.user_id;
        end if;
      end if;
    end if;
  end loop;
  
  raise notice 'Successfully recalculated leave days for IT''sNomatata requests with weekend exclusion.';
end $$;
