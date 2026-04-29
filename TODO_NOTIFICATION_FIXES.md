# Notification System Fix Plan

## Goal

Make notifications fully working for chats, leave requests, approvals/rejections, card comments, and task assignees. Ensure ALL notifications are fetched properly.

## Phases

### Phase 1: Fix Card Comment Notifications

- [ ] `src/features/boards/services/boardService.ts` — add `getCardAssigneeAndWatcherIds()` helper
- [ ] `src/features/boards/components/Carddetailmodal.tsx` — call `notifyTaskCommented()` after `addCardComment()`

### Phase 2: Fix Board Card Assignee Notifications

- [ ] `src/features/boards/services/boardService.ts` — in `createCard()`, insert into `task_assignees` AND notify assignee
- [ ] `src/features/boards/components/Carddetailmodal.tsx` — in `handleAddAssignee()`, notify the added user

### Phase 3: Fix Task Update Assignee Notifications

- [ ] `src/lib/supabase/mutations/tasks.ts` — in `updateTask()`, detect new assignees and notify them

### Phase 4: Re-enable Email Delivery

- [ ] `src/features/notifications/services/notificationDeliveryService.ts` — call `triggerNotificationEmail()` after DB insert

### Phase 5: Fix Notification Hook State

- [ ] `src/app/providers/NotificationProvider.tsx` — add `loading`, `error`, `actionLoading` to context

### Phase 6: Align Email Preferences with notification_preferences Table

- [ ] `src/features/notifications/services/emailPreferencesService.ts` — read from `notification_preferences` table

### Phase 7: Ensure All Notifications Are Fetched

- [ ] `src/lib/supabase/queries/notifications.ts` — increase default limit, add pagination support
- [ ] `src/app/providers/NotificationProvider.tsx` — fetch all notifications properly

### Phase 8: Ensure DB Enums Support All Types

- [ ] Add missing `task_collaboration_invite` to `notification_type` enum if needed
