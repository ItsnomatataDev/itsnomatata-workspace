# Content Studio — AI copy via n8n

You **do not need** a separate `OPENAI_API_KEY` in Supabase if your Codex n8n workflow already has OpenAI connected.

## Caption assist (Generate caption / Rewrite)

The Write tab sends `metadata.source: "content_studio_caption"` and `forceTextOnly: true` so n8n must **not** route to image generation.

**If you see:** *“I could not return a generated image because no visible image attachment was produced”* — the workflow treated caption copy as an image request (often because the old router matched words like `instagram` in the prompt).

**Fix:** Re-import `itsnomatata-codex-internal-ai.production.workflow.json` (router patch forces caption requests to `main_agent` and tightens image-generation matching).

**You do not need OpenAI on Supabase** if n8n already has OpenAI — caption and image analysis use `VITE_N8N_AI_WEBHOOK_URL` only by default.

If you see *“Failed to send a request to the Edge Function”*, that was an **optional** Supabase fallback that is **not deployed** — the app no longer surfaces that as the main error; fix **n8n** instead (below).

Optional env for Content Studio AI routes (defaults to `VITE_N8N_AI_WEBHOOK_URL`):

```env
VITE_N8N_CONTENT_AI_WEBHOOK_URL=https://your-n8n-host/webhook/.../chat
```

Dev proxies: `/api/content-studio/generate-caption` and `/api/content-studio/analyze-media-caption`.

Optional edge (only if you want a Supabase backup): set `VITE_CONTENT_STUDIO_EDGE_AI=true` in `.env` and deploy the functions.

---

## Image analysis

The app calls your existing chat webhook (`VITE_N8N_AI_WEBHOOK_URL`) with:

- An image attachment URL (from `content-review-assets` storage)
- `metadata.source: "content_studio_image_analysis"`
- Prompt asking for strict JSON (mood, sceneDescription, generatedCaption, hashtags, …)

## n8n checklist

1. **Workflow active** — ITsNomatata Codex Internal AI (or your chat webhook workflow) is published, not test-only.
2. **OpenAI credential** — **06 Codex Main Agent** and **Image Analysis Tool** must use the same working **OpenAI account** credential (re-import the workflow JSON if Image Analysis still references empty `$vars.OPENAI_API_KEY`).
3. **Supabase storage (recommended)** — in n8n **Variables**, set:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `INTERNAL_API_KEY` (same as app `.env`)  
   So **04b Codex Process Input** can sign private image URLs. Also set on Supabase: `supabase secrets set OPENAI_API_KEY=sk-...` and redeploy `codex-process-input` (otherwise intake is skipped — workflow still runs, but private files are not pre-processed).
4. **Re-import router patch** — `itsnomatata-codex-internal-ai.production.workflow.json` includes `content_studio_caption` / `content_studio_image_analysis` routing.

## `{"message":"Error in workflow"}` (HTTP 500)

This is n8n’s generic failure — the webhook was hit but a node crashed (often **Content Studio Vision (OpenAI Direct)** before the fix).

1. **Re-import + publish** `n8n/itsnomatata-codex-internal-ai.production.workflow.json` (includes **Content Studio Vision Prep**, chat/completions vision, `continueOnFail`).
2. n8n → **Executions** → latest failed run → note the **red node**.
3. Open **Content Studio Vision (OpenAI Direct)** → credential **OpenAi account** must be valid (same as Codex).
4. Confirm the post image URL opens in a browser (signed URL from Content Studio).
5. Optional backup: `supabase secrets set OPENAI_API_KEY=sk-...` and deploy `content-studio-analyze-image` (the app tries this before n8n).
6. Dev: restart `npm run dev` after `.env` changes so `/api/content-studio/*` proxies to `VITE_N8N_AI_WEBHOOK_URL`.

## Recommended: one OpenAI key in n8n (no Supabase duplicate)

Content Studio **Analyze image** uses the same webhook as Codex (`VITE_N8N_AI_WEBHOOK_URL`) with `metadata.source: content_studio_image_analysis`.

The production workflow includes a **Content Studio Vision (OpenAI Direct)** branch: it calls your existing **OpenAi account** credential in n8n (same key you already use) and returns JSON — it does not rely on the main agent guessing.

**After pulling the latest workflow JSON:**

1. n8n → **Import** `n8n/itsnomatata-codex-internal-ai.production.workflow.json`
2. **Publish** the workflow (not test-only)
3. Confirm **Content Studio Vision (OpenAI Direct)** uses your **OpenAi account** credential
4. Optional n8n **Variables** (helps `04b Codex Process Input` sign private storage URLs):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `INTERNAL_API_KEY` (same as app `.env`)

Captions and rewrites still go through **06 Codex Main Agent** (`content_studio_caption`).

## Optional Supabase edge (off by default)

Only if you want a backup when n8n is down: set `VITE_CONTENT_STUDIO_EDGE_AI=true` and deploy `content-studio-analyze-image` with `OPENAI_API_KEY` on Supabase. **Not required** if n8n vision works.

## Quick test in n8n

Run **05 Permission + Tool Router** with sample JSON:

```json
{
  "chatInput": "Analyze this image for social content.",
  "attachments": [{ "type": "image", "url": "https://example.com/photo.jpg", "name": "test.jpg" }],
  "metadata": { "source": "content_studio_image_analysis" }
}
```

Expect `route` logic to treat this as an image vision request and the agent to call **Image Analysis Tool**.
