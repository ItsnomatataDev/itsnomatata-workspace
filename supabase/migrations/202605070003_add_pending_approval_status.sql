-- Add pending_approval status to account_status check constraint
-- This allows non-itsnomatata.com users to be in pending_approval state

-- Drop existing check constraint
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_account_status_check;

-- Recreate check constraint with pending_approval
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_account_status_check 
CHECK (account_status IN ('pending', 'pending_approval', 'active', 'suspended', 'rejected', 'deleted'));

-- Update existing 'pending' users to 'pending_approval' if they are not @itsnomatata.com
UPDATE public.profiles 
SET account_status = 'pending_approval' 
WHERE account_status = 'pending' 
AND email NOT LIKE '%@itsnomatata.com';

-- Update existing 'pending' users to 'active' if they are @itsnomatata.com
UPDATE public.profiles 
SET account_status = 'active' 
WHERE account_status = 'pending' 
AND email LIKE '%@itsnomatata.com';
