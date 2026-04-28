-- Create public_holidays table
create table if not exists public.public_holidays (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null,
  date date not null,
  name text not null,
  description text,
  is_recurring boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint public_holidays_organization_id_fkey foreign key (organization_id) references organizations(id) on delete cascade,
  constraint public_holidays_valid_date check (date is not null)
);

-- Create indexes
create index if not exists idx_public_holidays_org_date on public.public_holidays (organization_id, date);
create index if not exists idx_public_holidays_date on public.public_holidays (date);

-- Add trigger for updated_at
create trigger trg_public_holidays_updated_at
before update on public.public_holidays
for each row
execute function set_updated_at();

-- Insert Zimbabwe public holidays for 2026
-- These are the main public holidays in Zimbabwe
-- Note: Some dates may vary based on lunar calendar or government announcements

-- New Year's Day
insert into public.public_holidays (organization_id, date, name, description, is_recurring)
select 
  id as organization_id,
  '2026-01-01'::date as date,
  'New Year''s Day' as name,
  'New Year''s Day' as description,
  true as is_recurring
from public.organizations
where slug = 'itsnomatata' or name ilike '%itsnomatata%';

-- Good Friday (varies by year - approximate for 2026)
insert into public.public_holidays (organization_id, date, name, description, is_recurring)
select 
  id as organization_id,
  '2026-04-03'::date as date,
  'Good Friday' as name,
  'Good Friday' as description,
  false as is_recurring
from public.organizations
where slug = 'itsnomatata' or name ilike '%itsnomatata%';

-- Easter Saturday (varies by year - approximate for 2026)
insert into public.public_holidays (organization_id, date, name, description, is_recurring)
select 
  id as organization_id,
  '2026-04-04'::date as date,
  'Easter Saturday' as name,
  'Easter Saturday' as description,
  false as is_recurring
from public.organizations
where slug = 'itsnomatata' or name ilike '%itsnomatata%';

-- Easter Monday (varies by year - approximate for 2026)
insert into public.public_holidays (organization_id, date, name, description, is_recurring)
select 
  id as organization_id,
  '2026-04-06'::date as date,
  'Easter Monday' as name,
  'Easter Monday' as description,
  false as is_recurring
from public.organizations
where slug = 'itsnomatata' or name ilike '%itsnomatata%';

-- Independence Day
insert into public.public_holidays (organization_id, date, name, description, is_recurring)
select 
  id as organization_id,
  '2026-04-18'::date as date,
  'Independence Day' as name,
  'Zimbabwe Independence Day' as description,
  true as is_recurring
from public.organizations
where slug = 'itsnomatata' or name ilike '%itsnomatata%';

-- Workers Day
insert into public.public_holidays (organization_id, date, name, description, is_recurring)
select 
  id as organization_id,
  '2026-05-01'::date as date,
  'Workers Day' as name,
  'International Workers Day' as description,
  true as is_recurring
from public.organizations
where slug = 'itsnomatata' or name ilike '%itsnomatata%';

-- Africa Day
insert into public.public_holidays (organization_id, date, name, description, is_recurring)
select 
  id as organization_id,
  '2026-05-25'::date as date,
  'Africa Day' as name,
  'Africa Day' as description,
  true as is_recurring
from public.organizations
where slug = 'itsnomatata' or name ilike '%itsnomatata%';

-- Heroes Day
insert into public.public_holidays (organization_id, date, name, description, is_recurring)
select 
  id as organization_id,
  '2026-08-10'::date as date,
  'Heroes Day' as name,
  'Heroes Day' as description,
  true as is_recurring
from public.organizations
where slug = 'itsnomatata' or name ilike '%itsnomatata%';

-- Defense Forces Day
insert into public.public_holidays (organization_id, date, name, description, is_recurring)
select 
  id as organization_id,
  '2026-08-11'::date as date,
  'Defense Forces Day' as name,
  'Defense Forces Day' as description,
  true as is_recurring
from public.organizations
where slug = 'itsnomatata' or name ilike '%itsnomatata%';

-- National Unity Day
insert into public.public_holidays (organization_id, date, name, description, is_recurring)
select 
  id as organization_id,
  '2026-12-22'::date as date,
  'National Unity Day' as name,
  'National Unity Day' as description,
  true as is_recurring
from public.organizations
where slug = 'itsnomatata' or name ilike '%itsnomatata%';

-- Christmas Day
insert into public.public_holidays (organization_id, date, name, description, is_recurring)
select 
  id as organization_id,
  '2026-12-25'::date as date,
  'Christmas Day' as name,
  'Christmas Day' as description,
  true as is_recurring
from public.organizations
where slug = 'itsnomatata' or name ilike '%itsnomatata%';

-- Boxing Day
insert into public.public_holidays (organization_id, date, name, description, is_recurring)
select 
  id as organization_id,
  '2026-12-26'::date as date,
  'Boxing Day' as name,
  'Boxing Day' as description,
  true as is_recurring
from public.organizations
where slug = 'itsnomatata' or name ilike '%itsnomatata%';
