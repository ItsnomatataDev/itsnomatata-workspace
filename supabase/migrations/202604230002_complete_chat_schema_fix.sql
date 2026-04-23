
DROP TABLE IF EXISTS chat_attachments CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_conversation_members CASCADE;
DROP TABLE IF EXISTS chat_conversations CASCADE;


CREATE TABLE chat_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    title TEXT,
    type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'department', 'announcement')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_message_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE chat_conversation_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    is_muted BOOLEAN DEFAULT FALSE NOT NULL,
    last_read_message_id UUID,
    UNIQUE(conversation_id, user_id)
);

CREATE TABLE chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    body TEXT,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'file', 'system')),
    reply_to_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
    attachment_url TEXT,
    attachment_name TEXT,
    is_edited BOOLEAN DEFAULT FALSE NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE chat_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('image', 'document', 'audio', 'video')),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
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

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization conversations" ON chat_conversations
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Users can insert conversations" ON chat_conversations
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Users can update own conversations" ON chat_conversations
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Users can view own memberships" ON chat_conversation_members
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert memberships" ON chat_conversation_members
    FOR INSERT WITH CHECK (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = user_id
            AND p.organization_id = (
                SELECT organization_id FROM chat_conversations 
                WHERE id = conversation_id
            )
        )
    );

CREATE POLICY "Users can update own memberships" ON chat_conversation_members
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own memberships" ON chat_conversation_members
    FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can view messages in their conversations" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_conversation_members 
            WHERE conversation_id = chat_messages.conversation_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages in their conversations" ON chat_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM chat_conversation_members 
            WHERE conversation_id = chat_messages.conversation_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own messages" ON chat_messages
    FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "Users can delete own messages" ON chat_messages
    FOR DELETE USING (sender_id = auth.uid());

CREATE POLICY "Users can view attachments in their conversations" ON chat_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_messages cm
            JOIN chat_conversation_members ccm ON ccm.conversation_id = cm.conversation_id
            WHERE cm.id = chat_attachments.message_id AND ccm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert attachments" ON chat_attachments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_messages cm
            WHERE cm.id = chat_attachments.message_id AND cm.sender_id = auth.uid()
        )
    );

CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_conversations
    SET 
        last_message_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_last_message_trigger
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();

GRANT ALL ON chat_conversations TO authenticated;
GRANT ALL ON chat_conversation_members TO authenticated;
GRANT ALL ON chat_messages TO authenticated;
GRANT ALL ON chat_attachments TO authenticated;

COMMENT ON TABLE chat_conversations IS 'Multi-user chat conversations';
COMMENT ON TABLE chat_conversation_members IS 'Members of chat conversations';
COMMENT ON TABLE chat_messages IS 'Messages within conversations';
COMMENT ON TABLE chat_attachments IS 'File attachments for messages';

COMMENT ON COLUMN chat_conversation_members.user_id IS 'Foreign key to profiles table';
COMMENT ON COLUMN chat_messages.sender_id IS 'Foreign key to profiles table';
