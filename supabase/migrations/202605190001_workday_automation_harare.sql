create index if not exists time_entries_auto_stop_idx
  on public.time_entries (is_running, ended_at, started_at)
  where is_running = true and ended_at is null and deleted_at is null;

do $$
declare
  vals text[] := array[
    'time_tracking_not_started',
    'time_tracking_timer_left_running',
    'attendance_auto_clock_out'
  ];
  v text;
begin
  if exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'notification_type'
  ) then
    foreach v in array vals loop
      begin
        execute format('alter type public.notification_type add value if not exists %L', v);
      exception when others then
      end;
    end loop;
  end if;
end;
$$;

create table if not exists public.notification_type_catalog (
  type text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

insert into public.notification_type_catalog (type, description)
values
  ('attendance_auto_clock_out', 'Automatic 18:00 Africa/Harare attendance clock-out'),
  ('time_tracking_not_started', 'Weekday 08:00 Africa/Harare reminder to clock in and start tracking'),
  ('time_tracking_timer_left_running', 'Automatic 18:00 Africa/Harare time tracking stop')
on conflict (type) do update set
  description = excluded.description;

-- Supabase scheduled function setup:
-- 08:00 Africa/Harare is 06:00 UTC. Runs Monday to Friday.
-- select cron.schedule(
--   'workday-start-reminder-harare-0800-weekdays',
--   '0 6 * * 1-5',
--   $$
--   select net.http_post(
--     url := current_setting('app.supabase_url') || '/functions/v1/attendance-clockin-reminder',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
--
-- 18:00 Africa/Harare is 16:00 UTC. Runs every day so no active session is left open.
-- select cron.schedule(
--   'workday-auto-stop-harare-1800',
--   '0 16 * * *',
--   $$
--   select net.http_post(
--     url := current_setting('app.supabase_url') || '/functions/v1/auto-clock-out',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
