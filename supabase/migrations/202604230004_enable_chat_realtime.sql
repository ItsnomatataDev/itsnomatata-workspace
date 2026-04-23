-- Enable realtime for chat tables
-- This allows the frontend to receive real-time updates for messages, conversations, and user presence

-- Add chat tables to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
