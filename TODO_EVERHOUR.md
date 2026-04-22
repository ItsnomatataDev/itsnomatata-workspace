# Everhour Dashboard (Boards = Projects)

## Status: Planning

## SQL First (Run in Supabase SQL Editor):

```
-- Aggregate view for board time stats
CREATE MATERIALIZED VIEW board_time_stats AS
SELECT
  te.client_id as board_id,
  p.full_name as user_name,
  p.email as user_email,
  DATE_TRUNC('day', te.started_at) as date,
  SUM(te.duration_seconds) as total_seconds,
  COUNT(te.id)::int as entry_count,
  BOOL_AND(te.is_running) as has_running,
  SUM(CASE WHEN te.approval_status = 'approved' THEN te.duration_seconds ELSE 0 END)::int as approved_seconds
FROM time_entries te
JOIN profiles p ON te.user_id = p.id
WHERE te.organization_id = ANY(
  SELECT organization_id FROM clients WHERE id = te.client_id
)
GROUP BY te.client_id, p.id, p.full_name, p.email, DATE_TRUNC('day', te.started_at);

-- Indexes
CREATE INDEX idx_time_entries_board_date ON time_entries(client_id, DATE_TRUNC('day', started_at));
CREATE INDEX idx_time_entries_board_user ON time_entries(client_id, user_id);
```

## Routes (New Sidebar Entry):

- `/everhour` – Homepage (top boards/users)
- `/everhour/boards/:id` – Board detail (users/time)
- `/everhour/team` – Improve TeamTimesheets
- `/everhour/calendar` – Calendar view

## Phase 1 Steps:

- [ ] 1. Run SQL
- [ ] 2. Add sidebar nav
- [ ] 3. Create EverhourHome page
- [ ] 4. Board detail page
- [ ] Complete
