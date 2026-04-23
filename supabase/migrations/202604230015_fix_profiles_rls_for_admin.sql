-- Fix RLS policies for profiles table to allow admins to delete users
-- This resolves the "new row violates row-level security policy" error when deleting users

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can delete profiles" ON profiles;

-- Create comprehensive RLS policies for profiles table

-- Allow users to view profiles in their organization
CREATE POLICY "Users can view profiles in their organization"
  ON profiles FOR SELECT
  USING (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
    OR id = auth.uid()
  );

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Allow admins/managers to update profiles in their organization
CREATE POLICY "Admins can update profiles in their organization"
  ON profiles FOR UPDATE
  USING (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
    AND (
      (auth.jwt() ->> 'primary_role')::text IN ('admin', 'manager', 'super_admin')
      OR (auth.jwt() ->> 'role')::text IN ('admin', 'manager', 'super_admin')
    )
  );

-- Allow admins/managers to delete profiles in their organization
CREATE POLICY "Admins can delete profiles in their organization"
  ON profiles FOR DELETE
  USING (
    organization_id = (auth.jwt() ->> 'organization_id')::uuid
    AND (
      (auth.jwt() ->> 'primary_role')::text IN ('admin', 'manager', 'super_admin')
      OR (auth.jwt() ->> 'role')::text IN ('admin', 'manager', 'super_admin')
    )
    AND id != auth.uid() -- Prevent self-deletion
  );

-- Allow service role to bypass RLS (for system operations)
CREATE POLICY "Service role can manage all profiles"
  ON profiles FOR ALL
  USING (auth.role() = 'service_role');
