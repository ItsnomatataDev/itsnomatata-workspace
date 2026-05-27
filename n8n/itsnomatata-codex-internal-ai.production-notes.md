# Codex Internal AI Production Notes

Created artifacts:

- `n8n/itsnomatata-codex-internal-ai.production.workflow.json`
- `n8n/itsnomatata-ai-workspace-brain.system-prompt.md`
- `supabase/migrations/202605270002_codex_internal_ai_system.sql`

## What This Rebuild Does

This turns the current workflow into a structured Codex system:

```text
Chat frontend
-> Main Codex Agent
-> Permission/context loader
-> Tool router
-> Documents / People / Web / Images / Code / Tasks
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
GEMINI_API_KEY=
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

If you manually test a node inside n8n, make sure the incoming item contains
`chatInput`, or set the AI Agent `Prompt` field to:

```js
{{ $json.chatInput || $json.message }}
```

The frontend already sends `chatInput`, which is why the frontend can work even
when a manual n8n test fails.

Keep your existing OpenAI, Google Drive, and InfraNodus credentials in n8n.

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

- Replace the placeholder Google Search HTTP URL with a proper search API such as Tavily, SerpAPI, Brave Search, or Google Custom Search.
- Add dedicated Supabase RPC endpoints for permission-filtered document search.
- Add OCR for scanned PDFs/images.
- Add a real image generation provider node when you connect one later.
- Add task/project tool endpoints once you decide which workspace actions Codex may execute.

## Safety Defaults

- No Claude.
- OpenAI is primary.
- Gemini is backup only.
- Internal documents should not be sent to Gemini unless `allow_gemini_for_internal_docs` is enabled in your own settings layer.
- GraphRAG answers must be scoped to allowed company knowledge.
- Team answers must come from `team_members` or approved company knowledge, never guesses.
