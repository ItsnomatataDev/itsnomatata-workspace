# Boards Enhancements Progress

**Requests:**

1. **Delete boards**
2. **Align board modal nicely**
3. **Activity: Show actual person/time** (already partial).

**Current:**

- BoardsGridPage.tsx: Grid + NewBoardModal (uses createClient).
- boardService.ts: No delete.
- BoardSidebar.tsx: Activity uses tasks.profiles.full_name (persons shown).

**Step-by-Step Plan:**

### ✅ Step 0: Analysis Complete

### ✅ Step 1: Add Delete Board

- [x] `boardService.ts` → `deleteBoard`.
- [x] BoardsGridPage.tsx → Delete button in dropdown (confirm + refetch).

### ✅ Step 2: Polish NewBoardModal

- [x] Responsive centering (p-4 md:p-8, max-w-sm sm:max-w-md).

### ✅ Step 3: Enhance Activity

- Already shows actual person (`profiles.full_name`) + time ago.

**Complete! 🎉**

- Delete: Dropdown + confirm (tasks unassigned).
- Modal: Responsive centered.
- Activity: Persons + time (existing).

Test: BoardsGridPage → Hover → Delete/Modal nice. `npm run dev` running!
