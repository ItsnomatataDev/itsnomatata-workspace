-- Migration: Add board time settings and assignments tables
-- Created: 2025-04-22

-- Board time settings table
CREATE TABLE IF NOT EXISTS board_time_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  estimated_hours DECIMAL(10,2) DEFAULT 40,
  is_billable BOOLEAN DEFAULT true,
  billing_type TEXT CHECK (billing_type IN ('hourly', 'fixed')) DEFAULT 'hourly',
  hourly_rate DECIMAL(10,2) DEFAULT 0,
  fixed_price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(board_id, organization_id)
);

-- Board assignments table
CREATE TABLE IF NOT EXISTS board_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE(board_id, user_id, organization_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_board_time_settings_board_org ON board_time_settings(board_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_board_assignments_board_org ON board_assignments(board_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_board_assignments_user_org ON board_assignments(user_id, organization_id);

-- RLS policies for board_time_settings
ALTER TABLE board_time_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view board time settings for their organization"
  ON board_time_settings FOR SELECT
  USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "Users can update board time settings for their organization"
  ON board_time_settings FOR UPDATE
  USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "Users can insert board time settings for their organization"
  ON board_time_settings FOR INSERT
  WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- RLS policies for board_assignments
ALTER TABLE board_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view board assignments for their organization"
  ON board_assignments FOR SELECT
  USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "Users can update board assignments for their organization"
  ON board_assignments FOR UPDATE
  USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "Users can insert board assignments for their organization"
  ON board_assignments FOR INSERT
  WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

CREATE POLICY "Users can delete board assignments for their organization"
  ON board_assignments FOR DELETE
  USING (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_board_time_settings_updated_at
  BEFORE UPDATE ON board_time_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
