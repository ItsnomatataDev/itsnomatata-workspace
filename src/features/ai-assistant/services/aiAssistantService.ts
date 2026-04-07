import {
  analyzeDocument,
  analyzeImage,
  askAssistant,
  buildAssistantContext,
  generateImage,
  runAIAction,
  transcribeAudio,
} from "../../../lib/api/ai";
import type {
  AssistantActionInput,
  AssistantAttachmentInput,
  AssistantContextInput as N8nAssistantContextInput,
  AssistantResponse,
} from "../../../lib/api/n8n";

export type AssistantContextInput = N8nAssistantContextInput;

export type AIUserRole =
  | "admin"
  | "manager"
  | "it"
  | "social_media"
  | "media_team"
  | "seo_specialist";

export type DashboardSummaryResult = {
  summary: string;
  suggestions: string[];
};

export type AiChatResponse = {
  reply: string;
  conversationId: string | null;
  assistantMessage: AssistantChatMessage;
};

export interface AssistantChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  type?:
    | "text"
    | "task_summary"
    | "project_summary"
    | "document_summary"
    | "image_analysis"
    | "audio_transcript"
    | "leave_summary"
    | "report_summary"
    | "approval_request"
    | "generated_image"
    | "error";
  createdAt: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    id: string;
    label: string;
    variant?: "primary" | "secondary" | "danger";
    payload?: Record<string, unknown>;
  }>;
  sources?: Array<{
    id?: string;
    title?: string;
    type?: string;
    url?: string;
    snippet?: string;
  }>;
  pending?: boolean;
  error?: boolean;
}

export interface SendAssistantMessageParams {
  message: string;
  context: AssistantContextInput;
  conversationId?: string | null;
  attachments?: AssistantAttachmentInput[];
  metadata?: Record<string, unknown>;
}

export interface RunAssistantActionParams {
  context: AssistantContextInput;
  action: AssistantActionInput;
  conversationId?: string | null;
  attachments?: AssistantAttachmentInput[];
  metadata?: Record<string, unknown>;
}

function createId(prefix = "msg"): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function mapAssistantResponseToChatMessage(
  response: AssistantResponse,
): AssistantChatMessage {
  return {
    id: response.requestId || createId("assistant"),
    role: "assistant",
    content: response.message,
    type: response.type,
    createdAt: nowIso(),
    data: (response.data as Record<string, unknown>) ?? {},
    actions: response.actions ?? [],
    sources: response.sources ?? [],
    error: !response.success || response.type === "error",
  };
}

function normalizeRole(role: string | null | undefined): AIUserRole | undefined {
  if (
    role === "admin" ||
    role === "manager" ||
    role === "it" ||
    role === "social_media" ||
    role === "media_team" ||
    role === "seo_specialist"
  ) {
    return role;
  }

  return undefined;
}

function getFallbackContext(
  role?: AIUserRole,
  context?: Partial<AssistantContextInput>,
): AssistantContextInput {
  return {

  userId: context?.userId ?? "workspace-ai",
  organizationId: context?.organizationId ?? "workspace-default",
  role: context?.role ?? role ?? "manager",

  };
}
export function createUserChatMessage(
  content: string,
  extras?: Partial<AssistantChatMessage>,
): AssistantChatMessage {
  return {
    id: createId("user"),
    role: "user",
    content,
    type: "text",
    createdAt: nowIso(),
    ...extras,
  };
}

export function createPendingAssistantMessage(
  content = "Codex is thinking...",
): AssistantChatMessage {
  return {
    id: createId("pending"),
    role: "assistant",
    content,
    type: "text",
    createdAt: nowIso(),
    pending: true,
  };
}

export async function generateDashboardSummary(params: {
  role: AIUserRole | string;
  context?: Partial<AssistantContextInput>;
}): Promise<DashboardSummaryResult> {
  const role = normalizeRole(params.role) ?? "manager";
  const normalizedContext = buildAssistantContext(
    getFallbackContext(role, params.context),
  );

  const response = await askAssistant({
    message:
      "Generate a concise dashboard summary for this workspace role. Include key priorities and 3 short actionable suggestions.",
    context: normalizedContext,
    attachments: [],
    conversationId: null,
    metadata: {
      requestType: "dashboard_summary",
      role,
    },
  });

  const data = (response.data as Record<string, unknown> | undefined) ?? {};
  const summaryFromData =
    typeof data.summary === "string" ? data.summary : undefined;

  const suggestionsFromData = Array.isArray(data.suggestions)
    ? data.suggestions.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];

  return {
    summary: summaryFromData ?? response.message,
    suggestions:
      suggestionsFromData.length > 0
        ? suggestionsFromData
        : [
            "Review pending work and overdue items.",
            "Check approvals, announcements, and team activity.",
            "Follow up on blockers and ownership gaps.",
          ],
  };
}

export async function sendMessage(params: SendAssistantMessageParams): Promise<{
  conversationId: string | null;
  assistantMessage: AssistantChatMessage;
}> {
  const normalizedContext = buildAssistantContext(params.context);

  const response = await askAssistant({
    message: params.message,
    context: normalizedContext,
    attachments: params.attachments ?? [],
    conversationId: params.conversationId ?? null,
    metadata: params.metadata,
  });

  return {
    conversationId: response.conversationId ?? null,
    assistantMessage: mapAssistantResponseToChatMessage(response),
  };
}

export async function sendAiChatMessage(params: {
  message: string;
  context: AssistantContextInput;
  conversationId?: string | null;
  attachments?: AssistantAttachmentInput[];
  metadata?: Record<string, unknown>;
}): Promise<AiChatResponse> {
  const result = await sendMessage({
    message: params.message,
    context: params.context,
    conversationId: params.conversationId ?? null,
    attachments: params.attachments ?? [],
    metadata: params.metadata,
  });

  return {
    reply: result.assistantMessage.content,
    conversationId: result.conversationId,
    assistantMessage: result.assistantMessage,
  };
}

export async function runAssistantAction(
  params: RunAssistantActionParams,
): Promise<{
  conversationId: string | null;
  assistantMessage: AssistantChatMessage;
}> {
  const normalizedContext = buildAssistantContext(params.context);

  const response = await runAIAction({
    context: normalizedContext,
    action: params.action,
    conversationId: params.conversationId ?? null,
    attachments: params.attachments ?? [],
    metadata: params.metadata,
  });

  return {
    conversationId: response.conversationId ?? null,
    assistantMessage: mapAssistantResponseToChatMessage(response),
  };
}

export async function sendDocumentForAnalysis(params: {
  context: AssistantContextInput;
  attachment: AssistantAttachmentInput;
  question?: string;
  conversationId?: string | null;
}): Promise<{
  conversationId: string | null;
  assistantMessage: AssistantChatMessage;
}> {
  const normalizedContext = buildAssistantContext(params.context);

  const response = await analyzeDocument({
    context: normalizedContext,
    attachment: params.attachment,
    question: params.question,
    conversationId: params.conversationId ?? null,
  });

  return {
    conversationId: response.conversationId ?? null,
    assistantMessage: mapAssistantResponseToChatMessage(response),
  };
}

export async function sendImageForAnalysis(params: {
  context: AssistantContextInput;
  attachment: AssistantAttachmentInput;
  prompt?: string;
  conversationId?: string | null;
}): Promise<{
  conversationId: string | null;
  assistantMessage: AssistantChatMessage;
}> {
  const normalizedContext = buildAssistantContext(params.context);

  const response = await analyzeImage({
    context: normalizedContext,
    attachment: params.attachment,
    prompt: params.prompt,
    conversationId: params.conversationId ?? null,
  });

  return {
    conversationId: response.conversationId ?? null,
    assistantMessage: mapAssistantResponseToChatMessage(response),
  };
}

export async function sendAudioForTranscription(params: {
  context: AssistantContextInput;
  attachment: AssistantAttachmentInput;
  prompt?: string;
  conversationId?: string | null;
}): Promise<{
  conversationId: string | null;
  assistantMessage: AssistantChatMessage;
}> {
  const normalizedContext = buildAssistantContext(params.context);

  const response = await transcribeAudio({
    context: normalizedContext,
    attachment: params.attachment,
    prompt: params.prompt,
    conversationId: params.conversationId ?? null,
  });

  return {
    conversationId: response.conversationId ?? null,
    assistantMessage: mapAssistantResponseToChatMessage(response),
  };
}

export async function requestImageGeneration(params: {
  context: AssistantContextInput;
  prompt: string;
  conversationId?: string | null;
}): Promise<{
  conversationId: string | null;
  assistantMessage: AssistantChatMessage;
}> {
  const normalizedContext = buildAssistantContext(params.context);

  const response = await generateImage({
    context: normalizedContext,
    prompt: params.prompt,
    conversationId: params.conversationId ?? null,
  });

  return {
    conversationId: response.conversationId ?? null,
    assistantMessage: mapAssistantResponseToChatMessage(response),
  };
}

export async function saveConversationMessage(
  _message: AssistantChatMessage,
  _conversationId?: string | null,
): Promise<void> {
  return;
}

export async function getConversationHistory(
  _conversationId: string,
): Promise<AssistantChatMessage[]> {
  return [];
}