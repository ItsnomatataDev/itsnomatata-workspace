
CREATE TABLE IF NOT EXISTS public.timesheet_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text,
  submitted_at timestamp with time zone NULL,
  approved_at timestamp with time zone NULL,
  rejected_at timestamp with time zone NULL,
  approver_id uuid NULL,
  notes text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT timesheet_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT timesheet_submissions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT timesheet_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles (id) ON DELETE CASCADE,
  CONSTRAINT timesheet_submissions_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES profiles (id) ON DELETE SET NULL,
  CONSTRAINT timesheet_submissions_unique_week UNIQUE (user_id, week_start, week_end)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_timesheet_submissions_org_user_week ON public.timesheet_submissions (organization_id, user_id, week_start, week_end);
CREATE INDEX IF NOT EXISTS idx_timesheet_submissions_status ON public.timesheet_submissions (organization_id, status);

CREATE TABLE IF NOT EXISTS public.timesheet_entry_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  timesheet_submission_id uuid NOT NULL,
  time_entry_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT timesheet_entry_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT timesheet_entry_submissions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT timesheet_entry_submissions_timesheet_submission_id_fkey FOREIGN KEY (timesheet_submission_id) REFERENCES timesheet_submissions (id) ON DELETE CASCADE,
  CONSTRAINT timesheet_entry_submissions_time_entry_id_fkey FOREIGN KEY (time_entry_id) REFERENCES time_entries (id) ON DELETE CASCADE,
  CONSTRAINT timesheet_entry_submissions_unique UNIQUE (timesheet_submission_id, time_entry_id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_timesheet_entry_submissions_timesheet ON public.timesheet_entry_submissions (timesheet_submission_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_entry_submissions_time_entry ON public.timesheet_entry_submissions (time_entry_id);

DROP VIEW IF EXISTS public.timesheet_weekly_summary CASCADE;
CREATE VIEW public.timesheet_weekly_summary AS
SELECT
  te.organization_id,
  te.user_id,
  p.full_name AS user_name,
  DATE_TRUNC('week', te.started_at)::date AS week_start,
  (DATE_TRUNC('week', te.started_at)::date + INTERVAL '6 days')::date AS week_end,
  DATE(te.started_at) AS entry_date,
  te.project_id,
  pr.name AS project_name,
  te.task_id,
  t.title AS task_title,
  SUM(te.duration_seconds) AS total_seconds,
  BOOL_OR(te.is_billable) AS has_billable,
  COUNT(*) AS entry_count
FROM time_entries te
LEFT JOIN profiles p ON te.user_id = p.id
LEFT JOIN projects pr ON te.project_id = pr.id
LEFT JOIN tasks t ON te.task_id = t.id
WHERE te.approval_status IN ('pending', 'approved')
GROUP BY
  te.organization_id,
  te.user_id,
  p.full_name,
  week_start,
  week_end,
  entry_date,
  te.project_id,
  pr.name,
  te.task_id,
  t.title;

GRANT SELECT ON public.timesheet_weekly_summary TO authenticated;
