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
  AssistantContextInput,
  AssistantResponse,
} from "../../../lib/api/n8n";

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

/**
 * Placeholder hooks for persistence.
 * Wire these to your existing aiActivityLogs tables next.
 */
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
