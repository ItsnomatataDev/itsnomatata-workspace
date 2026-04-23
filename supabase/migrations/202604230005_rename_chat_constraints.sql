-- Rename foreign key constraints to match expected names for Supabase nested queries
-- This preserves existing data while fixing the relationship detection

-- Drop existing auto-generated constraints and recreate with explicit names
ALTER TABLE chat_conversation_members DROP CONSTRAINT IF EXISTS chat_conversation_members_user_id_fkey;
ALTER TABLE chat_conversation_members DROP CONSTRAINT IF EXISTS chat_conversation_members_conversation_id_fkey;
ALTER TABLE chat_conversation_members ADD CONSTRAINT chat_conversation_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE chat_conversation_members ADD CONSTRAINT chat_conversation_members_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE;

-- Only apply chat_messages constraints if the table and columns exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages') THEN
        -- Check if sender_id column exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'sender_id') THEN
            ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_id_fkey;
            ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;
        END IF;
        
        -- Check if conversation_id column exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'conversation_id') THEN
            ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_conversation_id_fkey;
            ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;
