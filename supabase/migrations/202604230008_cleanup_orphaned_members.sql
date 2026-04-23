-- Clean up orphaned conversation members before applying foreign key constraints
-- This removes members that reference conversations that don't exist

DELETE FROM chat_conversation_members
WHERE conversation_id NOT IN (SELECT id FROM chat_conversations);

-- Clean up orphaned messages that reference non-existent conversations
-- Only if the chat_messages table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages') THEN
        DELETE FROM chat_messages
        WHERE conversation_id NOT IN (SELECT id FROM chat_conversations);
    END IF;
END $$;
