do $$
begin
  if to_regclass('public.attendance_sessions') is null then
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_sessions'
      and column_name = 'clock_in_at'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_sessions'
      and column_name = 'clock_out_at'
  ) then
    return;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.attendance_sessions'::regclass
      and conname = 'attendance_sessions_clock_range_check'
  ) then
    alter table public.attendance_sessions
      add constraint attendance_sessions_clock_range_check
      check (clock_out_at is null or clock_out_at >= clock_in_at);
  end if;
end $$;
