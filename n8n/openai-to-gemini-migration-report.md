# OpenAI to Gemini Migration Report

Scope: `n8n/itsnomatata-codex-internal-ai.production.workflow.json`

Rules followed:
- Keep routing, Supabase integrations, business logic, and tool contracts intact.
- Replace OpenAI-specific AI integrations only.
- Preserve downstream output JSON contracts.

## Pre-change Findings

| Node | Current model | Current endpoint | Current credential | Recommended Gemini replacement |
| --- | --- | --- | --- | --- |
| OpenAI Main Reasoning Model | `gpt-4o` | n8n OpenAI chat model node | OpenAI chat model credential | Google Gemini Chat Model, `gemini-2.5-flash` |
| Generate Image - OpenAI Direct | `gpt-image-1` | `https://api.openai.com/v1/images/generations` | `openAiApi` | Gemini `generateContent` image-capable request using `$env.GEMINI_API_KEY`; preserve image attachment output |
| Has OpenAI Image Key? | n/a | n/a | n/a | Rename/check Gemini key only |
| Image Generation Config Missing Response | n/a | n/a | n/a | Update copy from OpenAI to Gemini |
| Format OpenAI Image Response | OpenAI image response parser | n/a | n/a | Parse Gemini candidate inline image parts into `attachments[].url` and `attachments[].download_url` |
| Image Analysis Tool | `gpt-4o-mini` | `https://api.openai.com/v1/responses` | `openAiApi` | Gemini `generateContent` vision request with same tool contract |
| Image Generation Tool | `gpt-image-1` | `https://api.openai.com/v1/images/generations` | OpenAI API key/header | Gemini `generateContent` image-capable request using `$env.GEMINI_API_KEY` |
| Summarize Chunk - OpenAI | OpenAI node default | n8n OpenAI operation node | OpenAI credential | Gemini generateContent or Gemini node with same summary output |
| OpenAI Image Edit | `gpt-image-1` | `https://api.openai.com/v1/images/edits` | `openAiApi` | Gemini generateContent image-edit style request; preserve edited image attachment contract |
| Format Edited Image Response | OpenAI image parser | n/a | n/a | Parse Gemini inline image parts; keep `edited_image` contract |
| Prepare OpenAI Vision OCR Request | `gpt-4o-mini` body builder | n/a | n/a | Build Gemini `contents[].parts[]` request |
| OCR Should Call OpenAI? | n/a | n/a | n/a | Rename/check Gemini OCR body only |
| OpenAI Vision OCR Fallback | OpenAI Responses request body | `https://api.openai.com/v1/responses` | `openAiApi` | Gemini `generateContent` OCR request |
| Format OCR Response | OpenAI response parser | n/a | n/a | Parse Gemini `candidates[].content.parts[].text`; keep OCR output contract |
| Prepare Document OCR Request | `gpt-4o-mini` body builder | n/a | n/a | Build Gemini `contents[].parts[]` request |
| OpenAI Document OCR Fallback | OpenAI Responses request body | `https://api.openai.com/v1/responses` | `openAiApi` | Gemini `generateContent` document/image OCR request |
| Format Document OCR Text | OpenAI response parser | n/a | n/a | Parse Gemini text with OpenAI fallback parser retained harmlessly |
| Content Studio Vision (OpenAI Direct) | `gpt-4o-mini` | `https://api.openai.com/v1/chat/completions` | `openAiApi` | Gemini `generateContent` vision request |
| Format Content Studio Vision JSON | OpenAI chat/Responses parser | n/a | n/a | Parse Gemini candidates text; preserve Content Studio JSON output |

## Notes

- Official n8n Gemini chat-model node type verified as `@n8n/n8n-nodes-langchain.lmChatGoogleGemini`.
- Gemini API key should be exposed to n8n as `$env.GEMINI_API_KEY`.
- Image generation/editing with Gemini may require an image-capable Gemini model/feature to return inline image data. The formatter must not claim success unless inline image data exists.
