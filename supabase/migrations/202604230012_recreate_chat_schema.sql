-- Recreate chat tables with proper schema
-- This drops and recreates all chat tables to match the expected schema

-- Drop existing tables (cascade to drop dependencies)
DROP TABLE IF EXISTS chat_attachments CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_conversation_members CASCADE;
DROP TABLE IF EXISTS chat_conversations CASCADE;

-- Create chat_conversations table
CREATE TABLE chat_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    title TEXT,
    type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'department', 'announcement')),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_message_at TIMESTAMP WITH TIME ZONE
);

-- Create chat_conversation_members table
CREATE TABLE chat_conversation_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    is_muted BOOLEAN DEFAULT FALSE NOT NULL,
    last_read_message_id UUID,
    UNIQUE(conversation_id, user_id)
);

-- Create chat_messages table
CREATE TABLE chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    body TEXT,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'file', 'system')),
    reply_to_message_id UUID,
    attachment_url TEXT,
    attachment_name TEXT,
    is_edited BOOLEAN DEFAULT FALSE NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_attachments table
CREATE TABLE chat_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('image', 'document', 'audio', 'video')),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX idx_chat_conversations_organization_id ON chat_conversations(organization_id);
CREATE INDEX idx_chat_conversations_type ON chat_conversations(type);
CREATE INDEX idx_chat_conversations_created_by ON chat_conversations(created_by);
CREATE INDEX idx_chat_conversations_updated_at ON chat_conversations(updated_at DESC);
CREATE INDEX idx_chat_conversations_last_message_at ON chat_conversations(last_message_at DESC);

CREATE INDEX idx_chat_conversation_members_conversation_id ON chat_conversation_members(conversation_id);
CREATE INDEX idx_chat_conversation_members_user_id ON chat_conversation_members(user_id);

CREATE INDEX idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX idx_chat_messages_reply_to ON chat_messages(reply_to_message_id);

CREATE INDEX idx_chat_attachments_message_id ON chat_attachments(message_id);

-- Add foreign key constraints
ALTER TABLE chat_conversation_members 
ADD CONSTRAINT chat_conversation_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE chat_conversation_members 
ADD CONSTRAINT chat_conversation_members_conversation_id_fkey 
FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE;

ALTER TABLE chat_messages 
ADD CONSTRAINT chat_messages_sender_id_fkey 
FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE chat_messages 
ADD CONSTRAINT chat_messages_conversation_id_fkey 
FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE;

ALTER TABLE chat_messages 
ADD CONSTRAINT chat_messages_reply_to_message_id_fkey 
FOREIGN KEY (reply_to_message_id) REFERENCES chat_messages(id) ON DELETE SET NULL;

ALTER TABLE chat_attachments 
ADD CONSTRAINT chat_attachments_message_id_fkey 
FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE;

-- Disable RLS for now (can be re-enabled later with proper policies)
ALTER TABLE chat_conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversation_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_attachments DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON chat_conversations TO authenticated;
GRANT ALL ON chat_conversation_members TO authenticated;
GRANT ALL ON chat_messages TO authenticated;
GRANT ALL ON chat_attachments TO authenticated;

-- Add comments
COMMENT ON TABLE chat_conversations IS 'Multi-user chat conversations';
COMMENT ON TABLE chat_conversation_members IS 'Members of chat conversations';
COMMENT ON TABLE chat_messages IS 'Messages within conversations';
COMMENT ON TABLE chat_attachments IS 'File attachments for messages';

COMMENT ON COLUMN chat_conversations.type IS 'Conversation type: direct, group, department, or announcement';
COMMENT ON COLUMN chat_conversation_members.user_id IS 'Foreign key to profiles table';
COMMENT ON COLUMN chat_messages.sender_id IS 'Foreign key to profiles table';
