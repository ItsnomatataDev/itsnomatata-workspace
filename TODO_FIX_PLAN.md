# Fix Plan: Time Tracking, Boards, Task Cards & Dashboard Flow

## Information Gathered

### Current Architecture

- **Shared time hook**: `useTimeEntries` in `src/lib/hooks/useTimeEntries.ts` — the canonical hook for time tracking
- **Dashboard**: `DashboardPage.tsx` has its own isolated `startTimer`/`stopTimer` in `useDashboard.ts` (duplicates logic)
- **TasksWorkspacePage**: Uses `useTimeEntries` properly + `useTasks` for task board
- **BoardViewPage**: Has its OWN isolated timer logic (`handleTrack`, `handlePauseTimer`, `loadActiveTimer`) that directly hits Supabase — NOT using `useTimeEntries`
- **BoardViewPage CardDetailModal**: `onToggleTimer` prop is a dummy `console.log`
- **TimeTrackingPage**: Imports `TasksPage` which doesn't exist (file is `TasksWorkspacePage.tsx`) — BROKEN PAGE
- **useTaskBoard hook**: Uses `useTimeEntries` properly for project boards

### Key Problems

1. **3 separate timer implementations** → should use `useTimeEntries` everywhere
2. **BoardViewPage timer is isolated** → doesn't sync with dashboard or task workspace
3. **Dashboard My Tasks** → no link to task details, timer works but can't open card
4. **Broken TimeTrackingPage** → imports non-existent `TasksPage`
5. **BoardView CardDetailModal onToggleTimer** → dummy console.log
6. **BoardView drag-and-drop** → works but `moveCard` only updates status, not position
7. **Redundant `time-tracking` feature folder** → broken, should be removed

---

## Plan

### Phase 1: Consolidate Time Tracking (Critical)

#### File 1: `src/features/boards/pages/BoardViewPage.tsx`

- Replace isolated timer state with `useTimeEntries` hook
- Remove `loadActiveTimer`, `handleTrack`, `handlePauseTimer`, `activeTimer`, `liveSeconds`, `timerBusy`
- Use `useTimeEntries.startEntry`, `stopActiveEntry`, `activeEntry`, `mutating`
- Wire `CardDetailModal onToggleTimer` to actually start/stop timer via `useTimeEntries`
- Add `useEffect` to refresh board data when timer changes

#### File 2: `src/lib/hooks/useDashboard.ts`

- Replace isolated `startTimer`/`stopTimer` with calls to `useTimeEntries`
- OR: keep simple inline but ensure it uses same DB pattern
- Actually, better approach: make `useDashboard` return timer state from `useTimeEntries` instead of querying separately

#### File 3: `src/pages/DashboardPage.tsx`

- Ensure dashboard uses consolidated timer from `useDashboard` / `useTimeEntries`
- Add "Open task" button/link on each My Tasks row to navigate to task workspace or board

### Phase 2: Fix Broken Pages

#### File 4: `src/features/time-tracking/pages/TimeTrackingPage.tsx`

- Fix import: `TasksPage` → `TasksWorkspacePage`
- OR better: redirect to `/tasks` since it's the same thing
- **Decision**: Remove the `time-tracking` feature folder entirely and redirect route to `/tasks`

#### File 5: `src/app/router/AppRouter.tsx`

- Update `/time-tracking` route to redirect to `/tasks`
- Remove import of `TimeTrackingPage`

### Phase 3: Improve Board & Task Card Flow

#### File 6: `src/features/boards/pages/BoardViewPage.tsx` (continued)

- Wire `CardDetailModal` properly:
  - `onToggleTimer` → start/stop via `useTimeEntries`
  - `hasRunningTimer` → derive from `useTimeEntries.activeEntry`
  - Pass `currentUserId` and `organizationId` properly
- Add navigation from board card to task detail (or make CardDetailModal fully functional)
- Ensure drag-and-drop updates both status AND position in DB

#### File 7: `src/features/boards/components/Carddetailmodal.tsx`

- Fix `onToggleTimer` prop to actually work
- Ensure time tracking panel uses real data from props

### Phase 4: Dashboard My Tasks Improvements

#### File 8: `src/pages/DashboardPage.tsx`

- Add "View details" link on each task row → navigates to `/tasks` with task pre-opened
- OR: open a lightweight task detail modal directly on dashboard
- Add quick status change dropdown on dashboard tasks
- Ensure timer button states are consistent with workspace

### Phase 5: Cleanup

#### File 9: Remove `src/features/time-tracking/` folder

- Delete entire folder (broken/redundant)

#### File 10: `src/app/router/AppRouter.tsx`

- Clean up unused imports

---

## Dependent Files to Edit

1. `src/features/boards/pages/BoardViewPage.tsx`
2. `src/lib/hooks/useDashboard.ts`
3. `src/pages/DashboardPage.tsx`
4. `src/features/boards/components/Carddetailmodal.tsx`
5. `src/app/router/AppRouter.tsx`
6. `src/features/time-tracking/pages/TimeTrackingPage.tsx` (delete)
7. `src/features/time-tracking/components/*` (delete)
8. `src/features/time-tracking/services/*` (delete)

## Followup Steps

1. Test timer start/stop from dashboard
2. Test timer start/stop from board view
3. Test timer start/stop from task workspace
4. Verify all three show same active timer state
5. Test drag-and-drop on board
6. Test opening card detail from board
7. Run `npm run lint` to check for errors
