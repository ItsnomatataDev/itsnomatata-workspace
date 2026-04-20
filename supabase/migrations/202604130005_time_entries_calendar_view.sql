
DROP VIEW IF EXISTS time_entries_calendar CASCADE;

CREATE VIEW time_entries_calendar AS
SELECT
  te.organization_id,
  te.user_id,
  p.full_name as user_name,
  p.email as user_email,
  DATE(te.started_at) as entry_date,
  SUM(te.duration_seconds) as total_seconds,
  COUNT(*) as entry_count,
  JSON_AGG(
    JSON_BUILD_OBJECT(
      'project_id', te.project_id,
      'project_name', pr.name,
      'hours', te.duration_seconds / 3600.0,
      'is_billable', te.is_billable,
      'description', te.description,
      'entry_count', 1
    )
  ) as project_entries
FROM time_entries te
LEFT JOIN profiles p ON te.user_id = p.id
LEFT JOIN projects pr ON te.project_id = pr.id
WHERE te.approval_status IN ('pending', 'approved')
GROUP BY te.organization_id, te.user_id, p.full_name, p.email, DATE(te.started_at);

GRANT SELECT ON time_entries_calendar TO authenticated;