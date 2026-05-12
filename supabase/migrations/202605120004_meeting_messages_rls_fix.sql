
ALTER TABLE public.meeting_messages ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS "Users can view meeting messages" ON public.meeting_messages;
DROP POLICY IF EXISTS "Users can insert meeting messages" ON public.meeting_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.meeting_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.meeting_messages;


CREATE POLICY "Users can view meeting messages" ON public.meeting_messages
  FOR SELECT USING (
 
    EXISTS (
      SELECT 1 
      FROM public.meeting_participants 
      WHERE meeting_participants.meeting_id = meeting_messages.meeting_id 
        AND meeting_participants.user_id = auth.uid()
        AND meeting_participants.left_at IS NULL
    )
    OR

    meeting_messages.sender_id = auth.uid()
    OR

    EXISTS (
      SELECT 1 
      FROM public.meetings 
      WHERE meetings.id = meeting_messages.meeting_id 
        AND meetings.host_id = auth.uid()
    )
  );


CREATE POLICY "Users can insert meeting messages" ON public.meeting_messages
  FOR INSERT WITH CHECK (

    EXISTS (
      SELECT 1 
      FROM public.meeting_participants 
      WHERE meeting_participants.meeting_id = meeting_messages.meeting_id 
        AND meeting_participants.user_id = auth.uid()
        AND meeting_participants.left_at IS NULL
    )
    OR

    EXISTS (
      SELECT 1 
      FROM public.meetings 
      WHERE meetings.id = meeting_messages.meeting_id 
        AND meetings.host_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages" ON public.meeting_messages
  FOR UPDATE USING (
    meeting_messages.sender_id = auth.uid()
  );


CREATE POLICY "Users can delete their own messages" ON public.meeting_messages
  FOR DELETE USING (
    meeting_messages.sender_id = auth.uid()
  );


CREATE INDEX IF NOT EXISTS idx_meeting_messages_sender_created 
ON public.meeting_messages USING btree (sender_id, created_at desc);

CREATE INDEX IF NOT EXISTS idx_meeting_messages_meeting_sender 
ON public.meeting_messages USING btree (meeting_id, sender_id, created_at desc);


COMMENT ON TABLE public.meeting_messages IS 'Messages sent during meetings. RLS ensures users can only access messages from meetings they participate in.';

COMMENT ON POLICY "Users can view meeting messages" ON public.meeting_messages IS 'Allows users to read messages from meetings they participate in or host.';
COMMENT ON POLICY "Users can insert meeting messages" ON public.meeting_messages IS 'Allows users to send messages to meetings they participate in or host.';
