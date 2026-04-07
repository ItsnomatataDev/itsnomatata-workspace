import {
  type AssistantActionInput,
  type AssistantAttachmentInput,
  type AssistantContextInput,
  type AssistantMessageInput,
  type AssistantResponse,
  sendAssistantActionToN8n,
  sendAssistantIngestToN8n,
  sendAssistantMessageToN8n,
} from "./n8n";

export interface AskAssistantInput {
  message: string;
  context: AssistantContextInput;
  attachments?: AssistantAttachmentInput[];
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RunAIActionInput {
  context: AssistantContextInput;
  action: AssistantActionInput;
  conversationId?: string | null;
  attachments?: AssistantAttachmentInput[];
  metadata?: Record<string, unknown>;
}

export interface AnalyzeDocumentInput {
  context: AssistantContextInput;
  attachment: AssistantAttachmentInput;
  question?: string;
  conversationId?: string | null;
}

export interface AnalyzeImageInput {
  context: AssistantContextInput;
  attachment: AssistantAttachmentInput;
  prompt?: string;
  conversationId?: string | null;
}

export interface TranscribeAudioInput {
  context: AssistantContextInput;
  attachment: AssistantAttachmentInput;
  prompt?: string;
  conversationId?: string | null;
}

export interface GenerateImageInput {
  context: AssistantContextInput;
  prompt: string;
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
}

function normalizeAssistantResponse(
  response: AssistantResponse,
): AssistantResponse {
  return {
    success: response.success ?? true,
    type: response.type ?? "text",
    message: response.message ?? "",
    conversationId: response.conversationId ?? null,
    requestId: response.requestId ?? null,
    requiresApproval: response.requiresApproval ?? false,
    approvalId: response.approvalId ?? null,
    data: response.data ?? {},
    actions: response.actions ?? [],
    sources: response.sources ?? [],
    raw: response.raw ?? response,
  };
}

export async function askAssistant(
  input: AskAssistantInput,
): Promise<AssistantResponse> {
  const payload: AssistantMessageInput = {
    message: input.message,
    context: input.context,
    attachments: input.attachments ?? [],
    conversationId: input.conversationId ?? null,
    metadata: {
      mode: "chat",
      ...(input.metadata ?? {}),
    },
  };

  const response = await sendAssistantMessageToN8n(payload);
  return normalizeAssistantResponse(response);
}

export async function runAIAction(
  input: RunAIActionInput,
): Promise<AssistantResponse> {
  const response = await sendAssistantActionToN8n({
    context: input.context,
    conversationId: input.conversationId ?? null,
    action: input.action,
    attachments: input.attachments ?? [],
    metadata: {
      mode: "action",
      ...(input.metadata ?? {}),
    },
  });

  return normalizeAssistantResponse(response);
}

export async function analyzeDocument(
  input: AnalyzeDocumentInput,
): Promise<AssistantResponse> {
  const ingestResponse = await sendAssistantIngestToN8n({
    context: input.context,
    attachment: input.attachment,
    metadata: {
      mode: "document_ingest",
      question:
        input.question ??
        "Summarize this document and extract key action items.",
    },
  });

  if (!input.question) {
    return normalizeAssistantResponse(ingestResponse);
  }

  const response = await askAssistant({
    message: input.question,
    context: input.context,
    attachments: [input.attachment],
    conversationId:
      input.conversationId ?? ingestResponse.conversationId ?? null,
    metadata: {
      mode: "document_qa",
    },
  });

  return normalizeAssistantResponse(response);
}

export async function analyzeImage(
  input: AnalyzeImageInput,
): Promise<AssistantResponse> {
  const response = await askAssistant({
    message:
      input.prompt ??
      "Analyze this image, describe important details, and extract any useful text or issues.",
    context: input.context,
    attachments: [input.attachment],
    conversationId: input.conversationId ?? null,
    metadata: {
      mode: "image_analysis",
    },
  });

  return normalizeAssistantResponse(response);
}

export async function transcribeAudio(
  input: TranscribeAudioInput,
): Promise<AssistantResponse> {
  const response = await askAssistant({
    message:
      input.prompt ??
      "Transcribe this audio, summarize it, and extract action items if present.",
    context: input.context,
    attachments: [input.attachment],
    conversationId: input.conversationId ?? null,
    metadata: {
      mode: "audio_transcription",
    },
  });

  return normalizeAssistantResponse(response);
}

export async function generateImage(
  input: GenerateImageInput,
): Promise<AssistantResponse> {
  const response = await runAIAction({
    context: input.context,
    conversationId: input.conversationId ?? null,
    action: {
      actionId: "generate_image",
      label: "Generate image",
      payload: {
        prompt: input.prompt,
      },
      requiresApproval: false,
    },
    metadata: {
      mode: "image_generation",
      ...(input.metadata ?? {}),
    },
  });

  return normalizeAssistantResponse(response);
}

export function buildAssistantContext(
  input: AssistantContextInput,
): AssistantContextInput {
  return {
    ...input,
    channel: input.channel ?? "web",
    timezone: input.timezone ?? "Africa/Harare",
  };
}

export type AIUserRole =
  | "admin"
  | "manager"
  | "it"
  | "social_media"
  | "media_team"
  | "seo_specialist"
  | "employee";

export interface GenerateDashboardSummaryInput {
  organizationId: string;
  userId: string;
  role?: AIUserRole;
  userName?: string | null;
  currentModule?: string | null;
}

export interface DashboardSummaryResult {
  summary: string;
  suggestions: string[];
}

export async function generateDashboardSummary(
  input: GenerateDashboardSummaryInput,
): Promise<DashboardSummaryResult> {
  const response = await askAssistant({
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
      mode: "dashboard_summary",
    },
  });

  const summary =
    typeof response.data?.summary === "string" && response.data.summary.trim()
      ? response.data.summary
      : response.message ||
        "Here is your latest workspace summary. Review your current tasks, team activity, and any pending actions.";

  const suggestions = Array.isArray(response.data?.suggestions)
    ? response.data.suggestions.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : Array.isArray(response.actions)
      ? response.actions
          .map((action) => action.label)
          .filter(
            (label): label is string =>
              typeof label === "string" && label.trim().length > 0,
          )
      : [];

  return {
    summary,
    suggestions,
  };
}

export const generateITWorkspaceSummary = generateDashboardSummary;