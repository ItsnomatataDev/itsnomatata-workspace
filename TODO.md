# User Timesheet Module Implementation Plan

## Status: ✅ Approved & In Progress

## Breakdown Steps:

### Phase 1: Database Migration (2/2 ✅)

- [x] Create `supabase/migrations/202605100001_user_timesheet_adjustments.sql`
- [x] Apply migration (`supabase db push` ✅)

### Phase 2: Core Services (0/3)

- [ ] Extend `src/lib/supabase/mutations/timeEntries.ts` (adjustment functions)
- [ ] Update `src/lib/supabase/queries/timeEntries.ts` (grouping queries)
- [ ] New hook `src/lib/hooks/useUserTimesheet.ts`

### Phase 3: Route & Navigation (0/2)

- [ ] Add `/timesheet` route in `src/app/router/AppRouter.tsx`
- [ ] Add nav item in `src/components/dashboard/components/Sidebar.tsx`

### Phase 4: Main Page & Views (0/5)

- [ ] Create `src/features/timesheets/pages/UserTimesheetPage.tsx`
- [ ] Implement Today view + entries list
- [ ] Week/Month/All Time tabs
- [ ] Calendar integration
- [ ] Stats & totals

### Phase 5: Modals & Actions (0/4)

- [ ] `AddTimeModal.tsx` (manual entry)
- [ ] `RequestAdjustmentModal.tsx` (past edits)
- [ ] `TimeEntryActions.tsx` (edit/delete/adjust)
- [ ] Integrate timer controls

### Phase 6: Testing & Integration (0/3)

- [ ] Test adjustment workflow end-to-end
- [ ] Verify admin realtime reflection
- [ ] Performance: pagination for all-time view

## Current Progress: Phase 1 Next

**Next Action:** Create DB migration file
