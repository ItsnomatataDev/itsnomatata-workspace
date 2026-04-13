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

  // n8n chatTrigger returns { output: "..." }
  const message = typeof value.output === "string"
    ? value.output
    : typeof value.message === "string"
    ? value.message
    : typeof value.summary === "string"
    ? value.summary
    : "AI request completed successfully.";

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

  return {
    success,
    requestId,
    conversationId,
    approvalId,
    type,
    message,
    requiresApproval,
    data,
    actions,
    sources,
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
        normalizedErrorText ||
          "The AI service returned an internal server error. Check your n8n workflow execution logs and webhook URL.",
      );
    }

    throw new Error(
      normalizedErrorText ||
        `AI request failed with status ${response.status}.`,
    );
  }

  return response.json();
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
): string {
  const parts: string[] = [message];

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

  return parts.join("\n");
}

export async function askAssistant(
  payload: AskAssistantPayload,
): Promise<AssistantResponse> {
  const context = buildAssistantContext(payload.context);

  const chatInput = buildChatInput(payload.message, context);
  const sessionId = payload.conversationId ?? context.userId ?? undefined;

  const data = await postToAI({
    chatInput,
    sessionId,
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

  const chatInput = buildChatInput(message, context, {
    actionId: payload.action.actionId,
    category: payload.action.payload?.category,
  });
  const sessionId = payload.conversationId ?? context.userId ?? undefined;

  const data = await postToAI({
    chatInput,
    sessionId,
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
      source: "dashboard_summary",
    },
  });

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

export const generateITWorkspaceSummary = generateDashboardSummary;
