-- Remove unique constraint on serial_number to allow duplicates
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_org_serial_number_unique;
