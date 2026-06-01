-- Allow additional CSV / spreadsheet MIME types (Windows often sends CSV as application/vnd.ms-excel)
UPDATE storage.buckets
SET allowed_mime_types = ARRAY(
  SELECT DISTINCT unnest(
    coalesce(allowed_mime_types, ARRAY[]::text[]) ||
    ARRAY['application/csv', 'text/tab-separated-values']
  )
)
WHERE id = 'codex-chat-files';
