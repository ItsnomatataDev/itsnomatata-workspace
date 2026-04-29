# Manual Time Entry Upgrade - Implementation Plan

## Status: [ ] In Progress

### 1. Database Schema [x]

- [x] Migration file created: supabase/migrations/202604290001_add_entry_type_to_time_entries.sql ✅
- [ ] **Run manually**: `cd supabase && supabase db push`
  - Verify: SELECT entry_type FROM time_entries LIMIT 5;

### 2. Backend Mutations [x]

- [x] src/lib/supabase/mutations/timeEntries.ts: Added entry_type to SELECT/interface, set in inserts (start/resume/manual) ✅

### 3. Task Service API [x]

- [x] Created src/features/tasks/services/taskTimeService.ts: logTaskTime, getTaskTime with totals/entries/user names ✅
  - Imports createManualTimeEntry, getTrackedTimeByTask etc.

### 4. Frontend UI [ ]

- [ ] Edit src/features/tasks/components/EnhancedTaskCard.tsx: Add "Log Time Manually" Dialog
- [ ] Edit src/features/tasks/pages/TaskDetailsPage.tsx: Display entry_type, filter buttons

### 5. Queries [ ]

- [ ] Edit src/lib/supabase/queries/tasks.ts & timeEntries.ts: Include entry_type, user profile joins

### 6. Optional Performance [ ]

- [ ] Add total_time_cache to tasks table + trigger on time_entries changes

### 7. Testing [ ]

- [ ] Test timer → entry_type='timer'
- [ ] Test manual log → entry_type='manual', adds to total
- [ ] Admin views all, delete/edit
- [ ] UI updates refresh totals

### 8. Completion [ ]

- [ ] Update this TODO.md ✅ all checked
- [ ] Remove temp files

**Current Step: 1/8**
