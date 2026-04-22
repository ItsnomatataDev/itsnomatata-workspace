# Boards V2 Enhancements

**Refinements:**

1. **Delete: Confirmation modal** (no alert).
2. **BoardSidebar buttons working** (Share/Archive/Delete).
3. **Activity: Reliable person names** (no "Someone").

**Plan:**

### Step 1: Delete Confirmation Modal

- Create DeleteConfirmModal.
- BoardsGridPage delete button → open modal → call deleteBoard.

### Step 2: BoardSidebar Buttons

- Add archiveBoard, shareBoard to boardService.
- Wire handlers.

### Step 3: Fix Activity Names

- Enhance BoardSidebar activity query – fallback to profiles table join.

**Next:** Step 1.
