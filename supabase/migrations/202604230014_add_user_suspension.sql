ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

COMMENT ON COLUMN profiles.is_suspended IS 'Whether the user account is suspended. Suspended users cannot login or access the system.';
COMMENT ON COLUMN profiles.suspended_at IS 'Timestamp when the user was suspended';
COMMENT ON COLUMN profiles.suspended_by IS 'ID of the admin who suspended this user';
COMMENT ON COLUMN profiles.suspension_reason IS 'Reason for user suspension (audit trail)';

CREATE INDEX IF NOT EXISTS idx_profiles_is_suspended ON profiles(is_suspended) WHERE is_suspended = TRUE;
