# Security hardening — deploy checklist

After pulling these changes, apply migrations and redeploy edge functions.

## 1. Supabase migration

Run in SQL editor (or `supabase db push`):

- `supabase/migrations/202606040011_security_hardening_storage.sql`

This removes public read on `codex-chat-files` and tightens `content-review-assets` reads.

## 2. Edge function secrets (Dashboard → Edge Functions → Secrets)

| Secret | Purpose |
|--------|---------|
| `INTERNAL_API_KEY` | Long random value; required for `create-notification` (n8n), `check-time-tracking` cron, optional hardening |
| `N8N_NOTIFICATION_WEBHOOK_URL` | n8n email webhook (server only — do not use `VITE_*`) |
| `N8N_NOTIFICATION_WEBHOOK_SECRET` | n8n webhook auth header |
| `OPENAI_API_KEY` | Content Studio image analysis edge function |

Remove `VITE_N8N_NOTIFICATION_WEBHOOK_SECRET` from Edge secrets if set (use `N8N_NOTIFICATION_WEBHOOK_SECRET` only).

## 3. Deploy functions

```bash
supabase functions deploy send-push-notification --project-ref YOUR_REF
supabase functions deploy send-direct-email --project-ref YOUR_REF
supabase functions deploy content-studio-analyze-image --project-ref YOUR_REF
supabase functions deploy check-time-tracking --project-ref YOUR_REF
supabase functions deploy create-notification --project-ref YOUR_REF
supabase functions deploy dispatch-notification-email --project-ref YOUR_REF
supabase functions deploy livekit-guest-token --project-ref YOUR_REF
supabase functions deploy ai-chat --project-ref YOUR_REF
supabase functions deploy ai-assistance --project-ref YOUR_REF
```

## 4. Cron: `check-time-tracking`

Schedule with header:

`x-internal-api-key: <INTERNAL_API_KEY>`  
(or `x-cron-secret: <same value>`)

Do not call without this header.

## 5. Frontend `.env`

- Remove `VITE_N8N_NOTIFICATION_WEBHOOK_SECRET` from production builds.
- Keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only (anon key is expected public; RLS protects data).

## What changed

- **send-push-notification**: Requires service role or the notification owner’s session.
- **content-studio-analyze-image**: Requires login + Content Studio role; image URLs limited to Supabase storage.
- **check-time-tracking**: Requires internal API key.
- **ai-chat / ai-assistance**: Binds requests to the authenticated user’s org (no spoofed `organizationId`).
- **livekit-guest-token**: Join only with `meetingCode` (guest link), not raw meeting UUID.
- **create-notification**: Internal auth no longer accepts the public `apikey` header or `VITE_*` fallback.
- **sendEmailOnly**: Routes through `send-direct-email` edge function (secret stays on server).
- **Storage**: Codex chat files no longer world-readable.
