
alter table public.organizations
  add column if not exists leave_settings jsonb not null default '{
    "exclude_weekends": false,
    "country_code": null,
    "include_public_holidays": false
  }'::jsonb;

update public.organizations
set leave_settings = '{
  "exclude_weekends": false,
  "country_code": null,
  "include_public_holidays": false
}'::jsonb
where leave_settings is null or leave_settings = '{}'::jsonb;
