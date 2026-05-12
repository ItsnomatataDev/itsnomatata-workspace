-- Fix for meeting_messages RLS policy violation
-- Run this directly in Supabase SQL Editor

-- First, check if RLS is enabled
ALTER TABLE public.meeting_messages ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies that might be causing conflicts
DROP POLICY IF EXISTS "Users can view meeting messages" ON public.meeting_messages;
DROP POLICY IF EXISTS "Users can insert meeting messages" ON public.meeting_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.meeting_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.meeting_messages;

-- Create policy for reading meeting messages
CREATE POLICY "Users can view meeting messages" ON public.meeting_messages
  FOR SELECT USING (
    -- User is a participant in the meeting
    EXISTS (
      SELECT 1 
      FROM public.meeting_participants 
      WHERE meeting_participants.meeting_id = meeting_messages.meeting_id 
        AND meeting_participants.user_id = auth.uid()
        AND meeting_participants.left_at IS NULL
    )
    OR
    -- User is the sender of the message
    meeting_messages.sender_id = auth.uid()
    OR
    -- User is the host of the meeting
    EXISTS (
      SELECT 1 
      FROM public.meetings 
      WHERE meetings.id = meeting_messages.meeting_id 
        AND meetings.host_id = auth.uid()
    )
  );

-- Create policy for inserting meeting messages
CREATE POLICY "Users can insert meeting messages" ON public.meeting_messages
  FOR INSERT WITH CHECK (
    -- User must be a participant in the meeting
    EXISTS (
      SELECT 1 
      FROM public.meeting_participants 
      WHERE meeting_participants.meeting_id = meeting_messages.meeting_id 
        AND meeting_participants.user_id = auth.uid()
        AND meeting_participants.left_at IS NULL
    )
    OR
    -- User is the host of the meeting
    EXISTS (
      SELECT 1 
      FROM public.meetings 
      WHERE meetings.id = meeting_messages.meeting_id 
        AND meetings.host_id = auth.uid()
    )
  );

-- Create policy for updating own messages
CREATE POLICY "Users can update their own messages" ON public.meeting_messages
  FOR UPDATE USING (
    meeting_messages.sender_id = auth.uid()
  );

-- Create policy for deleting own messages
CREATE POLICY "Users can delete their own messages" ON public.meeting_messages
  FOR DELETE USING (
    meeting_messages.sender_id = auth.uid()
  );

-- Verify the policies were created
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'meeting_messages';
