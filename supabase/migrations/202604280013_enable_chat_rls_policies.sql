ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own organization conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can insert conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can view own memberships" ON chat_conversation_members;
DROP POLICY IF EXISTS "Users can insert memberships" ON chat_conversation_members;
DROP POLICY IF EXISTS "Users can update own memberships" ON chat_conversation_members;
DROP POLICY IF EXISTS "Users can delete own memberships" ON chat_conversation_members;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON chat_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can view attachments in their conversations" ON chat_attachments;
DROP POLICY IF EXISTS "Users can insert attachments" ON chat_attachments;


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

-- Create policies for chat_messages
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

-- Create policies for chat_attachments
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



////