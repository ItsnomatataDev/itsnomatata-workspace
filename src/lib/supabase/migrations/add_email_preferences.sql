-- Add email preferences to profiles table
ALTER TABLE profiles 
ADD COLUMN email_preferences JSONB DEFAULT '{"all": true, "types": []}'::jsonb;


-- Create email tracking table
CREATE TABLE IF NOT EXISTS email_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  email_to TEXT NOT NULL,
  email_subject TEXT NOT NULL,
  email_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for email tracking
CREATE INDEX idx_email_tracking_user_id ON email_tracking(user_id);
CREATE INDEX idx_email_tracking_organization_id ON email_tracking(organization_id);
CREATE INDEX idx_email_tracking_status ON email_tracking(status);
CREATE INDEX idx_email_tracking_sent_at ON email_tracking(sent_at);
CREATE INDEX idx_email_tracking_type ON email_tracking(email_type);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for email_tracking
CREATE TRIGGER update_email_tracking_updated_at 
    BEFORE UPDATE ON email_tracking 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment to explain email preferences
COMMENT ON COLUMN profiles.email_preferences IS 'JSON object containing user email notification preferences. Structure: {all: boolean, types: string[], digest: boolean, digestTime: string, quietHours: {enabled: boolean, start: string, end: string}}';
