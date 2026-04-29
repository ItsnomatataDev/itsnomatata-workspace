DROP POLICY IF EXISTS "Users can view all members in their conversations" ON chat_conversation_members;
DROP POLICY IF EXISTS "Users can view profiles of conversation members" ON profiles;


CREATE OR REPLACE FUNCTION public.user_is_conversation_member(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM chat_conversation_members
    WHERE conversation_id = p_conversation_id
    AND user_id = auth.uid()
  );
$$;

CREATE POLICY "Users can view all members in their conversations"
  ON chat_conversation_members
  FOR SELECT
  USING (user_is_conversation_member(conversation_id));


CREATE POLICY "Users can view profiles of conversation members"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT user_id
      FROM chat_conversation_members
      WHERE user_is_conversation_member(conversation_id)
    )
  );

