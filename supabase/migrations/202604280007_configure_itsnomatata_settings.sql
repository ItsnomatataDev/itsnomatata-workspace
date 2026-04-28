-- Configure IT'sNomatata organization to exclude weekends and include public holidays
update public.organizations
set leave_settings = '{
  "exclude_weekends": true,
  "country_code": "ZW",
  "include_public_holidays": true
}'::jsonb
where slug = 'itsnomatata' or name ilike '%itsnomatata%';

-- Configure Three Little Birds organization to NOT exclude weekends (they work every day)
update public.organizations
set leave_settings = '{
  "exclude_weekends": false,
  "country_code": null,
  "include_public_holidays": false
}'::jsonb
where slug = 'three-little-birds' or name ilike '%three little birds%';
