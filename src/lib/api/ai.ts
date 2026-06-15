import type {
  AssistantActionInput,
  AssistantAttachmentInput,
  AssistantContextInput,
  AssistantResponse,
} from "./n8n";

export type AIActionKey = "role_summary";

export type AIUserRole =
  | "admin"
  | "manager"
  | "it"
  | "social_media"
  | "media_team"
  | "seo_specialist"
  | "employee";

export type AIRequestPayload = {
  organizationId: string;
  userId: string;
  role: string;
  action: AIActionKey;
  prompt?: string;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type AISummaryResponse = {
  success: boolean;
  title: string;
  summary: string;
  highlights: string[];
  recommendedActions: string[];
};

export type DashboardSummaryResult = {
  summary: string;
  suggestions: string[];
};

export type AskAssistantPayload = {
  message: string;
  context: AssistantContextInput;
  attachments?: AssistantAttachmentInput[];
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
};

export type RunAIActionPayload = {
  context: AssistantContextInput;
  action: AssistantActionInput;
  attachments?: AssistantAttachmentInput[];
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
};

export type AnalyzeDocumentPayload = {
  context: AssistantContextInput;
  prompt: string;
  attachments: AssistantAttachmentInput[];
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
};

export type AnalyzeImagePayload = {
  context: AssistantContextInput;
  attachment: AssistantAttachmentInput;
  prompt?: string;
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
};

export type TranscribeAudioPayload = {
  context: AssistantContextInput;
  attachment: AssistantAttachmentInput;
  prompt?: string;
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
};

export type GenerateImagePayload = {
  context: AssistantContextInput;
  prompt: string;
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
};

export type UploadAIDocumentPayload = {
  file: File;
  context: AssistantContextInput;
  metadata?: Record<string, unknown>;
};

export type UploadAIDocumentResult = {
  success: boolean;
  message?: string;
  documentId?: string | null;
  sourceUrl?: string | null;
  data?: unknown;
};

export interface GenerateDashboardSummaryInput {
  organizationId: string;
  userId: string;
  role?: AIUserRole | string;
  userName?: string | null;
  currentModule?: string | null;
}

const AI_WEBHOOK_URL = import.meta.env.VITE_N8N_AI_WEBHOOK_URL as
  | string
  | undefined;
const AI_DOCUMENT_UPLOAD_WEBHOOK_URL = import.meta.env
  .VITE_N8N_AI_DOCUMENT_UPLOAD_WEBHOOK_URL as string | undefined;

function getAIWebhookUrl() {
  if (!AI_WEBHOOK_URL) {
    throw new Error(
      "Missing VITE_N8N_AI_WEBHOOK_URL in your environment variables.",
    );
  }

  return AI_WEBHOOK_URL;
}

function getAIRequestUrl() {
  const webhookUrl = getAIWebhookUrl();

  if (import.meta.env.DEV) {
    return "/api/ai";
  }

  return webhookUrl;
}

function getAIDocumentUploadRequestUrl() {
  if (!AI_DOCUMENT_UPLOAD_WEBHOOK_URL) {
    throw new Error(
      "Missing VITE_N8N_AI_DOCUMENT_UPLOAD_WEBHOOK_URL in your environment variables.",
    );
  }

  if (import.meta.env.DEV) {
    return "/api/ai/upload-document";
  }

  return AI_DOCUMENT_UPLOAD_WEBHOOK_URL;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.every((item) => typeof item === "string");
}

function isAISummaryResponse(value: unknown): value is AISummaryResponse {
  if (!isRecord(value)) return false;

  return (
    typeof value.success === "boolean" &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    isStringArray(value.highlights) &&
    isStringArray(value.recommendedActions)
  );
}

function extractTextFromHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractReadableAiText(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^[{\[]/.test(trimmed)) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        const parsedText = extractReadableAiText(parsed);
        if (parsedText && parsedText !== trimmed) return parsedText;
      } catch {
        // Keep the original text if it only resembles JSON.
      }
    }
    return trimmed;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(extractReadableAiText).filter(Boolean).join("\n");
  }

  if (!isRecord(value)) return "";

  for (const key of [
    "reply",
    "message",
    "output",
    "text",
    "content",
    "summary",
    "answer",
    "result",
  ]) {
    const text = extractReadableAiText(value[key]);
    if (text) return text;
  }

  return "";
}

type NormalizedAssistantAttachment = NonNullable<AssistantResponse["attachments"]>[number];

function inferAttachmentType(input: {
  type?: unknown;
  mimeType?: unknown;
  name?: unknown;
}): string {
  const explicitType = typeof input.type === "string" ? input.type : "";
  if (["image", "document", "audio", "video"].includes(explicitType)) {
    return explicitType;
  }

  const mimeType = typeof input.mimeType === "string" ? input.mimeType : "";
  const name = typeof input.name === "string" ? input.name : "";

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (/\.pdf($|\?)/i.test(name) || /pdf/i.test(mimeType)) return "document";

  return "document";
}

function normalizeAttachment(value: unknown): NormalizedAssistantAttachment | null {
  if (!isRecord(value)) return null;

  const nameValue =
    value.name ??
    value.fileName ??
    value.file_name ??
    value.filename ??
    value.title;
  const urlValue =
    value.download_url ??
    value.downloadUrl ??
    value.file_url ??
    value.fileUrl ??
    value.signedUrl ??
    value.url;
  const mimeTypeValue =
    value.mimeType ??
    value.mime_type ??
    value.contentType ??
    value.content_type;

  const name = typeof nameValue === "string" && nameValue.trim()
    ? nameValue.trim()
    : "Download";
  const url = typeof urlValue === "string" ? urlValue.trim() : "";
  const mimeType = typeof mimeTypeValue === "string" ? mimeTypeValue : undefined;
  const size = typeof value.size === "number"
    ? value.size
    : typeof value.size_bytes === "number"
    ? value.size_bytes
    : undefined;

  if (!url && !name) return null;

  return {
    id: typeof value.id === "string" ? value.id : crypto.randomUUID(),
    type: inferAttachmentType({ type: value.type, mimeType, name }),
    name,
    url,
    download_url: url,
    downloadUrl: url,
    mimeType,
    size,
    metadata: isRecord(value.metadata) ? value.metadata : {},
  };
}

function collectAttachments(value: unknown, depth = 0): NormalizedAssistantAttachment[] {
  if (depth > 3) return [];

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^[{\[]/.test(trimmed)) {
      try {
        return collectAttachments(JSON.parse(trimmed), depth + 1);
      } catch {
        return [];
      }
    }

    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectAttachments(item, depth + 1));
  }

  if (!isRecord(value)) return [];

  const direct = normalizeAttachment(value);
  const nestedKeys = [
    "attachments",
    "files",
    "downloads",
    "download",
    "file",
    "data",
    "result",
    "output",
    "response",
  ];

  const nested = nestedKeys.flatMap((key) => collectAttachments(value[key], depth + 1));

  return direct ? [direct, ...nested] : nested;
}

function dedupeAttachments(
  attachments: NormalizedAssistantAttachment[],
): NormalizedAssistantAttachment[] {
  const seen = new Set<string>();

  return attachments.filter((attachment) => {
    const key = `${attachment.name}:${attachment.download_url || attachment.url || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(attachment.url || attachment.download_url);
  });
}

function normalizeAssistantResponse(value: unknown): AssistantResponse {
  if (!isRecord(value)) {
    throw new Error("Invalid AI response: expected an object.");
  }

  const requestId = typeof value.requestId === "string"
    ? value.requestId
    : crypto.randomUUID();

  const conversationId = typeof value.conversationId === "string"
    ? value.conversationId
    : null;

  const approvalId = typeof value.approvalId === "string"
    ? value.approvalId
    : null;

  const type: AssistantResponse["type"] = typeof value.type === "string"
    ? (value.type as AssistantResponse["type"])
    : "text";

  // n8n chatTrigger returns { output: "..." }, but some workflows return
  // nested response objects. Normalize them before the chat UI renders them.
  const message = extractReadableAiText(value.output) ||
    extractReadableAiText(value.message) ||
    extractReadableAiText(value.summary) ||
    extractReadableAiText(value) ||
    "AI request completed successfully.";

  const success = typeof value.success === "boolean"
    ? value.success
    : type !== "error";

  const requiresApproval = typeof value.requiresApproval === "boolean"
    ? value.requiresApproval
    : false;

  const data = isRecord(value.data) ? value.data : {};
  const actions = Array.isArray(value.actions)
    ? (value.actions as NonNullable<AssistantResponse["actions"]>)
    : [];
  const sources = Array.isArray(value.sources)
    ? (value.sources as NonNullable<AssistantResponse["sources"]>)
    : [];
  const attachments = dedupeAttachments(collectAttachments(value));

  return {
    success,
    requestId,
    conversationId,
    approvalId,
    type,
    message,
    output: message,
    reply: message,
    content: message,
    requiresApproval,
    data,
    actions,
    sources,
    attachments,
    raw: value.raw ?? value,
  };
}

function getSuggestionsFromResponse(response: AssistantResponse): string[] {
  const data = isRecord(response.data) ? response.data : {};

  const suggestionsFromData = Array.isArray(data.suggestions)
    ? data.suggestions.filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0,
    )
    : [];

  if (suggestionsFromData.length > 0) {
    return suggestionsFromData;
  }

  const suggestionsFromActions = Array.isArray(response.actions)
    ? response.actions
      .map((action) => action.label)
      .filter(
        (label): label is string =>
          typeof label === "string" && label.trim().length > 0,
      )
    : [];

  if (suggestionsFromActions.length > 0) {
    return suggestionsFromActions;
  }

  return [
    "Review pending work and overdue items.",
    "Check approvals, announcements, and team activity.",
    "Follow up on blockers and ownership gaps.",
  ];
}

async function postToAI<TPayload extends Record<string, unknown>>(
  payload: TPayload,
): Promise<unknown> {
  let response: Response;

  // n8n chatTrigger requires action: "sendMessage"
  const body = { action: "sendMessage", ...payload };

  try {
    response = await fetch(getAIRequestUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch";

    if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
      throw new Error(
        "The AI webhook could not be reached from the browser. Restart `npm run dev`, and make sure the n8n workflow is active. If this is production, route the request through a backend proxy or enable CORS on n8n.",
      );
    }

    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text();
    const normalizedErrorText = /<html|<!doctype/i.test(errorText)
      ? extractTextFromHtml(errorText)
      : errorText;

    if (
      response.status === 404 &&
      /not registered|webhook/i.test(normalizedErrorText)
    ) {
      throw new Error(
        "The n8n webhook is not active yet. Activate the workflow or use its test URL first.",
      );
    }

    if (response.status >= 500) {
      throw new Error(
        normalizedErrorText
          ? `n8n returned ${response.status}: ${normalizedErrorText}`
          : "The AI service returned an internal server error. Check your n8n workflow execution logs and webhook URL.",
      );
    }

    throw new Error(
      normalizedErrorText ||
        `AI request failed with status ${response.status}.`,
    );
  }

  return response.json();
}

export async function uploadAIDocument(
  payload: UploadAIDocumentPayload,
): Promise<UploadAIDocumentResult> {
  const context = buildAssistantContext(payload.context);
  const formData = new FormData();

  formData.append("file", payload.file);
  formData.append("file_name", payload.file.name);
  formData.append("file_type", payload.file.type || "application/octet-stream");
  formData.append("file_size", String(payload.file.size));
  formData.append("context", JSON.stringify(context));
  formData.append("metadata", JSON.stringify(payload.metadata ?? {}));
  formData.append("organization_id", context.organizationId ?? "");
  formData.append("uploaded_by", context.userId ?? "");
  formData.append("department", String(context.department ?? ""));
  formData.append("module", context.currentModule ?? "ai-workspace");
  formData.append("access_level", "internal");

  const response = await fetch(getAIDocumentUploadRequestUrl(), {
    method: "POST",
    body: formData,
  });

  const responseText = await response.text();
  const data = responseText
    ? (() => {
      try {
        return JSON.parse(responseText) as Record<string, unknown>;
      } catch {
        return { message: responseText };
      }
    })()
    : {};

  if (!response.ok) {
    const message = typeof data.message === "string"
      ? data.message
      : `Document upload failed with status ${response.status}.`;
    throw new Error(message);
  }

  return {
    success: data.success !== false,
    message: typeof data.message === "string" ? data.message : undefined,
    documentId: typeof data.documentId === "string" ? data.documentId : null,
    sourceUrl: typeof data.sourceUrl === "string" ? data.sourceUrl : null,
    data,
  };
}

export function buildAssistantContext(
  input: AssistantContextInput,
): AssistantContextInput {
  return {
    ...input,
    organizationId: input.organizationId ?? "workspace-default",
    role: input.role ?? "employee",
    currentRoute: input.currentRoute ?? "/ai-assistant",
    currentModule: input.currentModule ?? "ai-assistant",
    channel: input.channel ?? "web",
    timezone: input.timezone ?? "Africa/Harare",
  };
}

export async function requestRoleSummary(
  payload: AIRequestPayload,
): Promise<AISummaryResponse> {
  const context = buildAssistantContext({
    userId: payload.userId,
    organizationId: payload.organizationId,
    role: payload.role,
    currentModule: "dashboard",
    currentRoute: "/dashboard",
    channel: "dashboard",
    timezone: "Africa/Harare",
  });

  const chatInput = buildChatInput(
    payload.prompt ??
      "Generate a concise role-based summary for my dashboard. Include highlights and recommended actions.",
    context,
  );
  const sessionId = payload.userId;

  const data = await postToAI({ chatInput, sessionId });

  if (isAISummaryResponse(data)) {
    return data;
  }

  // Adapt chatTrigger text-only response into AISummaryResponse shape
  const message = isRecord(data) &&
      typeof (data as Record<string, unknown>).output === "string"
    ? (data as Record<string, unknown>).output as string
    : isRecord(data) &&
        typeof (data as Record<string, unknown>).message === "string"
    ? (data as Record<string, unknown>).message as string
    : "Dashboard summary is not available right now.";

  return {
    success: true,
    title: "Dashboard Summary",
    summary: message,
    highlights: [],
    recommendedActions: [],
  };
}

function buildChatInput(
  message: string,
  context?: AssistantContextInput,
  extra?: Record<string, unknown>,
  attachments?: AssistantAttachmentInput[],
): string {
  const parts: string[] = [message];

  const metaInsightsUrl = message.match(
    /https?:\/\/[^\s)\]"'<>]*business\.facebook\.com[^\s)\]"'<>]*/i,
  )?.[0]?.replace(/[.,;]+$/, "");
  if (metaInsightsUrl) {
    parts.push(
      `\n[Meta Business link]\nURL: ${metaInsightsUrl}\nThis page requires the user's Facebook login. Do not invent metrics. Provide Meta Business Suite export steps (CSV/XLSX) and analyze after they upload the export file.`,
    );
  }

  if (context) {
    const contextLines: string[] = [];
    if (context.role) contextLines.push(`Role: ${context.role}`);
    if (context.department) {
      contextLines.push(`Department: ${context.department}`);
    }
    if (context.currentModule) {
      contextLines.push(`Module: ${context.currentModule}`);
    }
    if (context.fullName) contextLines.push(`User: ${context.fullName}`);
    if (contextLines.length > 0) {
      parts.push(`\n[Context]\n${contextLines.join("\n")}`);
    }
  }

  if (extra) {
    const extraEntries = Object.entries(extra).filter(
      ([, v]) => v !== undefined && v !== null && v !== "",
    );
    if (extraEntries.length > 0) {
      parts.push(
        `\n[Details]\n${
          extraEntries.map(([k, v]) =>
            `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`
          ).join("\n")
        }`,
      );
    }
  }

  if (attachments?.length) {
    const wantsExtraction =
      /\bextract\b|\bpull\s+(the\s+)?data\b|presented\s+attach|this\s+attach|attached\s+file|from\s+(the\s+)?attach/i
        .test(message);
    if (wantsExtraction) {
      parts.push(
        "\n[Task]\nExtract structured data from the attached file(s) in this message. Use [Codex Intake] as the primary source when present. Return clear fields, tables, dates, amounts, names, and line items. Do not refuse because document training failed.",
      );
    }
    const filenameHint = message.match(/[\w.-]+\.(pdf|docx?|xlsx|csv)/i)?.[0];
    if (filenameHint) {
      parts.push(
        `\n[File focus]\nThe user is asking about "${filenameHint}". Use only intake/attachment content for this filename; ignore unrelated URLs or knowledge hits.`,
      );
    }
    parts.push(
      `\n[Attachments]\n${
        attachments.map((attachment) =>
          {
            const metadata = attachment.metadata ?? {};
            const documentId = typeof metadata.documentId === "string"
              ? metadata.documentId
              : null;
            const trained = typeof metadata.trained === "boolean"
              ? metadata.trained
              : null;
            const trainingMessage = typeof metadata.message === "string"
              ? metadata.message
              : null;
            const codexStorage = metadata.codexStorage === true;
            const hasDownloadableUrl = Boolean(
              attachment.url &&
                /^https?:\/\//i.test(attachment.url) &&
                !attachment.url.startsWith("blob:"),
            );
            const hasInlineText = Boolean(
              attachment.textContent && attachment.textContent.trim().length > 0,
            );
            const canExtractThisTurn = codexStorage || hasDownloadableUrl ||
              hasInlineText;

            const isMetaInsightsLink = hasDownloadableUrl &&
              /business\.facebook\.com|business\.meta\.com|adsmanager\.facebook/i
                .test(attachment.url ?? "");

            const documentInstruction = isMetaInsightsLink
              ? "Link instruction: Meta Business / Insights URL — cannot be read without the user's login. Give export steps (CSV/XLSX from Business Suite) and offer to analyze after they upload the export. Do not claim you accessed the dashboard."
              : attachment.type === "document"
              ? trained === true && documentId
              ? "Document instruction: long-term training succeeded. Prefer Document Knowledge Tool with document ID for company knowledge. Also use [Codex Intake] in the message if present for this question."
              : canExtractThisTurn
              ? "Document instruction: file is attached for THIS chat (Codex intake / URL). Extract and answer from [Codex Intake] when present, or from the attachment URL. Do NOT refuse because long-term document training failed — training is optional and separate from reading this file now."
              : trained === false
              ? "Document instruction: no downloadable URL yet. Ask the user to wait for upload to finish or re-attach the file. Only mention OCR if intake and download both failed."
              : null
              : null;

            return [
            `Name: ${attachment.name}`,
            `Type: ${attachment.type}`,
            attachment.mimeType ? `MIME: ${attachment.mimeType}` : null,
            attachment.size ? `Size: ${attachment.size}` : null,
            attachment.url ? `URL: ${attachment.url}` : null,
            attachment.type === "document" && trained === true
              ? `Long-term knowledge training: succeeded`
              : attachment.type === "document" && trained === false
              ? `Long-term knowledge training: not required for this message (chat extraction handles the file)`
              : null,
            documentId ? `Document ID: ${documentId}` : null,
            trainingMessage ? `Upload note: ${trainingMessage}` : null,
            documentInstruction,
            attachment.type === "image" && attachment.url
              ? `Vision instruction: use the Image Analysis Tool with this image URL when the user asks what is visible, asks for the car/object name, or asks to extract text from the image.`
              : null,
            attachment.textContent
              ? `Text: ${attachment.textContent.slice(0, 4000)}`
              : null,
            ].filter(Boolean).join("\n");
          }
        ).join("\n---\n")
      }`,
    );
  }

  return parts.join("\n");
}

export async function askAssistant(
  payload: AskAssistantPayload,
): Promise<AssistantResponse> {
  const context = buildAssistantContext(payload.context);

  const chatInput = buildChatInput(
    payload.message,
    context,
    payload.metadata,
    payload.attachments,
  );
  const projectSessionId = typeof payload.metadata?.projectId === "string"
    ? `project:${payload.metadata.projectId}`
    : null;
  const sessionId = projectSessionId ?? payload.conversationId ??
    context.userId ?? undefined;

  const data = await postToAI({
    chatInput,
    sessionId,
    context,
    attachments: payload.attachments ?? [],
    conversationId: payload.conversationId ?? null,
    metadata: payload.metadata ?? {},
  });

  return normalizeAssistantResponse(data);
}

export async function runAIAction(
  payload: RunAIActionPayload,
): Promise<AssistantResponse> {
  const context = buildAssistantContext(payload.context);

  const actionLabel = payload.action.label ?? payload.action.actionId;
  const prompt = typeof payload.action.payload?.prompt === "string"
    ? payload.action.payload.prompt
    : "";
  const message = prompt
    ? `[Action: ${actionLabel}]\n${prompt}`
    : `Run action: ${actionLabel}`;

  const chatInput = buildChatInput(
    message,
    context,
    {
      actionId: payload.action.actionId,
      category: payload.action.payload?.category,
      ...(payload.metadata ?? {}),
    },
    payload.attachments,
  );
  const projectSessionId = typeof payload.metadata?.projectId === "string"
    ? `project:${payload.metadata.projectId}`
    : null;
  const sessionId = projectSessionId ?? payload.conversationId ??
    context.userId ?? undefined;

  const data = await postToAI({
    chatInput,
    sessionId,
    context,
    action: payload.action,
    attachments: payload.attachments ?? [],
    conversationId: payload.conversationId ?? null,
    metadata: payload.metadata ?? {},
  });

  return normalizeAssistantResponse(data);
}

export async function analyzeDocument(
  payload: AnalyzeDocumentPayload,
): Promise<AssistantResponse> {
  const context = buildAssistantContext(payload.context);

  const attachmentNames = payload.attachments
    .map((a) => a.name)
    .filter(Boolean)
    .join(", ");
  const chatInput = buildChatInput(
    `[Document Analysis]\n${payload.prompt}${
      attachmentNames ? `\nFiles: ${attachmentNames}` : ""
    }`,
    context,
  );
  const sessionId = payload.conversationId ?? context.userId ?? undefined;

  const data = await postToAI({ chatInput, sessionId });

  return normalizeAssistantResponse(data);
}

export async function analyzeImage(
  payload: AnalyzeImagePayload,
): Promise<AssistantResponse> {
  return askAssistant({
    message: payload.prompt ??
      "Analyze this image, describe important details, and extract any useful text or issues.",
    context: buildAssistantContext(payload.context),
    attachments: [payload.attachment],
    conversationId: payload.conversationId ?? null,
    metadata: {
      source: "image_analysis",
      ...(payload.metadata ?? {}),
    },
  });
}

export async function transcribeAudio(
  payload: TranscribeAudioPayload,
): Promise<AssistantResponse> {
  return askAssistant({
    message: payload.prompt ??
      "Transcribe this audio, summarize it, and extract action items if present.",
    context: buildAssistantContext(payload.context),
    attachments: [payload.attachment],
    conversationId: payload.conversationId ?? null,
    metadata: {
      source: "audio_transcription",
      ...(payload.metadata ?? {}),
    },
  });
}

export async function generateImage(
  payload: GenerateImagePayload,
): Promise<AssistantResponse> {
  return runAIAction({
    context: buildAssistantContext(payload.context),
    conversationId: payload.conversationId ?? null,
    attachments: [],
    action: {
      actionId: "generate_image",
      label: "Generate image",
      payload: {
        prompt: payload.prompt,
      },
      requiresApproval: false,
    },
    metadata: {
      source: "image_generation",
      ...(payload.metadata ?? {}),
    },
  });
}

export async function generateDashboardSummary(
  input: GenerateDashboardSummaryInput,
): Promise<DashboardSummaryResult> {
  let response: AssistantResponse;

  try {
    response = await askAssistant({
      message:
        "Generate a short dashboard summary for this user. Keep it concise, helpful, and operational. Also return 3 to 5 suggested prompts the user can click next.",
      context: buildAssistantContext({
        userId: input.userId,
        organizationId: input.organizationId,
        role: input.role ?? "employee",
        fullName: input.userName ?? null,
        currentModule: input.currentModule ?? "dashboard",
        currentRoute: "/dashboard",
        channel: "dashboard",
        timezone: "Africa/Harare",
      }),
      metadata: {
        source: "dashboard_summary",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("DASHBOARD AI SUMMARY UNAVAILABLE:", message);

    return {
      summary:
        "AI summary is temporarily unavailable, but your dashboard data is still loaded. Review open tasks, approvals, team activity, and any items needing follow-up.",
      suggestions: [
        "Review pending work and overdue items.",
        "Check approvals, announcements, and team activity.",
        "Follow up on blockers and ownership gaps.",
      ],
    };
  }

  const data = isRecord(response.data) ? response.data : {};
  const summary =
    typeof data.summary === "string" && data.summary.trim().length > 0
      ? data.summary
      : response.message ||
        "Here is your latest workspace summary. Review your current tasks, team activity, and any pending actions.";

  return {
    summary,
    suggestions: getSuggestionsFromResponse(response),
  };
}
