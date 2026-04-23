-- Add all missing columns to chat tables to match the expected schema
-- This migration brings the remote database in sync with the local schema

-- Add missing columns to chat_conversations
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

-- Add missing columns to chat_messages
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS sender_id UUID;

ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text';

ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS reply_to_message_id UUID;

ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS attachment_name TEXT;

ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE NOT NULL;

ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL;

ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add check constraint for message_type
ALTER TABLE chat_messages 
DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;

ALTER TABLE chat_messages 
ADD CONSTRAINT chat_messages_message_type_check 
CHECK (message_type IN ('text', 'image', 'audio', 'file', 'system'));

-- Create indexes for chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to ON chat_messages(reply_to_message_id);

-- Add foreign key constraints for chat_messages
ALTER TABLE chat_messages 
DROP CONSTRAINT IF EXISTS chat_messages_sender_id_fkey;

ALTER TABLE chat_messages 
ADD CONSTRAINT chat_messages_sender_id_fkey 
FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE chat_messages 
DROP CONSTRAINT IF EXISTS chat_messages_conversation_id_fkey;

ALTER TABLE chat_messages 
ADD CONSTRAINT chat_messages_conversation_id_fkey 
FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE;

-- Add missing columns to chat_conversation_members
ALTER TABLE chat_conversation_members 
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';

ALTER TABLE chat_conversation_members 
ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT FALSE NOT NULL;

ALTER TABLE chat_conversation_members 
ADD COLUMN IF NOT EXISTS last_read_message_id UUID;

-- Add check constraint for role
ALTER TABLE chat_conversation_members 
DROP CONSTRAINT IF EXISTS chat_conversation_members_role_check;

ALTER TABLE chat_conversation_members 
ADD CONSTRAINT chat_conversation_members_role_check 
CHECK (role IN ('owner', 'admin', 'member'));

-- Create indexes for chat_conversation_members
CREATE INDEX IF NOT EXISTS idx_chat_conversation_members_user_id ON chat_conversation_members(user_id);

-- Add foreign key constraints for chat_conversation_members
ALTER TABLE chat_conversation_members 
DROP CONSTRAINT IF EXISTS chat_conversation_members_user_id_fkey;

ALTER TABLE chat_conversation_members 
ADD CONSTRAINT chat_conversation_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE chat_conversation_members 
DROP CONSTRAINT IF EXISTS chat_conversation_members_conversation_id_fkey;

ALTER TABLE chat_conversation_members 
ADD CONSTRAINT chat_conversation_members_conversation_id_fkey 
FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE;

-- Add comments
COMMENT ON COLUMN chat_conversations.type IS 'Conversation type: direct, group, department, or announcement';
COMMENT ON COLUMN chat_conversation_members.user_id IS 'Foreign key to profiles table';
COMMENT ON COLUMN chat_messages.sender_id IS 'Foreign key to profiles table';
