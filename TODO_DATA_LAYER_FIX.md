# Data Layer Fix for Team Timesheets - Progress

## Plan Implementation:

- [x] 1. Update src/lib/supabase/queries/adminTime.ts - Add tasks join, fix board_name via task.board_id, support from/to
- [x] 2. Update src/lib/hooks/useTeamTimesheetsRealtime.ts - Compute 2-week from/to, pass to query
- [x] 3. Test realtime data populates calendar/users
- [x] 4. Complete
