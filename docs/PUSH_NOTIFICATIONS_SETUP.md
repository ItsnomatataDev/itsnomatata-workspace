# Web push notifications — setup and deploy

Your app uses **self-hosted Web Push (VAPID)** with Supabase Edge Functions. You do **not** need to sign up for Firebase, OneSignal, or Pusher for this flow.

## What you need to sign up for

| Service | Required? | Sign up / link |
|--------|-----------|----------------|
| **Supabase** | Yes (you already use it) | https://supabase.com/dashboard |
| **VAPID keys** | Yes (free, generate locally) | No signup — run `npm run generate:vapid-keys` |
| **Hosting with HTTPS** | Yes (production) | Vercel: https://vercel.com/signup — or your current host |
| **Chrome / Edge / Firefox** | No signup | Built-in push via browser vendor |
| **Firebase / OneSignal** | **No** (optional alternative only) | Skip unless you want a third-party provider |

### Direct links (bookmark these)

- Supabase project dashboard: https://supabase.com/dashboard/project/zirftywinscopzuuwdlg  
- Supabase Edge Functions: https://supabase.com/dashboard/project/zirftywinscopzuuwdlg/functions  
- Supabase Edge secrets: https://supabase.com/dashboard/project/zirftywinscopzuuwdlg/settings/functions  
- Supabase CLI install: https://supabase.com/docs/guides/cli/getting-started  
- Web Push / VAPID (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Push_API  
- `web-push` library: https://github.com/web-push-libs/web-push  

---

## Step 1 — Generate VAPID keys (one time)

From the project root:

```bash
npm run generate:vapid-keys
```

You get:

- **Public key** → frontend `VITE_VAPID_PUBLIC_KEY`
- **Private key** → Supabase secret `VAPID_PRIVATE_KEY` (never commit to git)

Use a contact email for the subject, e.g. `mailto:codex@itsnomatata.com`.

---

## Step 2 — Frontend environment (Vite)

Create or update `.env.local` (not committed):

```env
VITE_VAPID_PUBLIC_KEY=your_public_key_here
```

Rebuild and redeploy the frontend after setting this.

---

## Step 3 — Supabase Edge secrets

In the dashboard: **Project Settings → Edge Functions → Secrets**  
https://supabase.com/dashboard/project/zirftywinscopzuuwdlg/settings/functions

Add:

| Secret | Value |
|--------|--------|
| `VAPID_PUBLIC_KEY` | Same as `VITE_VAPID_PUBLIC_KEY` |
| `VAPID_PRIVATE_KEY` | Private key from step 1 |
| `VAPID_SUBJECT` | `mailto:codex@itsnomatata.com` |

Or via CLI:

```bash
supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:codex@itsnomatata.com" --project-ref zirftywinscopzuuwdlg
```

---

## Step 4 — Deploy edge functions

```bash
npm run deploy:push-functions
```

Or manually:

```bash
supabase functions deploy create-notification --project-ref zirftywinscopzuuwdlg
supabase functions deploy send-push-notification --project-ref zirftywinscopzuuwdlg
```

---

## Step 5 — Database

Ensure notification migrations are applied (includes `push_subscriptions`):

```bash
supabase db push --linked
```

---

## Step 6 — Enable on a device

1. Log in on **HTTPS** (or `localhost` in dev).  
2. Go to **Settings** → **Browser push** → **Enable on this device**, or use the bell menu.  
3. Allow the browser permission prompt.  
4. Confirm a row exists in `push_subscriptions` (Supabase Table Editor).

---

## Step 7 — Test with tab closed

1. Open **Notifications** page → send a test with push channel, or trigger any `notifyUser` event.  
2. **Close the browser tab** (app can be in background).  
3. You should see an OS notification; click opens the app URL.

Check `notification_deliveries` for `channel = push` and `status = sent`.

---

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| “Missing VITE_VAPID_PUBLIC_KEY” | Set env and rebuild frontend |
| Push delivery `skipped` / no subscriptions | User must enable push on that browser |
| Edge `VAPID keys required` | Set Supabase secrets and redeploy functions |
| Works on desktop, not iPhone | iOS 16.4+; often needs **Add to Home Screen** PWA |
| Permission denied | Reset site permission in browser settings |

---

## Architecture (already in repo)

- `src/features/notifications/services/pushService.ts` — subscribe / unsubscribe  
- `public/service-worker.js` — shows notification when tab closed  
- `supabase/functions/create-notification` — creates notification + queues push  
- `supabase/functions/send-push-notification` — sends via `web-push` + VAPID  

Default channels for most notifications: `in_app`, `email`, `push`.
