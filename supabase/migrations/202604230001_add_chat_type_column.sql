-- Add missing type column and other required columns to chat_conversations
-- This fixes the "column chat_conversations.type does not exist" error

-- Add type column with default value
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'direct';

-- Add organization_id column if missing
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Add created_by column if missing
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS created_by UUID;

-- Add last_message_at column if missing
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE;

-- Add check constraint for type values
ALTER TABLE chat_conversations 
DROP CONSTRAINT IF EXISTS chat_conversations_type_check;

ALTER TABLE chat_conversations 
ADD CONSTRAINT chat_conversations_type_check 
CHECK (type IN ('direct', 'group', 'department', 'announcement'));

-- Create index on type for performance
CREATE INDEX IF NOT EXISTS idx_chat_conversations_type ON chat_conversations(type);

-- Create index on organization_id for performance
CREATE INDEX IF NOT EXISTS idx_chat_conversations_organization_id ON chat_conversations(organization_id);

-- Update existing conversations to have organization_id from user's profile
UPDATE chat_conversations cc
SET organization_id = (
  SELECT organization_id FROM profiles p 
  WHERE p.id = cc.user_id 
  LIMIT 1
)
WHERE cc.organization_id IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN chat_conversations.type IS 'Conversation type: direct, group, department, or announcement';
