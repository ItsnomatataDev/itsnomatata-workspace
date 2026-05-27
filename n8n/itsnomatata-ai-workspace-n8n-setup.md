# ITsNomatata AI Workspace n8n Setup

This workflow has two responsibilities:

1. Ingest approved company files from Google Drive into InfraNodus GraphRAG.
2. Answer AI Workspace chat messages from the web app using the project-aware company brain.

## Web App Connection

The app sends requests to:

```env
VITE_N8N_AI_WEBHOOK_URL=https://n8n.srv883957.hstgr.cloud/webhook/a2cfd3b0-aaa4-4003-940d-e520e64830c6/chat
```

The frontend payload includes:

```json
{
  "action": "sendMessage",
  "chatInput": "User message plus context",
  "sessionId": "project:<projectId> or conversationId",
  "context": {
    "userId": "...",
    "organizationId": "...",
    "fullName": "...",
    "role": "...",
    "department": "...",
    "currentModule": "ai-workspace",
    "currentRoute": "/ai-workspace",
    "timezone": "Africa/Harare",
    "channel": "web"
  },
  "attachments": [],
  "conversationId": "...",
  "metadata": {
    "source": "ai_workspace",
    "projectId": "...",
    "projectName": "...",
    "projectMemoryScope": "project"
  }
}
```

## Chat Agent Node Fixes

In the `AI Agent` node, replace the current `systemMessage` with the full prompt from:

```text
n8n/itsnomatata-ai-workspace-brain.system-prompt.md
```

The existing short prompt is too generic. The full prompt teaches the assistant the actual system architecture, modules, role boundaries, project memory behavior, and approval rules.

## Memory Behavior

Project memory depends on the web app's `sessionId`.

The app now sends:

```text
project:<projectId>
```

when a chat is inside a project/folder. This means new chats inside the same project share n8n memory.

Keep the `Simple Memory` node connected to the agent. If you expose a session key setting in n8n, use:

```js
{{ $json.sessionId || $json.metadata?.projectId || $json.conversationId || $json.context?.userId }}
```

## Knowledge Tool Fix

Rename the `Knowledge Base GraphRAG` tool description to:

```text
Search approved ITsNomatata company knowledge, Google Drive ingested files, project summaries, policies, client notes, and internal operating context. Use only when company-specific or verified knowledge is required.
```

The current description says only "Marketing guidance", which makes the agent behave too narrowly.

## Google Drive Ingestion Fixes

The Drive ingestion branch currently has no trigger. Add one of these before `Search Google Drive`:

- Manual Trigger for admin-run ingestion.
- Schedule Trigger for nightly sync.
- Webhook Trigger for controlled re-indexing.

Recommended first version:

```text
Manual Trigger -> Search Google Drive
```

## MIME Type Fixes

The `Switch` node should use these MIME values:

```text
PDF: application/pdf
Text: text/plain
Markdown: text/markdown
JSON: application/json
CSV: text/csv
Google Docs: application/vnd.google-apps.document
Google Sheets: application/vnd.google-apps.spreadsheet
DOCX: application/vnd.openxmlformats-officedocument.wordprocessingml.document
XLSX: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

Your current CSV check is `csv`, which will not match normal files. The Google Docs rule is currently blank, which will also fail.

## PDF/Text/Markdown Extraction

After extraction, normalize every branch to this shape before summarizing:

```json
{
  "fileName": "...",
  "mimeType": "...",
  "sourceFileId": "...",
  "rawText": "...",
  "clientName": "...",
  "projectName": "..."
}
```

Do not rely on `$node["Switch"].json["name"]` for the client name. The Switch node may not hold the original file metadata after extraction. Preserve the file metadata before download or merge it back after extraction.

## Summarization Prompt Fix

The current `OpenAI` node prompt explains behavior but does not clearly ask it to summarize the chunk.

Use this prompt:

```text
Summarize this company knowledge chunk for retrieval.

Return:
- concise summary
- client/project if visible
- key entities
- dates/deadlines
- decisions
- actions
- risks/blockers
- useful search tags

Chunk:
{{ $json.chunk }}
```

## InfraNodus Save Shape

Save each summary with categories that help retrieval:

```text
Client: {{ $json.clientName || "General" }}
Project: {{ $json.projectName || "General" }}
Source: {{ $json.fileName }}
```

For text:

```text
{{ $json.combinedSummary }}
```

## Chat Response Contract

The web app accepts either:

```json
{ "output": "answer text" }
```

or:

```json
{
  "success": true,
  "type": "text",
  "message": "answer text",
  "conversationId": "...",
  "data": {},
  "sources": []
}
```

The n8n `AI Agent` node usually returns `output`, so the app already supports that.

## Production Checklist

- Activate the chat workflow.
- Confirm webhook URL matches `.env`.
- Replace the AI Agent system prompt with the full company brain prompt.
- Update the GraphRAG tool description.
- Add a Manual or Schedule Trigger to Drive ingestion.
- Fix MIME values in the Switch node.
- Preserve file metadata before extraction.
- Use project-aware `sessionId` from the app for memory.
- Apply Supabase migration `202605270001_fix_ai_rls_user_id_ambiguity.sql`.
