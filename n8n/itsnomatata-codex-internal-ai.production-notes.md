# Codex Internal AI Production Notes

Created artifacts:

- `n8n/itsnomatata-codex-internal-ai.production.workflow.json`
- `n8n/itsnomatata-ai-workspace-brain.system-prompt.md`
- `supabase/migrations/202605270002_codex_internal_ai_system.sql`
- `supabase/migrations/202605270003_codex_generated_files.sql`
- `supabase/migrations/202605270004_codex_private_memory.sql`

## What This Rebuild Does

This turns the current workflow into a structured Codex system:

```text
Chat frontend
-> Main Codex Agent
-> Permission/context loader
-> Tool router
-> Private Memory / Documents / People / Web / Images / Code / Tasks
-> Safe response contract
```

OpenAI remains the primary model. Gemini is included as backup for cheaper summarization/classification, not as the main brain.

## Required n8n Variables

Because this n8n instance blocks `$env` access inside nodes with
`N8N_BLOCK_ENV_ACCESS_IN_NODE`, this workflow uses n8n Variables through
`$vars`.

Create these in the n8n UI under Variables:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
TAVILY_API_KEY=
CODEX_FILE_SERVICE_URL=
CODEX_FILE_SERVICE_KEY=
```

Do not use `$env.SUPABASE_URL` inside node fields on this server.

## Context Loading Note

The workflow now uses `03 Prepare User Context (Supabase Optional)` instead of
calling Supabase immediately for the profile. This avoids crashes when:

- the workflow is tested manually from n8n without frontend context
- `SUPABASE_URL` has not been created in n8n Variables yet
- env access is blocked by `N8N_BLOCK_ENV_ACCESS_IN_NODE`

The frontend already sends user context in the chat payload. Once n8n Variables
are configured, you can add a separate Supabase enrichment node after this
optional context node if you want live profile refresh.

For manual tests, send a payload like:

```json
{
  "chatInput": "Who maintains Codex?",
  "sessionId": "manual-test",
  "context": {
    "userId": "manual-user",
    "organizationId": "workspace-default",
    "fullName": "Manual Tester",
    "role": "admin",
    "department": "Tech",
    "currentModule": "ai-workspace"
  },
  "metadata": {
    "projectMemoryScope": "general"
  }
}
```

## Agent Prompt Field

The n8n `AI Agent` node expects a field named:

```text
chatInput
```

The workflow now preserves `chatInput` through:

- `02 Normalize Chat Payload`
- `04 Merge Request + User Context`
- `05 Permission + Tool Router`

The exported workflow now sets the `06 Codex Main Agent` prompt explicitly:

```text
Prompt Type: Define
Text: {{ $json.chatInput || $json.message }}
```

If you manually test a node inside n8n, make sure the incoming item contains
`chatInput`, or use the same AI Agent prompt expression:

```js
{{ $json.chatInput || $json.message }}
```

The frontend already sends `chatInput`, which is why the frontend can work even
when a manual n8n test fails.

Keep your existing OpenAI, Google Drive, and InfraNodus credentials in n8n.

## Document Training Flow

The document training branch must stay wired in this order:

```text
Document Training Trigger
-> Prepare Document Training Input
-> Has Uploaded Binary?
   -> true: Detect File Type
   -> false: Download File
-> Detect File Type
   -> PDF: Extract Text from PDF
   -> TXT/Markdown/CSV: Extract Text from File
-> Clean and Chunk Text
-> Summarize Chunk - OpenAI
-> Create Final Document Summary
-> Save Document Metadata to Supabase
-> Save Summary to InfraNodus GraphRAG
-> Document Learned Response
```

Do not connect `Document Training Trigger` directly to `Clean and Chunk Text`.
The trigger must first normalize the uploaded binary or download the Google
Drive file so extraction receives readable file data.

If extraction returns HTML, scripts, a login page, or a preview page, the
`Clean and Chunk Text` node now stops with a clear error. That means the
workflow received a webpage/preview instead of the real file binary.

## Private Long-Term Memory

Run:

```text
supabase/migrations/202605270004_codex_private_memory.sql
```

This creates `ai_memory_items`, scoped by:

- `organization_id`
- `user_id`
- optional `project_id`

The workflow has:

- `Private Memory Retrieval Tool`
- `Private Memory Save Tool`

This means Codex can remember user preferences and project decisions across new
chats, but it must not read or expose another user's memory.

## Image Analysis and Generation

`Image Analysis Tool` uses OpenAI vision through `OPENAI_API_KEY`. This is the
tool Codex should use when a user uploads a car photo, screenshot, invoice image,
or any picture and asks what can be seen.

`Image Generation Tool` now uses OpenAI directly through `OPENAI_API_KEY`.
OpenAI returns base64 image data, and Codex must convert it into a browser
attachment like `data:image/png;base64,...`.

Codex must not say an image was generated successfully unless the final response
contains a real browser-visible `url` or `download_url` attachment.

## Critical Manual Step

Open the `06 Codex Main Agent` node and paste the full contents of:

```text
n8n/itsnomatata-ai-workspace-brain.system-prompt.md
```

into the agent `systemMessage`.

## Credentials To Reconnect After Import

After importing the workflow JSON into n8n, reconnect:

- OpenAI credentials
- Google Drive OAuth credentials
- InfraNodus bearer token credentials
- Gemini API key through n8n Variables or credentials
- Supabase service role key through n8n Variables or credentials

## Known Production Improvements Still Recommended

- Add dedicated Supabase RPC endpoints for permission-filtered document search.
- Add OCR for scanned PDFs/images.
- Connect `CODEX_FILE_SERVICE_URL` to your PDF/export service.
- Add task/project tool endpoints once you decide which workspace actions Codex may execute.

## Safety Defaults

- No Claude.
- OpenAI is primary.
- Gemini is backup only.
- Internal documents should not be sent to Gemini unless `allow_gemini_for_internal_docs` is enabled in your own settings layer.
- GraphRAG answers must be scoped to allowed company knowledge.
- Team answers must come from `team_members` or approved company knowledge, never guesses.
