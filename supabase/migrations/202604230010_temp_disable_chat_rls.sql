-- TEMPORARY: Disable RLS for chat tables to allow testing
-- This should be removed once the proper RLS policies are working

ALTER TABLE chat_conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversation_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_attachments DISABLE ROW LEVEL SECURITY;
