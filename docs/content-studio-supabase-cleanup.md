# Content Studio — Supabase edge functions & media cleanup

## Storage bucket

All Content Studio uploads (images and videos) live in:

| Item | Value |
|------|--------|
| **Bucket id** | `content-review-assets` |
| **Dashboard** | Supabase → Storage → `content-review-assets` |

## Database tables

| Table | What it stores |
|-------|----------------|
| `content_review_assets` | Media attached to schedule posts (drafts) |
| `content_client_media` | Client media library (including copies synced from posts) |

Deleting only a row in the app does not always remove the file in storage; use the cleanup script below or Storage UI.

---

## Edge functions (optional backup for AI)

These already exist in `supabase/functions/`. Deploy when you want image/video-frame analysis without relying only on n8n.

### 1. Set secrets

```bash
cd /path/to/ITsNomatataWorkSpace
supabase link --project-ref zirftywinscopzuuwdlg
supabase secrets set OPENAI_API_KEY=sk-your-openai-key
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are usually already available to edge functions after link.

### 2. Deploy

```bash
supabase functions deploy content-studio-analyze-image
supabase functions deploy content-studio-generate-caption
```

Optional (Codex / signed URLs for n8n):

```bash
supabase functions deploy codex-process-input
supabase secrets set INTERNAL_API_KEY=your-internal-key
```

### 3. Verify

```bash
curl -sS "$VITE_SUPABASE_URL/functions/v1/content-studio-analyze-image" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png","clientName":"Test","postTitle":"Test"}'
```

There is **no** edge function dedicated to bulk-deleting media. Use the script below (service role) instead.

---

## Clean start — remove old / compressed videos

### Recommended: cleanup script

Uses `SUPABASE_SERVICE_ROLE_KEY` from `.env`.

**Preview (no deletes):**

```bash
npm run cleanup:content-media -- --dry-run
```

**Delete all videos** for your org (default from `DEFAULT_ORGANIZATION_ID` in `.env`):

```bash
npm run cleanup:content-media -- --videos-only --confirm
```

**One client only:**

```bash
npm run cleanup:content-media -- --client-id=<content-clients-uuid> --videos-only --confirm
```

**One schedule draft only:**

```bash
npm run cleanup:content-media -- --draft-id=<draft-uuid> --videos-only --confirm
```

**Delete all images + videos** (full media reset for the org):

```bash
npm run cleanup:content-media -- --all-media --confirm
```

Then in the app: upload fresh `.mp4` / `.mov` files directly on each post (avoid **Choose from library** until you have new uploads).

### Manual (Supabase Dashboard)

1. **Storage** → `content-review-assets` → delete folders/files (e.g. under your `organization_id/`).
2. **Table Editor** → delete rows from `content_review_assets` and `content_client_media` for that client/org.

SQL (service role / SQL editor only — double-check IDs):

```sql
-- Example: delete all video rows for one organization
delete from public.content_review_assets
where organization_id = 'ae975c01-c044-4c5d-b5b5-4b6a06b55957'
  and (asset_type = 'video' or mime_type like 'video/%');

delete from public.content_client_media
where organization_id = 'ae975c01-c044-4c5d-b5b5-4b6a06b55957'
  and (asset_type = 'video' or mime_type like 'video/%');
```

Storage files must still be removed separately if paths are orphaned.

---

## After cleanup

1. Restart `npm run dev`.
2. Re-upload originals on each post.
3. Re-import n8n workflow if AI image analysis still returns 500 (see `n8n/content-studio-image-analysis.md`).
