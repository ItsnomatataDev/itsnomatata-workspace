alter table public.duty_roster_duties
  add column if not exists assigned_user_id uuid references public.profiles(id) on delete set null;

create index if not exists duty_roster_duties_assigned_user_idx
  on public.duty_roster_duties (roster_id, assigned_user_id);
