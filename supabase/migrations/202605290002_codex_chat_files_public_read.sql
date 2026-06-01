DROP POLICY IF EXISTS "Public read codex chat files" ON storage.objects;
CREATE POLICY "Public read codex chat files"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'codex-chat-files');
