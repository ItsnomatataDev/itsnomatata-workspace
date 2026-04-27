# Time Management Fix Plan

## Phase 1 — Admin Queries & Realtime Enrichment

- [x] Create TODO tracking file
- [x] Fix `src/lib/supabase/queries/adminTime.ts` — remove duplicate client/board queries
- [x] Fix `src/lib/hooks/useTeamTimesheetsRealtime.ts` — enrich INSERT payloads, add 1s polling for live timer updates
- [x] Fix `src/features/timesheets/pages/TeamTimesheetsPage.tsx` — wire date range, ensure live timer display

## Phase 2 — Shared Logic & Task Integration

- [x] Create `src/lib/utils/timeMath.ts` — extract shared duration helpers
- [x] Update `src/lib/supabase/mutations/timeEntries.ts` — wire `logTaskTimeTracked`, fix cost recalculation
- [x] Update `src/features/admin/services/adminService.ts` — use shared helpers

## Phase 3 — User-Side Realtime & Dashboard

- [x] Add realtime to `src/lib/hooks/useTimeEntries.ts`
- [x] Replace dashboard placeholder in `src/pages/DashboardPage.tsx` with real team data

## Phase 4 — Verification

- [x] Run TypeScript build to verify all changes compile — **PASSED**
- [ ] Test team timesheet live updates in browser
