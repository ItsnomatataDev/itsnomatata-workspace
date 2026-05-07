do $$
begin
  if to_regclass('public.attendance_sessions') is null then
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_sessions'
      and column_name = 'clock_in_at'
  ) then
    alter table public.attendance_sessions
      alter column clock_in_at set default now();

    update public.attendance_sessions
    set clock_in_at = coalesce(created_at, now())
    where clock_in_at is null;

    alter table public.attendance_sessions
      alter column clock_in_at set not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_sessions'
      and column_name = 'status'
  ) then
    alter table public.attendance_sessions
      alter column status set default 'active';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_sessions'
      and column_name = 'clock_in_method'
  ) then
    alter table public.attendance_sessions
      alter column clock_in_method set default 'web';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_sessions'
      and column_name = 'work_seconds'
  ) then
    alter table public.attendance_sessions
      alter column work_seconds set default 0;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_sessions'
      and column_name = 'device_info'
  ) then
    alter table public.attendance_sessions
      alter column device_info set default '{}'::jsonb;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_sessions'
      and column_name = 'location'
  ) then
    alter table public.attendance_sessions
      alter column location set default '{}'::jsonb;
  end if;
end $$;
