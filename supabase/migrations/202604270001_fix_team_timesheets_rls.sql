-- Fix Team Timesheets: Add admin/manager RLS policies for time_entries
-- This allows team leads and admins to view all time entries in their organization

-- First, drop any existing admin policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can view all time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Managers can view all time entries" ON public.time_entries;

-- Policy: Admins can view all time entries in their organization
CREATE POLICY "Admins can view all time entries"
  ON public.time_entries FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE primary_role IN ('admin', 'super_admin')
        AND organization_id = time_entries.organization_id
    )
  );

-- Policy: Managers can view all time entries in their organization
CREATE POLICY "Managers can view all time entries"
  ON public.time_entries FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE primary_role = 'manager'
        AND organization_id = time_entries.organization_id
    )
  );

-- Also add update policies for admins/managers so they can stop timers or edit entries if needed
DROP POLICY IF EXISTS "Admins can update all time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Managers can update all time entries" ON public.time_entries;

CREATE POLICY "Admins can update all time entries"
  ON public.time_entries FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE primary_role IN ('admin', 'super_admin')
        AND organization_id = time_entries.organization_id
    )
  );

CREATE POLICY "Managers can update all time entries"
  ON public.time_entries FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles
      WHERE primary_role = 'manager'
        AND organization_id = time_entries.organization_id
    )
  );

