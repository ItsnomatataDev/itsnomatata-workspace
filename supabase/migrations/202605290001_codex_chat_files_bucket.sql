
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'codex-chat-files',
  'codex-chat-files',
  true,
  15728640,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload codex chat files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'codex-chat-files');

CREATE POLICY "Users can view codex chat files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'codex-chat-files');

CREATE POLICY "Users can update codex chat files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'codex-chat-files');

CREATE POLICY "Users can delete codex chat files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'codex-chat-files');
