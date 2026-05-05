# Advanced Notification Architecture

## Existing System Found

The workspace already had a working in-app notification system:

- `public.notifications` stores in-app notifications using legacy columns such as `message`, `action_url`, `is_read`, `priority`, `metadata`, `dedupe_key`, and `delivery_state`.
- `public.notification_deliveries` tracks channel delivery attempts for in-app, email, and push.
- `public.notification_preferences` existed as a granular per-type/per-channel preference table in later migrations.
- `NotificationProvider` loads notifications, subscribes to Supabase realtime changes, maintains unread count, and exposes mark-one and mark-all read actions.
- `NotificationBell` and `NotificationsPage` already support unread counts, empty/loading/error states, mark-as-read, mark-all-as-read, and test notification sending.
- `notificationService`, `notificationDeliveryService`, and `notificationOrchestrationService` centralize much of the existing in-app and multi-channel behavior.
- `supabase/functions/create-notification` provides a service-role fallback for internal/n8n-created notifications.
- Existing n8n workflow JSON files used direct webhook payloads from the frontend. The new architecture moves email delivery to a database queue.

## What Changed

- Added migration `supabase/migrations/202605050001_advanced_notification_architecture.sql`.
- Added `public.email_events` as the source-of-truth queue for n8n email processing.
- Added `public.notification_audit_logs` for append-only delivery and workflow audit records.
- Added requested global preference columns to `public.notification_preferences` while preserving existing per-type/per-channel compatibility.
- Added compatibility columns to `public.notifications`: `body`, `link`, `channel`, `status`, `sent_at`, and `actor_id`.
- Added a trigger to keep legacy columns and new canonical columns synchronized.
- Added a profile insert trigger that creates an in-app `welcome_user` notification.
- Added `advancedNotificationService.ts` for typed notification creation, email-event queueing, preference checks, dedupe support, actor exclusion, and bulk recipients.
- Updated email delivery to queue `email_events` instead of calling n8n directly from the browser.
- Added `/settings` notification preferences UI.
- Updated `NotificationProvider` to filter by the current organization.

## Notification Types

Supported advanced types:

- `welcome_user`
- `invited_to_workspace`
- `task_assigned`
- `task_due_soon`
- `task_status_changed`
- `task_comment_added`
- `task_mention`
- `chat_message_received`
- `weekly_time_summary`
- `monthly_time_summary`
- `time_tracking_not_started`
- `time_tracking_timer_left_running`
- `invoice_or_payment_notice`
- `project_deadline_reminder`
- `workspace_admin_notice`

Legacy aliases remain supported, including `task_updated`, `task_comment`, `chat_message`, `timesheet_reminder`, `invoice_update`, and existing leave/meeting/approval types.

## Email Event Payload

Example `email_events.payload`:

```json
{
  "title": "Task Assigned",
  "body": "A task has been assigned to you.",
  "action_url": "/tasks/123",
  "app_url": "https://workspace.example.com",
  "app_name": "Nomatata Workspace",
  "priority": "medium",
  "metadata": {
    "task_id": "123",
    "task_title": "Prepare monthly report"
  },
  "email_html": "<!DOCTYPE html>...",
  "email_text": "A task has been assigned to you."
}
```

## n8n Workflow 1: Process Pending Email Events

Trigger:

- Schedule Trigger every 1 to 5 minutes, or Supabase Insert Webhook on `email_events`.

Nodes:

1. Schedule Trigger
2. Supabase Select or HTTP Request to fetch pending events
3. Split In Batches
4. Supabase Update: set `status='processing'`, increment `attempts`
5. Email Provider node: Resend, SendGrid, Brevo, SMTP, or Microsoft 365
6. IF success
7. Supabase Update success: set `status='sent'`, `sent_at=now()`
8. Supabase Update failure: set `status='pending'` or `status='failed'`, increment attempts, set `last_error`
9. Supabase Insert into `notification_audit_logs`

Fetch SQL:

```sql
select *
from public.email_events
where status = 'pending'
  and scheduled_for <= now()
  and attempts < 5
order by scheduled_for asc, created_at asc
limit 50;
```

Mark processing SQL:

```sql
update public.email_events
set status = 'processing',
    attempts = attempts + 1
where id = :email_event_id
  and status = 'pending'
returning *;
```

Mark sent SQL:

```sql
update public.email_events
set status = 'sent',
    sent_at = now(),
    last_error = null
where id = :email_event_id;
```

Mark retry or failed SQL:

```sql
update public.email_events
set status = case when attempts >= 5 then 'failed' else 'pending' end,
    last_error = :error_message
where id = :email_event_id;
```

Audit SQL:

```sql
insert into public.notification_audit_logs (
  organization_id,
  user_id,
  event_type,
  channel,
  status,
  metadata
) values (
  :organization_id,
  :user_id,
  :event_type,
  'email',
  :status,
  jsonb_build_object('email_event_id', :email_event_id, 'provider', :provider)
);
```

## n8n Workflow 2: New User Welcome Email

Trigger:

- Use Workflow 1 with `event_type='welcome_user'`, or a Supabase webhook on `profiles` insert that calls the app notification service/Edge Function.

Nodes:

1. Supabase Trigger or filtered pending `email_events`
2. Fetch profile and organization details if needed
3. Email Provider node using `payload.email_html`
4. Update `email_events.status`
5. Insert `notification_audit_logs`

Expected subject:

```text
Welcome to [Workspace/App Name]
```

## n8n Workflow 3: Task and Collaboration Notifications

Trigger:

- Supabase webhooks for `tasks`, `task_comments`, `task_assignees`, `task_watchers`, or mention parsing.

Steps:

1. Determine organization and actor.
2. Resolve recipients from assignees, watchers, project members, or mentioned users.
3. Exclude actor.
4. Check whether a matching `dedupe_key` already exists in `notifications`.
5. Create notification rows through the app service or `create-notification` Edge Function.
6. Let the app service create `email_events` where preferences allow.

Dedupe query:

```sql
select id
from public.notifications
where user_id = :user_id
  and dedupe_key = :dedupe_key
limit 1;
```

## n8n Workflow 4: Chat Message Notifications

Trigger:

- Supabase insert webhook on `chat_messages`.

Steps:

1. Fetch conversation members.
2. Exclude the sender.
3. Create in-app notifications.
4. Create email events only if `email_messages=true`.
5. Use batching or delayed email events for chat to reduce volume.

Conversation members SQL:

```sql
select user_id
from public.conversation_members
where conversation_id = :conversation_id
  and user_id <> :sender_id;
```

Suggested chat dedupe key:

```text
chat_message_received:[conversation_id]:[recipient_id]:[yyyy-mm-dd-hh]
```

## n8n Workflow 5: Weekly Time Summary

Trigger:

- Schedule every Friday afternoon.

Summary SQL:

```sql
select
  user_id,
  organization_id,
  sum(duration_seconds) as total_seconds,
  sum(case when is_billable then duration_seconds else 0 end) as billable_seconds,
  count(distinct project_id) as projects_worked,
  count(distinct task_id) as tasks_worked
from public.time_entries
where organization_id = :organization_id
  and started_at >= date_trunc('week', now())
  and started_at < date_trunc('week', now()) + interval '7 days'
  and deleted_at is null
group by user_id, organization_id;
```

Create `email_events` with `event_type='weekly_time_summary'`.

## n8n Workflow 6: Monthly Time Summary

Trigger:

- Schedule on the 1st day of every month.

Summary SQL:

```sql
select
  user_id,
  organization_id,
  sum(duration_seconds) as total_seconds,
  sum(case when is_billable then duration_seconds else 0 end) as billable_seconds,
  count(distinct project_id) as projects_worked,
  count(distinct task_id) as tasks_worked
from public.time_entries
where organization_id = :organization_id
  and started_at >= date_trunc('month', now() - interval '1 month')
  and started_at < date_trunc('month', now())
  and deleted_at is null
group by user_id, organization_id;
```

Create user summary events and optional admin summary events with `event_type='monthly_time_summary'`.

## n8n Workflow 7: Weekday Time Tracking Reminder

Trigger:

- Monday to Friday at 08:10 local business time.

Steps:

1. Fetch active users.
2. Exclude users on leave, public holidays, weekends, or inactive accounts where those tables exist.
3. Check whether the user has a timer or time entry today.
4. Check `email_time_tracking_reminders`.
5. Create `time_tracking_not_started` notification and email event.

No time today SQL:

```sql
select p.id, p.organization_id, p.email, p.full_name
from public.profiles p
where p.is_active = true
  and p.organization_id = :organization_id
  and not exists (
    select 1
    from public.time_entries te
    where te.user_id = p.id
      and te.organization_id = p.organization_id
      and te.started_at::date = current_date
      and te.deleted_at is null
  );
```

## n8n Workflow 8: Running Timer Reminder

Trigger:

- Every weekday late afternoon, for example 17:30.

SQL:

```sql
select
  te.id,
  te.organization_id,
  te.user_id,
  te.started_at,
  p.email,
  p.full_name
from public.time_entries te
join public.profiles p on p.id = te.user_id
where te.ended_at is null
  and te.deleted_at is null
  and te.started_at <= now() - interval '6 hours';
```

Create `time_tracking_timer_left_running` events with a dedupe key per timer ID.

## Email Provider Integration

No secrets are hardcoded. n8n should use provider credentials from n8n credentials or environment variables.

Supported integration points:

- Resend
- SendGrid
- Brevo
- SMTP
- Microsoft 365

Recommended environment variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
N8N_NOTIFICATION_WEBHOOK_SECRET
NOTIFICATION_EMAIL_PROVIDER
RESEND_API_KEY
SENDGRID_API_KEY
BREVO_API_KEY
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
SMTP_FROM_EMAIL
SMTP_FROM_NAME
MICROSOFT_TENANT_ID
MICROSOFT_CLIENT_ID
MICROSOFT_CLIENT_SECRET
VITE_APP_URL
VITE_N8N_NOTIFICATION_WEBHOOK_URL
VITE_N8N_NOTIFICATION_WEBHOOK_SECRET
```

## Manual Testing Checklist

- Optional seed SQL is available at `docs/notification-manual-test-seed.sql` for non-production workspaces.
- Create an in-app notification through `sendNotification`.
- Confirm it appears in `NotificationBell`.
- Confirm `/notifications` shows loading, empty, error, unread, and read states.
- Mark a single notification as read.
- Mark all notifications as read and confirm it only affects the current organization.
- Create a notification with `channels=['in_app','email']`.
- Confirm an `email_events` row is created when preferences allow email.
- Disable `email_enabled` in `/settings` and confirm no new `email_events` row is created.
- Disable `email_messages` and confirm chat email events are skipped.
- Create a notification with `actorUserId` equal to recipient and confirm actor exclusion in bulk flows.
- Re-send with the same `dedupeKey` and confirm no duplicate notification/email event.
- Confirm a user cannot read another user's notification with anon/authenticated client queries.
- Confirm an admin can read organization-level notification and audit data.
- Run n8n Workflow 1 and confirm `email_events.status` moves from `pending` to `sent`.
- Force provider failure and confirm `attempts` and `last_error` update.
- Confirm `notification_audit_logs` receives success and failure rows.

## Operational Notes

- The service role bypasses RLS and is the recommended n8n processing identity.
- The browser client should not update `email_events`; it should only create queue rows through typed services when RLS allows.
- Existing in-app notification behavior is preserved by keeping legacy columns synchronized.
- The global preferences row is identified by `notification_type='global'` and `channel='email'`.
