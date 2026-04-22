-- Migration: Fix RLS policies for board_time_settings table
-- Created: 2025-04-22
-- Purpose: Fix RLS policy violations by updating policies to work with proper authentication context

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view board time settings for their organization" ON board_time_settings;
DROP POLICY IF EXISTS "Users can update board time settings for their organization" ON board_time_settings;
DROP POLICY IF EXISTS "Users can insert board time settings for their organization" ON board_time_settings;

-- Create new policies that work with the actual authentication structure
CREATE POLICY "Users can view board time settings for their organization"
  ON board_time_settings FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update board time settings for their organization"
  ON board_time_settings FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert board time settings for their organization"
  ON board_time_settings FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );

-- Also fix board_assignments RLS policies if needed
DROP POLICY IF EXISTS "Users can view board assignments for their organization" ON board_assignments;
DROP POLICY IF EXISTS "Users can update board assignments for their organization" ON board_assignments;
DROP POLICY IF EXISTS "Users can insert board assignments for their organization" ON board_assignments;
DROP POLICY IF EXISTS "Users can delete board assignments for their organization" ON board_assignments;

CREATE POLICY "Users can view board assignments for their organization"
  ON board_assignments FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update board assignments for their organization"
  ON board_assignments FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert board assignments for their organization"
  ON board_assignments FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete board assignments for their organization"
  ON board_assignments FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );
