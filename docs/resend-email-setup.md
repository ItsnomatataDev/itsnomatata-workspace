# Resend Email Setup

Codex sends email only from Supabase Edge Functions. Do not put Resend keys in frontend `VITE_*` variables.

## Required Resend Setup

1. Verify a sending domain in Resend, for example `itsnomatata.com`.
2. Create a Resend API key.
3. Add these Supabase Edge Function secrets:

```bash
supabase secrets set EMAIL_PROVIDER=resend
supabase secrets set RESEND_API_KEY=re_xxxxxxxxx
supabase secrets set 'RESEND_FROM_EMAIL=Codex <notifications@itsnomatata.com>'
supabase secrets set RESEND_REPLY_TO_EMAIL=support@itsnomatata.com
```

Use an email address on a verified Resend domain for `RESEND_FROM_EMAIL`.

## Deploy Functions

```bash
supabase functions deploy create-notification
supabase functions deploy dispatch-notification-email
supabase functions deploy send-direct-email
```

## How Sending Works

- `create-notification` creates in-app notifications and sends email immediately when the `email` channel is enabled.
- `dispatch-notification-email` processes queued email deliveries.
- `send-direct-email` sends a direct authenticated email from the app.

Delivery rows in `notification_deliveries` are updated with:

- `provider = resend`
- `provider_message_id = <Resend email id>`
- `status = sent` or `failed`
- `error_message` when Resend rejects the request

## Optional Legacy n8n Mode

To use the old n8n email workflow instead:

```bash
supabase secrets set EMAIL_PROVIDER=n8n
supabase secrets set N8N_NOTIFICATION_WEBHOOK_URL=https://your-n8n-webhook
supabase secrets set N8N_NOTIFICATION_WEBHOOK_SECRET=your-secret
```

If `EMAIL_PROVIDER` is not set, the functions use Resend when `RESEND_API_KEY` exists; otherwise they use n8n.
