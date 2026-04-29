
CREATE POLICY "Users can view profiles of conversation members"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT user_id 
      FROM chat_conversation_members 
      WHERE conversation_id IN (
        SELECT conversation_id 
        FROM chat_conversation_members 
        WHERE user_id = auth.uid()
      )
    )
  );
