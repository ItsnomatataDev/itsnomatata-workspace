drop trigger if exists attendance_sessions_events_trigger on public.attendance_sessions;
drop function if exists public.log_attendance_event();

create or replace function public.log_attendance_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.system_events') is null then
    return new;
  end if;

  if (tg_op = 'INSERT') then
    begin
      insert into public.system_events (
        organization_id,
        user_id,
        event_type,
        event_category,
        severity,
        title,
        description,
        metadata,
        source
      )
      values (
        new.organization_id,
        new.user_id,
        'clock_in',
        'attendance',
        'info',
        'User Clocked In',
        'User started their attendance session',
        jsonb_build_object(
          'session_id', new.id,
          'clock_in_at', new.clock_in_at,
          'clock_in_method', new.clock_in_method
        ),
        new.clock_in_method
      );
    exception
      when others then
        return new;
    end;
  end if;

  if (
    tg_op = 'UPDATE'
    and old.clock_out_at is null
    and new.clock_out_at is not null
  ) then
    begin
      insert into public.system_events (
        organization_id,
        user_id,
        event_type,
        event_category,
        severity,
        title,
        description,
        metadata,
        source
      )
      values (
        new.organization_id,
        new.user_id,
        'clock_out',
        'attendance',
        'info',
        'User Clocked Out',
        'User ended their attendance session',
        jsonb_build_object(
          'session_id', new.id,
          'clock_in_at', new.clock_in_at,
          'clock_out_at', new.clock_out_at,
          'work_seconds', new.work_seconds
        ),
        coalesce(new.clock_out_method, new.clock_in_method, 'web')
      );
    exception
      when others then
        return new;
    end;
  end if;

  return new;
end;
$$;

create trigger attendance_sessions_events_trigger
after insert or update on public.attendance_sessions
for each row execute function public.log_attendance_event();
