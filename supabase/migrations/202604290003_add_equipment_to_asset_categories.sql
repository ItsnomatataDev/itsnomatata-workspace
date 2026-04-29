-- Insert Equipment category row into asset_categories
INSERT INTO public.asset_categories (organization_id, name, description)
SELECT 
  id as organization_id,
  'Equipment' as name,
  'Equipment and machinery assets' as description
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM public.asset_categories 
  WHERE name = 'Equipment' 
  AND organization_id = organizations.id
);
