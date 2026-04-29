
DROP POLICY IF EXISTS "Users can view own memberships" ON chat_conversation_members;

CREATE POLICY "Users can view all members in their conversations" ON chat_conversation_members
  FOR SELECT USING (
    conversation_id IN (
      SELECT conversation_id 
      FROM chat_conversation_members 
      WHERE user_id = auth.uid()
    )
  );
