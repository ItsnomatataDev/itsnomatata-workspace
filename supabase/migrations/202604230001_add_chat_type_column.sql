
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'direct';

ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS organization_id UUID;

ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS created_by UUID;

ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE chat_conversations 
DROP CONSTRAINT IF EXISTS chat_conversations_type_check;

ALTER TABLE chat_conversations 
ADD CONSTRAINT chat_conversations_type_check 
CHECK (type IN ('direct', 'group', 'department', 'announcement'));

CREATE INDEX IF NOT EXISTS idx_chat_conversations_type ON chat_conversations(type);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_organization_id ON chat_conversations(organization_id);

UPDATE chat_conversations cc
SET organization_id = (
  SELECT organization_id FROM profiles p 
  WHERE p.id = cc.user_id 
  LIMIT 1
)
WHERE cc.organization_id IS NULL;

COMMENT ON COLUMN chat_conversations.type IS 'Conversation type: direct, group, department, or announcement';
