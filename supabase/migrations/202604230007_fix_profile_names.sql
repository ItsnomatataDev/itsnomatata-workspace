-- Fix missing full_name and email in profiles table
-- This migration updates profiles that have null full_name by using email as fallback
-- or setting a default name

UPDATE profiles
SET full_name = COALESCE(
  full_name,
  email,
  'User ' || SUBSTRING(id::text, 1, 8)
)
WHERE full_name IS NULL;

-- Also ensure email is not null if possible
-- Note: email might be null if using auth providers that don't provide it
-- In that case, we'll keep it null and rely on full_name
