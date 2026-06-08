alter table public.profiles
  alter column leave_days_total set default 22;

alter table public.profiles
  alter column leave_days_remaining set default 22;

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'prevent_non_admin_leave_balance_profile_updates'
      and tgrelid = 'public.profiles'::regclass
  ) then
    execute 'alter table public.profiles disable trigger prevent_non_admin_leave_balance_profile_updates';
  end if;
end $$;

update public.profiles
set
  leave_days_total = 22,
  leave_days_remaining = least(greatest(coalesce(leave_days_remaining, 22), 0), 22)
where leave_days_total is distinct from 22
   or leave_days_remaining is null
   or leave_days_remaining < 0
   or leave_days_remaining > 22;

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'prevent_non_admin_leave_balance_profile_updates'
      and tgrelid = 'public.profiles'::regclass
  ) then
    execute 'alter table public.profiles enable trigger prevent_non_admin_leave_balance_profile_updates';
  end if;
end $$;
