# Fix TypeScript Error: startOfZimbabweWeek

## Steps:

- [x] Step 1: Edit src/lib/hooks/useUserTimesheet.ts to use the correct alias `startOfWeek` instead of `startOfZimbabweWeek`.
- [x] Step 2: Verify TypeScript error is resolved (confirmed: file now uses `from = startOfWeek(now);`, import intact).
- [x] Step 3: Complete task.
