-- Migration: Add board notifications table
-- Created: 2025-04-22

-- Board notifications table
CREATE TABLE IF NOT EXISTS board_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_board_notifications_user_unread ON board_notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_board_notifications_board_user ON board_notifications(board_id, user_id);

-- RLS policies
ALTER TABLE board_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON board_notifications FOR SELECT
  USING (user_id = (auth.jwt() ->> 'user_id')::uuid);

CREATE POLICY "Users can update their own notifications"
  ON board_notifications FOR UPDATE
  USING (user_id = (auth.jwt() ->> 'user_id')::uuid);

CREATE POLICY "Users can insert notifications"
  ON board_notifications FOR INSERT
  WITH CHECK (user_id = (auth.jwt() ->> 'user_id')::uuid);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_board_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
CREATE TRIGGER update_board_notifications_updated_at
  BEFORE UPDATE ON board_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_board_notifications_updated_at();
