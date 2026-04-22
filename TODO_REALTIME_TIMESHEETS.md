# Real-time TeamTimesheets ↔ Trello Sync

## Status: Active

## Phase 1 - Realtime System:

- [x] 1. Create `src/lib/hooks/useTeamTimesheetsRealtime.ts`
- [x] 2. Update `TeamTimesheetsPage.tsx` → replace useEffect polling with realtime hook (hook fixed, page already uses it)
- [x] 3. Test: Timer start on board → live update in timesheets calendar/charts
- [ ] 4. Add board filter dropdown (getBoards → client_id filter)

## Phase 2 Power:

- [ ] Budget variance
- [ ] Inline timers
- [ ] Task status sync

**Goal:** Live dashboard - Trello changes → instant timesheet refresh
