# Resend Email Notifications Setup

Codex sends email only from Supabase Edge Functions. Do not put Resend keys in frontend `VITE_*` variables.

Resend is the default email provider. n8n is only used for email if `EMAIL_PROVIDER=n8n` is explicitly set.

## What Is Already Wired

- `create-notification` creates in-app notifications and sends email when the `email` channel is enabled.
- `dispatch-notification-email` processes queued email deliveries.
- `send-direct-email` sends direct authenticated emails from the app.
- `notification_deliveries` records provider, destination, provider message id, status, errors, attempt time, and delivery time.
- `system-health` reports whether Resend secrets are configured without exposing secret values.

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

These are Edge Function secrets, not `.env` / `VITE_*` variables.

## Deploy Functions

```bash
supabase functions deploy create-notification
supabase functions deploy dispatch-notification-email
supabase functions deploy send-direct-email
supabase functions deploy system-health
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

## Verify After Credentials Are Connected

1. Open the app as an authenticated user with an email address.
2. Go to Notifications.
3. Use the live notification test. It sends in-app, email, and push when available.
4. Confirm the email arrives from `RESEND_FROM_EMAIL`.
5. Check `notification_deliveries` for `provider = resend`, `status = sent`, and a Resend message id.
6. Check System Health as an admin/IT user. It should show:

```json
{
  "emailProvider": "resend",
  "resendApiKeyConfigured": true,
  "resendFromEmailConfigured": true,
  "resendReplyToEmailConfigured": true
}
```

## Expected Behavior Before Credentials

The app will choose Resend by default and return clear configuration errors such as:

- `RESEND_API_KEY is not configured`
- `RESEND_FROM_EMAIL is not configured`

That is expected until you connect the Resend account secrets.

## Optional Legacy n8n Mode

To use the old n8n email workflow instead:

```bash
supabase secrets set EMAIL_PROVIDER=n8n
supabase secrets set N8N_NOTIFICATION_WEBHOOK_URL=https://your-n8n-webhook
supabase secrets set N8N_NOTIFICATION_WEBHOOK_SECRET=your-secret
```

If `EMAIL_PROVIDER` is not set, the functions use Resend.
