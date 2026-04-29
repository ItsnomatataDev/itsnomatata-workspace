-- Manual Time Entry Upgrade: Add entry_type column to distinguish timer vs manual entries
-- Maintains append-only behavior, enables filtering/UI

-- Add column (idempotent)
ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS entry_type text 
DEFAULT 'timer' 
CHECK (entry_type IN ('timer', 'manual'));

-- Backfill existing entries based on source
UPDATE public.time_entries 
SET entry_type = CASE 
  WHEN COALESCE(source, '') IN ('timer', 'resume') THEN 'timer' 
  WHEN COALESCE(source, '') = 'manual' THEN 'manual'
  ELSE 'timer'  -- default for legacy
END 
WHERE entry_type IS NULL;

-- Index for queries/filtering
CREATE INDEX IF NOT EXISTS idx_time_entries_entry_type 
ON public.time_entries(organization_id, task_id, entry_type);

CREATE INDEX IF NOT EXISTS idx_time_entries_task_type 
ON public.time_entries(task_id, entry_type);

-- Update RLS if needed (existing policies already work)
-- Test: SELECT * FROM time_entries WHERE task_id = '...' ORDER BY created_at DESC;

COMMENT ON COLUMN public.time_entries.entry_type IS 'Distinguishes timer-based vs manual time entries for audit/UI filtering';
