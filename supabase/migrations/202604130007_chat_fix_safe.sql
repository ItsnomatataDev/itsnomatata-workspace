-- Safe fix for chat tables - handle existing data gracefully

-- First, check if tables exist and handle them safely
DO $$
BEGIN
    -- Drop triggers first to avoid dependency issues
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_conversation_activity_trigger') THEN
        DROP TRIGGER IF EXISTS update_conversation_activity_trigger ON chat_messages;
    END IF;
    
    -- Drop the function
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_conversation_activity') THEN
        DROP FUNCTION IF EXISTS update_conversation_activity();
    END IF;
    
    -- Drop policies first
    DROP POLICY IF EXISTS "Users can manage own conversations" ON chat_conversations;
    DROP POLICY IF EXISTS "Users can manage own messages" ON chat_messages;
    DROP POLICY IF EXISTS "Users can manage own attachments" ON chat_attachments;
    
    -- Drop tables in correct order (child tables first)
    DROP TABLE IF EXISTS chat_attachments CASCADE;
    DROP TABLE IF EXISTS chat_messages CASCADE;
    DROP TABLE IF EXISTS chat_conversations CASCADE;
END $$;

-- Create conversations table
CREATE TABLE chat_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL DEFAULT 'New Chat',
    role TEXT,
    context JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{
        "totalMessages": 0,
        "lastActivity": null,
        "tags": [],
        "isPinned": false,
        "isArchived": false
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create messages table
CREATE TABLE chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

-- Create attachments table
CREATE TABLE chat_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('image', 'document', 'audio', 'video')),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX idx_chat_conversations_updated_at ON chat_conversations(updated_at DESC);
CREATE INDEX idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX idx_chat_attachments_message_id ON chat_attachments(message_id);

-- Enable RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage own conversations" ON chat_conversations
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own messages" ON chat_messages
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own attachments" ON chat_attachments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM chat_messages cm
            WHERE cm.id = chat_attachments.message_id
            AND cm.user_id = auth.uid()
        )
    );

-- Create trigger function
CREATE OR REPLACE FUNCTION update_conversation_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_conversations
    SET 
        metadata = jsonb_set(
            jsonb_set(
                metadata, 
                '{totalMessages}', 
                COALESCE((metadata->>'totalMessages')::int, 0) + 
                CASE WHEN TG_OP = 'INSERT' AND NOT NEW.is_deleted THEN 1
                     WHEN TG_OP = 'UPDATE' AND OLD.is_deleted = false AND NEW.is_deleted = true THEN -1
                     ELSE 0 END
            ),
            '{lastActivity}', 
            to_jsonb(NOW())
        ),
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_conversation_activity_trigger
    AFTER INSERT OR UPDATE ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_activity();

-- Grant permissions
GRANT ALL ON chat_conversations TO authenticated;
GRANT ALL ON chat_messages TO authenticated;
GRANT ALL ON chat_attachments TO authenticated;

-- Create storage bucket for chat images if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-images',
    'chat-images',
    true,
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload chat images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'chat-images' AND
        auth.role() = 'authenticated'
    );

CREATE POLICY "Users can view own chat images" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'chat-images' AND
        auth.role() = 'authenticated'
    );

CREATE POLICY "Users can update own chat images" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'chat-images' AND
        auth.role() = 'authenticated'
    );

CREATE POLICY "Users can delete own chat images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'chat-images' AND
        auth.role() = 'authenticated'
    );

-- Grant storage permissions
GRANT ALL ON storage.buckets TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
