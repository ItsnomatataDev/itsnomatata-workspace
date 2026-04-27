# Team Timesheets Fix Plan

## Steps

1. [ ] Create database migration adding admin/manager RLS policies for `time_entries`
2. [ ] Fix `board_id` reference in `getAdminTimeEntries()` (column doesn't exist)
3. [ ] Fix Sidebar import path typo in `TeamTimesheetsPage.tsx`
4. [ ] Test and verify fixes
