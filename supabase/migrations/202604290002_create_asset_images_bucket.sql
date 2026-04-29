
INSERT INTO storage.buckets (id, name, public)
VALUES ('asset-images', 'asset-images', true)
ON CONFLICT (id) DO NOTHING;

-- Run these policies in Supabase SQL Editor (not via migration)
-- Enable RLS on storage.objects (run in Supabase SQL Editor)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read for asset images (run in Supabase SQL Editor)
-- CREATE POLICY "Public read for asset images"
--   ON storage.objects FOR SELECT
--   TO public
--   USING (bucket_id = 'asset-images');

-- Policy: Authenticated users can upload (run in Supabase SQL Editor)
-- CREATE POLICY "Authenticated users can upload asset images"
--   ON storage.objects FOR INSERT
--   TO authenticated
--   WITH CHECK (bucket_id = 'asset-images' AND auth.role() = 'authenticated');

-- Policy: Users can delete their own images (run in Supabase SQL Editor)
-- CREATE POLICY "Users can delete their own asset images"
--   ON storage.objects FOR DELETE
--   TO authenticated
--   USING (bucket_id = 'asset-images' AND auth.uid()::text = (storage.foldername(name))[1]);
