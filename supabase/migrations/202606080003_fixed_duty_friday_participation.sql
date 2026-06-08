alter table public.duty_definitions
  add column if not exists fixed_duty_participates_in_friday_rotation boolean not null default true;

update public.duty_definitions
set fixed_duty_participates_in_friday_rotation = true
where category = 'fixed_person'
  and fixed_duty_participates_in_friday_rotation is null;
