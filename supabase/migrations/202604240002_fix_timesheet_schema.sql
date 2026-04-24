-- Fix existing timesheet_submissions table schema
-- Add missing columns if they don't exist

DO $$
BEGIN
    -- Add week_start column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'timesheet_submissions'
        AND column_name = 'week_start'
    ) THEN
        ALTER TABLE public.timesheet_submissions ADD COLUMN week_start date NOT NULL DEFAULT CURRENT_DATE;
    END IF;

    -- Add week_end column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'timesheet_submissions'
        AND column_name = 'week_end'
    ) THEN
        ALTER TABLE public.timesheet_submissions ADD COLUMN week_end date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '6 days');
    END IF;
END $$;

-- Drop and recreate the index
DROP INDEX IF EXISTS idx_timesheet_submissions_org_user_week;
CREATE INDEX idx_timesheet_submissions_org_user_week ON public.timesheet_submissions (organization_id, user_id, week_start, week_end);

-- Add organization_id to time_entries table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'time_entries'
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE public.time_entries ADD COLUMN organization_id uuid NOT NULL;
    END IF;
END $$;

-- Add duration_seconds to time_entries table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'time_entries'
        AND column_name = 'duration_seconds'
    ) THEN
        ALTER TABLE public.time_entries ADD COLUMN duration_seconds int;
    END IF;
END $$;

-- Add session_id to time_entries table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'time_entries'
        AND column_name = 'session_id'
    ) THEN
        ALTER TABLE public.time_entries ADD COLUMN session_id uuid;
    END IF;
END $$;
