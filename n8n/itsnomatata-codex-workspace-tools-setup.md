# Codex Workspace Tools (Option A)

Connects the production n8n **06 Codex Main Agent** to real workspace actions via Supabase Edge Function `codex-execute-tool`.

## Deploy

```bash
supabase functions deploy codex-execute-tool
supabase functions deploy codex-process-input
supabase db push   # includes codex-chat-files bucket migration
```

## n8n Variables (required)

Add to n8n **Variables** (this server blocks `$env` in nodes):

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (tools only — never expose to browser) |
| `INTERNAL_API_KEY` | Same secret as Supabase `INTERNAL_API_KEY` — sent as `x-codex-internal-key` |
| `OPENAI_API_KEY` | Supabase secret — used by `codex-process-input` for file/link extraction |

Chat workflow also calls `codex-process-input` at **04b Codex Process Input** (after merge, before router) to extract text from attachments and summarize Meta Business report URLs.

## Supported chat file types (upload + extract)

| Type | Extensions | How it is read |
|------|------------|----------------|
| PDF | `.pdf` | Text layer via unpdf, then OpenAI if scanned |
| CSV | `.csv` | Direct UTF-8 (filename wins over Windows `application/vnd.ms-excel` MIME) |
| Excel | `.xlsx`, `.xls` | SheetJS — all sheets → tab-separated text in intake |
| Word | `.doc`, `.docx` | OpenAI file extraction |
| Text | `.txt`, `.md` | Direct read |
| Images | `.png`, `.jpg`, `.webp`, `.gif` | Vision / OCR |

Upload bucket: `codex-chat-files` (see migrations `202605290001`, `202605290002`, `202605290003`).

**Test extract:** attach file → ask *"Extract data from the presented attachment"* → check n8n **04b** output: `hasUsableContent: true` and `items[0].kind` is `csv` / `spreadsheet` / `pdf`.

**Export (download)** extracted answers as CSV/JSON: ask Codex to *"export this as CSV"* — uses **File Export Tool** in the main agent (separate from reading uploads).

**PDF extraction:** uses unpdf for text-based PDFs, then OpenAI Files API + `gpt-4o` (Responses + Chat Completions fallback). OCR branch for PDFs calls `codex-process-input` again instead of inline `file_data` (avoids *Bad request*).

Optional env: `OPENAI_EXTRACT_MODEL` (default `gpt-4o-mini`; PDFs also try `gpt-4o`).

Set the same `INTERNAL_API_KEY` in Supabase Edge Function secrets.

## Re-import workflow

Re-import or sync:

`n8n/itsnomatata-codex-internal-ai.production.workflow.json`

New agent tools:

- Codex Tool - Summarize My Tasks
- Codex Tool - List Boards
- Codex Tool - Create Board Card
- Codex Tool - Notify Content Review

## System prompt

Paste full `n8n/itsnomatata-ai-workspace-brain.system-prompt.md` into **06 Codex Main Agent** (includes workspace tool rules).

## Tools API

`POST {SUPABASE_URL}/functions/v1/codex-execute-tool`

Headers (n8n):

- `Authorization: Bearer {SERVICE_ROLE_KEY}`
- `apikey: {SERVICE_ROLE_KEY}`
- `x-codex-internal-key: {INTERNAL_API_KEY}`

Body:

```json
{
  "toolId": "create_board_card",
  "payload": {
    "title": "Edit Victoria Falls reel",
    "board_name": "Social Media",
    "assignee_email": "tino@example.com",
    "due_date": "2026-06-10",
    "priority": "high"
  },
  "context": {
    "userId": "...",
    "organizationId": "...",
    "role": "manager",
    "department": "Media",
    "fullName": "Thando Mpofu"
  }
}
```

### toolId values

| toolId | Action |
|--------|--------|
| `summarize_my_tasks` | Open/overdue tasks for current user |
| `list_boards` | `payload.search` optional |
| `create_board_card` | Creates card or `ai_task_suggestion` if not manager |
| `notify_content_review` | `payload.draft_id` required |

## Test in n8n

Manual payload on **02 Normalize Chat Payload** path:

```json
{
  "chatInput": "Create a card on the Social board titled Test from Codex for Tino due next Friday",
  "sessionId": "manual-test",
  "context": {
    "userId": "YOUR_USER_UUID",
    "organizationId": "YOUR_ORG_UUID",
    "fullName": "Tester",
    "role": "admin",
    "department": "Tech",
    "currentModule": "ai-workspace",
    "timezone": "Africa/Harare",
    "channel": "web"
  }
}
```

## App usage

No frontend env change required — the app already calls the same n8n chat webhook. Users ask in **AI Workspace**; the agent picks workspace tools when appropriate.

Optional later: call `codex-execute-tool` from the React app with the user's JWT for in-app actions without n8n.
