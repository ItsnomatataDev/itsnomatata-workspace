-- Fix chat_conversations table to match expected schema
-- Remove old user_id column and ensure all required columns exist

-- Drop old policies that depend on user_id column
DROP POLICY IF EXISTS "Users can manage own conversations" ON chat_conversations;

-- Drop the old user_id column if it exists
ALTER TABLE chat_conversations DROP COLUMN IF EXISTS user_id;

-- Ensure all required columns exist
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS organization_id UUID;

ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS created_by UUID;

ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'direct';

-- Add check constraint for type values
ALTER TABLE chat_conversations 
DROP CONSTRAINT IF EXISTS chat_conversations_type_check;

ALTER TABLE chat_conversations 
ADD CONSTRAINT chat_conversations_type_check 
CHECK (type IN ('direct', 'group', 'department', 'announcement'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_organization_id ON chat_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_type ON chat_conversations(type);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_created_by ON chat_conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message_at ON chat_conversations(last_message_at DESC);

-- Update existing conversations to have organization_id from conversation members
UPDATE chat_conversations cc
SET organization_id = (
  SELECT p.organization_id 
  FROM chat_conversation_members ccm
  JOIN profiles p ON p.id = ccm.user_id
  WHERE ccm.conversation_id = cc.id
  LIMIT 1
)
WHERE cc.organization_id IS NULL;

-- Update existing conversations to have type
UPDATE chat_conversations
SET type = 'direct'
WHERE type IS NULL OR type = '';
