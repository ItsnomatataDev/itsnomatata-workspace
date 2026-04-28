-- Add leave_settings column to organizations table
alter table public.organizations
  add column if not exists leave_settings jsonb not null default '{
    "exclude_weekends": false,
    "country_code": null,
    "include_public_holidays": false
  }'::jsonb;

-- Update existing organizations with default settings
update public.organizations
set leave_settings = '{
  "exclude_weekends": false,
  "country_code": null,
  "include_public_holidays": false
}'::jsonb
where leave_settings is null or leave_settings = '{}'::jsonb;
