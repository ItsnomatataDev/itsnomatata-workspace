import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

type ProcessContext = {
  userId?: string;
  organizationId?: string;
  role?: string | null;
  department?: string | null;
  fullName?: string | null;
  currentModule?: string | null;
};

type AttachmentInput = {
  name?: string;
  type?: string;
  mimeType?: string | null;
  url?: string;
  download_url?: string;
  documentId?: string | null;
  base64?: string;
};

type ProcessInputBody = {
  message?: string;
  chatInput?: string;
  attachments?: AttachmentInput[];
  attachmentSources?: AttachmentInput[];
  links?: string[];
  context?: ProcessContext;
};

type ProcessedItem = {
  name: string;
  kind: string;
  mimeType: string | null;
  text: string;
  summary: string;
  ok: boolean;
  error?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-api-key, x-codex-internal-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_ITEMS = 6;
const MAX_INTAKE_CHARS = 14_000;
const MAX_ITEM_TEXT_CHARS = 8_000;

const META_URL_RE =
  /(business\.facebook\.com|facebook\.com\/ads|adsmanager\.facebook\.com|business\.meta\.com|meta\.com\/business)/i;

const URL_RE = /https?:\/\/[^\s)\]"'<>]+/gi;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function hasInternalSecret(req: Request) {
  const secret = Deno.env.get("INTERNAL_API_KEY") ??
    Deno.env.get("CODEX_TOOL_SECRET");
  if (!secret) return false;
  const inbound = req.headers.get("x-codex-internal-key") ??
    req.headers.get("x-internal-api-key");
  return inbound === secret;
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

function extractLinks(text: string) {
  return [...new Set((text.match(URL_RE) ?? []).map((url) => url.replace(/[.,;]+$/, "")))];
}

function isMetaBusinessUrl(url: string) {
  return META_URL_RE.test(url);
}

function isMetaInsightsResultsUrl(url: string) {
  return /business\.facebook\.com\/.*insights|adsmanager\.facebook\.com.*report/i.test(url);
}

function metaBusinessExportGuide(url: string, userMessage: string) {
  const isInsights = isMetaInsightsResultsUrl(url);
  return [
    "Meta Business report — login required (Codex cannot use your Facebook session).",
    `Requested URL: ${url}`,
    userMessage ? `User request: ${userMessage.slice(0, 500)}` : "",
    "",
    isInsights
      ? "This is a Meta Business Suite Insights / Results page. To analyze it here:"
      : "To analyze Meta Ads / Business data in Codex:",
    "",
    "1. Open the link in your browser while logged into Meta Business Suite.",
    "2. Select the ad account, date range, and breakdowns you need.",
    isInsights
      ? "3. On Results / Insights: use Export, ⋯ menu → Export table, or Export report."
      : "3. In Ads Manager or Reports: use Export → Export table data or Export report.",
    "4. Download CSV or Excel (.xlsx) — best for spend, impressions, clicks, CTR, CPC, conversions, ROAS.",
    "5. Upload that file in this chat (attach CSV, XLSX, or PDF).",
    "",
    "After upload, ask for example:",
    '- "Summarize spend, impressions, clicks, CTR, CPC, conversions, and ROAS for this period."',
    '- "Top campaigns and week-over-week changes."',
    "",
    "Do not invent metrics from the URL alone. A screenshot PNG can work for a quick read but exports are more accurate.",
  ].filter(Boolean).join("\n");
}

function isFileDownloadUrl(url: string) {
  return /\.(pdf|docx?|xlsx|csv|png|jpe?g|webp|gif|txt|md)(\?|#|$)/i.test(url) ||
    /\/storage\/v1\/object\//i.test(url);
}

function isIgnoredLinkUrl(url: string) {
  return /supabase\.com\/dashboard|app\.supabase\.com|\/docs\/|localhost|127\.0\.0\.1|react-devtools/i
    .test(url);
}

function filenameFromUrl(url: string) {
  try {
    const path = new URL(url).pathname;
    const segment = decodeURIComponent(path.split("/").pop() ?? "linked-file");
    return segment.includes(".") ? segment : `${segment}.pdf`;
  } catch {
    return "linked-file.pdf";
  }
}

function extractFilenameHint(message: string) {
  const match = message.match(
    /[\w.-]+\.(pdf|docx?|xlsx|csv|png|jpe?g|webp)/i,
  );
  return match?.[0]?.toLowerCase() ?? null;
}

function linkMatchesAttachment(url: string, items: AttachmentInput[]) {
  const base = url.split("?")[0];
  return items.some((item) => {
    const attachmentUrl = String(item.url || item.download_url || "");
    if (!attachmentUrl) return false;
    return attachmentUrl.split("?")[0] === base;
  });
}

function filterLinksForIntake(
  links: string[],
  attachments: AttachmentInput[],
  message: string,
) {
  const hasUsableAttachment = attachments.some((item) =>
    isUsableAttachmentUrl(String(item.url || item.download_url || ""))
  );
  const fileHint = extractFilenameHint(message);

  return links.filter((link) => {
    if (isIgnoredLinkUrl(link)) return false;
    if (linkMatchesAttachment(link, attachments)) return false;

    if (hasUsableAttachment) {
      if (isMetaBusinessUrl(link)) return true;
      if (isFileDownloadUrl(link)) {
        if (!fileHint) return true;
        return link.toLowerCase().includes(fileHint);
      }
      return false;
    }

    if (fileHint && isFileDownloadUrl(link)) {
      return link.toLowerCase().includes(fileHint);
    }

    return !isIgnoredLinkUrl(link);
  });
}

function isZipArchive(bytes: Uint8Array) {
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function detectFileKind(name: string, mimeType: string, bytes?: Uint8Array) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) return "csv";
  if (mimeType.includes("csv") || mimeType.includes("tab-separated")) return "csv";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "spreadsheet";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text";
  if (lower.endsWith(".pdf") || mimeType.includes("pdf")) return "pdf";
  if (/^image\//.test(mimeType)) return "image";
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) return "document";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    if (bytes && !isZipArchive(bytes)) return "csv";
    return "spreadsheet";
  }
  if (mimeType.includes("text")) return "text";
  return "document";
}

function guessMime(name: string, mime?: string | null) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (mime && mime !== "application/octet-stream") return mime;
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text/plain";
  return mime ?? "application/octet-stream";
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function parseDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return null;
  const mimeType = match[1];
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { mimeType, bytes, base64 };
}

function parseStoragePath(url: string, supabaseUrl: string) {
  const base = supabaseUrl.replace(/\/$/, "");
  const patterns = [
    new RegExp(`${base}/storage/v1/object/(?:public|sign)/([^/]+)/(.+)$`),
    /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        bucket: decodeURIComponent(match[1]),
        path: decodeURIComponent(match[2].split("?")[0]),
      };
    }
  }
  return null;
}

async function resolveDownloadUrl(
  url: string,
  adminClient: ReturnType<typeof createClient>,
) {
  if (!url || url.startsWith("blob:")) return { url: "", error: "blob URLs cannot be fetched server-side" };
  if (url.startsWith("data:")) {
    const parsed = parseDataUrl(url);
    if (!parsed) return { url: "", error: "Invalid data URL" };
    return { url, bytes: parsed.bytes, mimeType: parsed.mimeType, base64: parsed.base64 };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const storage = supabaseUrl ? parseStoragePath(url, supabaseUrl) : null;
  let fetchUrl = url;
  if (storage) {
    const { data, error } = await adminClient.storage
      .from(storage.bucket)
      .createSignedUrl(storage.path, 3600);
    if (!error && data?.signedUrl) fetchUrl = data.signedUrl;
  }

  const response = await fetch(fetchUrl, {
    headers: {
      "User-Agent": "ITsNomatata-Codex/1.0",
      Accept: "*/*",
    },
  });
  if (!response.ok) {
    return { url: fetchUrl, error: `Download failed (${response.status})` };
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) {
    return { url: fetchUrl, error: "File exceeds 12MB processing limit" };
  }
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() ??
    null;
  return {
    url: fetchUrl,
    bytes,
    mimeType,
    base64: bytesToBase64(bytes),
  };
}

function extractCsvText(bytes: Uint8Array) {
  let text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  text = text.replace(/^\uFEFF/, "");
  return text.slice(0, 120_000);
}

function extractXlsxText(bytes: Uint8Array) {
  if (!isZipArchive(bytes)) {
    return extractCsvText(bytes);
  }
  const workbook = XLSX.read(bytes, { type: "array" });
  if (!workbook.SheetNames.length) {
    throw new Error("Spreadsheet has no readable sheets");
  }
  const chunks: string[] = [];
  for (const sheetName of workbook.SheetNames.slice(0, 8)) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: "\t" });
    chunks.push(`## Sheet: ${sheetName}\n${csv}`);
    if (chunks.join("\n").length > 100_000) break;
  }
  const combined = chunks.join("\n\n").trim();
  if (!combined) throw new Error("Spreadsheet sheets are empty");
  return combined.slice(0, 120_000);
}

function extractPlainText(bytes: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes).slice(0, 120_000);
}

async function extractDocxText(bytes: Uint8Array) {
  const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("DOCX has no readable document body");
  return xml
    .replace(/<w:tab[^/]*\/>/gi, "\t")
    .replace(/<w:br[^/]*\/>/gi, "\n")
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, 120_000);
}

function countWords(text: string) {
  return (text.match(/[A-Za-z0-9]{2,}/g) ?? []).length;
}

function isStructuredDataKind(kind: string) {
  return kind === "csv" || kind === "spreadsheet" || kind === "text";
}

function hasMeaningfulExtractedText(text: string, kind: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (isStructuredDataKind(kind)) {
    return trimmed.length >= 24 || trimmed.split(/\r?\n/).length >= 2;
  }
  return countWords(trimmed) >= 8;
}

function isUsableAttachmentUrl(url: string) {
  if (!url || url.startsWith("blob:") || url.startsWith("[inline")) return false;
  return url.startsWith("http") || url.startsWith("data:");
}

async function extractPdfText(bytes: Uint8Array) {
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n\n") : String(text ?? "");
  } catch {
    return "";
  }
}

async function resolveDocumentSourceUrl(
  adminClient: ReturnType<typeof createClient>,
  documentId: string | null | undefined,
) {
  if (!documentId) return null;
  const { data } = await adminClient
    .from("ai_documents")
    .select("source_url, file_name, mime_type")
    .eq("id", documentId)
    .maybeSingle();
  return data?.source_url ? {
    url: String(data.source_url),
    name: typeof data.file_name === "string" ? data.file_name : "document",
    mimeType: typeof data.mime_type === "string" ? data.mime_type : null,
  } : null;
}

function summarizeSnippet(text: string, max = 500) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function wantsStructuredExtraction(message: string) {
  return /\bextract\b|\bpull\s+(the\s+)?data\b|presented\s+attach|this\s+attach|attached\s+file|from\s+(the\s+)?attach/i
    .test(message);
}

function extractionInstruction(userMessage: string, fileName: string) {
  if (!wantsStructuredExtraction(userMessage)) {
    return "Extract all readable text from this file. Preserve tables, headings, dates, currency amounts, and totals. Return extracted text first, then a short summary.";
  }
  return [
    `Extract structured data from "${fileName}" for the user request: ${userMessage.slice(0, 400)}`,
    "Return: (1) key fields as bullet list — vendor, invoice #, dates, currency, subtotal, tax, total, payment terms;",
    "(2) line items table if present; (3) any notes or anomalies.",
    "Use exact values from the document; do not invent fields.",
  ].join(" ");
}

const OPENAI_EXTRACT_MODEL = () =>
  Deno.env.get("OPENAI_EXTRACT_MODEL") ?? "gpt-4o-mini";

const INLINE_FILE_MAX_BYTES = 2 * 1024 * 1024;

function parseResponsesText(payload: Record<string, unknown>) {
  const direct = String(payload.output_text ?? "").trim();
  if (direct) return direct;
  const output = payload.output;
  if (!Array.isArray(output)) return "";
  return output.flatMap((entry: { content?: Array<{ text?: string }> }) =>
    (entry.content ?? []).map((part) => part.text ?? "").filter(Boolean)
  ).join("\n").trim();
}

async function uploadOpenAiFile(
  apiKey: string,
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
) {
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append(
    "file",
    new Blob([bytes], { type: mimeType }),
    filename,
  );

  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = typeof payload?.error?.message === "string"
      ? payload.error.message
      : `OpenAI file upload failed (${response.status})`;
    throw new Error(message);
  }

  const fileId = typeof payload.id === "string" ? payload.id : "";
  if (!fileId) throw new Error("OpenAI file upload returned no file id");
  return fileId;
}

async function callOpenAiResponses(
  apiKey: string,
  content: Array<Record<string, unknown>>,
  model = OPENAI_EXTRACT_MODEL(),
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content }],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = typeof payload?.error?.message === "string"
      ? payload.error.message
      : `OpenAI extraction failed (${response.status})`;
    throw new Error(message);
  }

  const text = parseResponsesText(payload);
  if (!text) throw new Error("OpenAI returned no extractable text");
  return text;
}

async function openAiExtractPdfViaChat(
  apiKey: string,
  fileId: string,
  instruction: string,
) {
  const models = ["gpt-4o", OPENAI_EXTRACT_MODEL()];
  let lastError = "Chat Completions PDF extraction failed";

  for (const model of models) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: instruction },
            { type: "file", file: { file_id: fileId } },
          ],
        }],
        max_tokens: 4096,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      lastError = typeof payload?.error?.message === "string"
        ? payload.error.message
        : `Chat Completions failed (${response.status})`;
      continue;
    }

    const text = String(
      payload.choices?.[0]?.message?.content ?? "",
    ).trim();
    if (text) return text;
    lastError = "Chat Completions returned empty content";
  }

  throw new Error(lastError);
}

async function openAiExtractPdf(
  apiKey: string,
  name: string,
  bytes: Uint8Array,
  instruction: string,
) {
  const safeName = name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
  const localText = await extractPdfText(bytes);
  const localWords = countWords(localText);
  if (localWords >= 8) return localText;

  const fileId = await uploadOpenAiFile(
    apiKey,
    bytes,
    safeName,
    "application/pdf",
  );

  const responseContent = (model: string) => ([
    { type: "input_text", text: instruction },
    {
      type: "input_file",
      file_id: fileId,
      filename: safeName,
    },
  ]);

  const models = ["gpt-4o", OPENAI_EXTRACT_MODEL()];
  let lastError = "PDF vision extraction failed";

  for (const model of models) {
    try {
      return await callOpenAiResponses(
        apiKey,
        responseContent(model),
        model,
      );
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  try {
    return await openAiExtractPdfViaChat(apiKey, fileId, instruction);
  } catch (chatError) {
    if (localWords >= 3) return localText;
    throw new Error(
      chatError instanceof Error ? chatError.message : lastError,
    );
  }
}

async function openAiExtractFromFile(
  apiKey: string,
  name: string,
  mimeType: string,
  base64: string,
  instruction: string,
  bytes?: Uint8Array,
) {
  const isPdf = /pdf/i.test(mimeType) || name.toLowerCase().endsWith(".pdf");
  const isImage = /^image\//i.test(mimeType);
  const safeName = name.endsWith(".pdf") || !isPdf
    ? name
    : `${name}.pdf`;
  const fileBytes = bytes ?? Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  if (isPdf) {
    return openAiExtractPdf(apiKey, safeName, fileBytes, instruction);
  }

  const content: Array<Record<string, unknown>> = [{
    type: "input_text",
    text: instruction,
  }];

  if (isImage) {
    content.push({
      type: "input_image",
      image_url: `data:${mimeType};base64,${base64}`,
    });
    return callOpenAiResponses(apiKey, content);
  }

  if (fileBytes.byteLength > INLINE_FILE_MAX_BYTES) {
    const fileId = await uploadOpenAiFile(
      apiKey,
      fileBytes,
      safeName,
      mimeType,
    );
    return callOpenAiResponses(apiKey, [
      { type: "input_text", text: instruction },
      { type: "input_file", file_id: fileId, filename: safeName },
    ]);
  }

  content.push({
    type: "input_file",
    filename: safeName,
    file_data: `data:${mimeType};base64,${base64}`,
  });

  try {
    return await callOpenAiResponses(apiKey, content);
  } catch {
    const fileId = await uploadOpenAiFile(
      apiKey,
      fileBytes,
      safeName,
      mimeType,
    );
    return callOpenAiResponses(apiKey, [
      { type: "input_text", text: instruction },
      { type: "input_file", file_id: fileId, filename: safeName },
    ]);
  }
}

async function openAiSummarizeMetaReport(
  apiKey: string,
  url: string,
  pageText: string,
  userMessage: string,
) {
  const instruction = [
    "You are summarizing a Meta Business / Facebook Ads report for an agency workspace.",
    "The user message:",
    userMessage.slice(0, 2000),
    "",
    "Report URL:",
    url,
    "",
    "If the content looks like a login wall, export preview, or empty dashboard shell, say that clearly and list what the user should upload instead (CSV/XLSX export, PDF, or screenshot).",
    "Otherwise produce:",
    "1) Executive summary (3-6 bullets)",
    "2) Key metrics table (spend, impressions, clicks, CTR, CPC, conversions, ROAS if present)",
    "3) Top campaigns/ad sets/ads",
    "4) Anomalies or week-over-week changes",
    "5) Recommended actions for the account manager",
    "",
    "Fetched page text (may be partial):",
    pageText.slice(0, 24_000),
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: [{ role: "user", content: [{ type: "input_text", text: instruction }] }],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : "Meta report summarization failed",
    );
  }

  return String(payload.output_text ?? "").trim() ||
    (Array.isArray(payload.output)
      ? payload.output.flatMap((entry: { content?: Array<{ text?: string }> }) =>
        (entry.content ?? []).map((part) => part.text ?? "").filter(Boolean)
      ).join("\n")
      : "");
}

async function fetchUrlText(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ITsNomatata-Codex/1.0",
      Accept: "text/html,application/xhtml+xml,text/plain,*/*",
    },
    redirect: "follow",
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  if (!response.ok) {
    return { ok: false, text: "", error: `HTTP ${response.status}`, contentType };
  }
  if (/pdf|spreadsheet|excel|word|octet-stream/i.test(contentType)) {
    return { ok: true, text: "", binaryUrl: url, contentType };
  }
  const stripped = body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { ok: true, text: stripped.slice(0, 32_000), contentType };
}

async function processAttachment(
  item: AttachmentInput,
  adminClient: ReturnType<typeof createClient>,
  openAiKey: string,
  userMessage: string,
): Promise<ProcessedItem> {
  const name = String(item.name ?? "attachment").slice(0, 180);
  const mimeType = guessMime(name, item.mimeType ?? null);
  const inlineText = typeof (item as { textContent?: string }).textContent === "string"
    ? (item as { textContent?: string }).textContent!.trim()
    : "";
  if (inlineText && (countWords(inlineText) >= 5 || inlineText.trim().length >= 24)) {
    const inlineKind = /\.csv|\.tsv/i.test(name) || mimeType.includes("csv")
      ? "csv"
      : mimeType.includes("pdf")
      ? "pdf"
      : "text";
    return {
      name,
      kind: inlineKind,
      mimeType,
      text: inlineText.slice(0, MAX_ITEM_TEXT_CHARS),
      summary: summarizeSnippet(inlineText, 700),
      ok: true,
    };
  }

  let rawUrl = String(item.download_url || item.url || "");
  if (!isUsableAttachmentUrl(rawUrl)) {
    const doc = await resolveDocumentSourceUrl(adminClient, item.documentId);
    if (doc?.url) {
      rawUrl = doc.url;
    }
  }
  if (!isUsableAttachmentUrl(rawUrl)) {
    return {
      name,
      kind: "attachment",
      mimeType,
      text: "",
      summary: "",
      ok: false,
      error: rawUrl.startsWith("blob:")
        ? "File was not uploaded to storage. Re-attach the file or wait for upload to finish."
        : "No downloadable file URL. Re-upload the file (Codex chat upload) or paste a direct https link.",
    };
  }

  let bytes: Uint8Array | null = null;
  let base64 = item.base64 ?? "";

  if (base64) {
    bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  } else if (rawUrl) {
    const downloaded = await resolveDownloadUrl(rawUrl, adminClient);
    if (downloaded.error && !downloaded.bytes) {
      return {
        name,
        kind: "attachment",
        mimeType,
        text: "",
        summary: "",
        ok: false,
        error: downloaded.error,
      };
    }
    bytes = downloaded.bytes ?? null;
    base64 = downloaded.base64 ?? base64;
    if (!bytes && rawUrl.startsWith("data:")) {
      const parsed = parseDataUrl(rawUrl);
      bytes = parsed?.bytes ?? null;
      base64 = parsed?.base64 ?? base64;
    }
  }

  if (!bytes?.length) {
    return {
      name,
      kind: "attachment",
      mimeType,
      text: "",
      summary: "",
      ok: false,
      error: "No readable file bytes",
    };
  }

  const kind = detectFileKind(name, mimeType, bytes);

  try {
    let text = "";
    if (kind === "csv") {
      text = extractCsvText(bytes);
    } else if (kind === "spreadsheet") {
      try {
        text = extractXlsxText(bytes);
      } catch {
        text = extractCsvText(bytes);
      }
    } else if (kind === "text") {
      text = extractPlainText(bytes);
    } else if (kind === "document" && name.toLowerCase().endsWith(".docx")) {
      text = await extractDocxText(bytes);
    } else if (kind === "pdf") {
      const instruction =
        `This PDF may be scanned or image-based. ${extractionInstruction(userMessage, name)}`;
      text = await openAiExtractPdf(
        openAiKey,
        name,
        bytes,
        instruction,
      );
    } else {
      const instruction = kind === "image"
        ? "Extract all visible text and describe key visual elements. If this is a business report screenshot, preserve metrics, dates, campaign names, and totals."
        : extractionInstruction(userMessage, name);
      text = await openAiExtractFromFile(
        openAiKey,
        name,
        mimeType,
        base64 || bytesToBase64(bytes),
        instruction,
      );
    }

    if (
      !isStructuredDataKind(kind) &&
      !hasMeaningfulExtractedText(text, kind) &&
      kind !== "pdf"
    ) {
      text = await openAiExtractFromFile(
        openAiKey,
        name,
        mimeType,
        base64 || bytesToBase64(bytes),
        extractionInstruction(userMessage, name),
        bytes,
      );
    }

    const finalText = text.slice(0, MAX_ITEM_TEXT_CHARS);
    if (!hasMeaningfulExtractedText(finalText, kind)) {
      throw new Error("No readable content extracted from file");
    }

    return {
      name,
      kind,
      mimeType,
      text: finalText,
      summary: summarizeSnippet(finalText, 700),
      ok: true,
    };
  } catch (error) {
    return {
      name,
      kind,
      mimeType,
      text: "",
      summary: "",
      ok: false,
      error: error instanceof Error ? error.message : "Processing failed",
    };
  }
}

async function processLink(
  url: string,
  adminClient: ReturnType<typeof createClient>,
  openAiKey: string,
  userMessage: string,
): Promise<ProcessedItem> {
  const name = filenameFromUrl(url).slice(0, 180);

  if (isFileDownloadUrl(url)) {
    return processAttachment(
      {
        name,
        mimeType: guessMime(name, null),
        url,
        download_url: url,
      },
      adminClient,
      openAiKey,
      userMessage,
    );
  }

  if (isMetaBusinessUrl(url)) {
    const fetched = await fetchUrlText(url);
    const pageLooksEmpty = !fetched.text || fetched.text.length < 250;
    const loginWallInPage = /log in|sign in|access denied|login_form|facebook\.com\/login/i
      .test(fetched.text || "");

    if (pageLooksEmpty || loginWallInPage || isMetaInsightsResultsUrl(url)) {
      const guide = metaBusinessExportGuide(url, userMessage);
      return {
        name: "Meta Business Insights",
        kind: "meta_business_report",
        mimeType: "text/plain",
        text: guide,
        summary:
          "Export CSV/XLSX from Meta Business Suite, then upload here for analysis.",
        ok: true,
      };
    }

    const summary = await openAiSummarizeMetaReport(
      openAiKey,
      url,
      fetched.text || "",
      userMessage,
    );
    const loginWallInSummary = /login|sign in|access denied|preview unavailable|cannot access/i
      .test(summary);
    if (loginWallInSummary || summary.length < 80) {
      const guide = metaBusinessExportGuide(url, userMessage);
      return {
        name: "Meta Business Insights",
        kind: "meta_business_report",
        mimeType: "text/plain",
        text: guide,
        summary:
          "Export CSV/XLSX from Meta Business Suite, then upload here for analysis.",
        ok: true,
      };
    }

    return {
      name,
      kind: "meta_business_report",
      mimeType: "text/html",
      text: summary,
      summary: summarizeSnippet(summary, 700),
      ok: true,
    };
  }

  const fetched = await fetchUrlText(url);
  if (fetched.binaryUrl) {
    return processAttachment(
      {
        name,
        mimeType: guessMime(name, fetched.contentType),
        url,
        download_url: url,
      },
      adminClient,
      openAiKey,
      userMessage,
    );
  }

  if (!fetched.ok || !fetched.text) {
    return {
      name,
      kind: "link",
      mimeType: null,
      text: "",
      summary: "",
      ok: false,
      error: fetched.error ?? "Could not fetch URL content",
    };
  }

  const instruction =
    `Summarize this web page for the user request: ${userMessage.slice(0, 800)}\n\nURL: ${url}\n\nContent:\n${fetched.text}`;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: [{ role: "user", content: [{ type: "input_text", text: instruction }] }],
    }),
  });
  const payload = await response.json();
  const text = String(payload.output_text ?? fetched.text).slice(0, 50_000);

  return {
    name,
    kind: "link",
    mimeType: "text/html",
    text,
    summary: summarizeSnippet(text, 700),
    ok: text.length > 40,
  };
}

function buildIntakeBlock(
  items: ProcessedItem[],
  links: string[],
  primaryFileName?: string | null,
) {
  if (!items.length && !links.length) return "";

  const sections: string[] = [
    "[Codex Intake — extracted content for this turn]",
    "Use the material below as ground truth. Do not ask the user to re-upload if extraction succeeded.",
    primaryFileName
      ? `Primary file for this request: ${primaryFileName}. Ignore unrelated sections that do not match this file.`
      : "",
  ].filter(Boolean);

  for (const item of items) {
    if (item.ok && item.text) {
      sections.push(
        `\n--- ${item.name} (${item.kind}) ---\n${item.summary ? `Summary: ${item.summary}\n\n` : ""}${item.text.slice(0, MAX_ITEM_TEXT_CHARS)}`,
      );
    } else if (item.error) {
      sections.push(`\n--- ${item.name} ---\nExtraction note: ${item.error}`);
    }
  }

  if (links.length) {
    sections.push(`\nReferenced URLs: ${links.join(", ")}`);
  }

  return sections.join("\n").slice(0, MAX_INTAKE_CHARS);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!serviceRole || !openAiKey) {
    return jsonResponse({ ok: false, error: "Server not configured" }, 500);
  }

  const bearer = getBearerToken(req);
  if (bearer !== serviceRole && !hasInternalSecret(req)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  let body: ProcessInputBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const message = String(body.chatInput ?? body.message ?? "").slice(0, 12_000);
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceRole,
  );

  const rawItems = [
    ...(body.attachmentSources ?? []),
    ...(body.attachments ?? []),
  ].filter((item) => item && typeof item === "object");

  const uniqueItems: AttachmentInput[] = [];
  const seen = new Set<string>();
  for (const item of rawItems) {
    const key = String(item.url || item.download_url || item.name || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueItems.push(item);
    if (uniqueItems.length >= MAX_ITEMS) break;
  }

  const rawLinks = [
    ...new Set([
      ...(body.links ?? []),
      ...extractLinks(message),
    ]),
  ];
  const links = filterLinksForIntake(rawLinks, uniqueItems, message).slice(0, 5);
  const primaryFileName = uniqueItems.find((item) =>
    /\.(pdf|docx?|xlsx|csv)/i.test(String(item.name ?? ""))
  )?.name ?? extractFilenameHint(message);

  const items: ProcessedItem[] = [];
  for (const item of uniqueItems) {
    const url = String(item.url || item.download_url || "");
    if (!isUsableAttachmentUrl(url) && !item.documentId &&
      !(item as { textContent?: string }).textContent) {
      continue;
    }
    items.push(await processAttachment(item, adminClient, openAiKey, message));
  }

  for (const link of links) {
    if (items.some((item) => linkMatchesAttachment(link, uniqueItems))) continue;
    items.push(await processLink(link, adminClient, openAiKey, message));
  }

  const intakeBlock = buildIntakeBlock(items, links, primaryFileName);
  const hasUsableContent = items.some((item) =>
    item.ok && hasMeaningfulExtractedText(item.text, item.kind)
  );

  return jsonResponse({
    ok: true,
    hasUsableContent,
    intakeBlock,
    items,
    links,
    metaReportDetected: links.some(isMetaBusinessUrl),
  });
});
