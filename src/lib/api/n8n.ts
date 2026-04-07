// src/lib/api/n8n.ts

export type AssistantChannel = "web" | "dashboard" | "automation" | "whatsapp";

export type AssistantAttachmentType =
  | "image"
  | "audio"
  | "document"
  | "text"
  | "unknown";

export interface AssistantAttachmentInput {
  id?: string;
  name: string;
  url?: string;
  mimeType?: string;
  size?: number;
  type: AssistantAttachmentType;
  textContent?: string;
}

export interface AssistantContextInput {
  userId: string;
  organizationId?: string | null;
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
  department?: string | null;
  currentRoute?: string | null;
  currentModule?: string | null;
  selectedEntityId?: string | null;
  selectedEntityType?: string | null;
  timezone?: string | null;
  channel?: AssistantChannel;
  sessionId?: string | null;
}

export interface AssistantActionInput {
  actionId: string;
  label?: string;
  payload?: Record<string, unknown>;
  requiresApproval?: boolean;
}

export interface AssistantMessageInput {
  message: string;
  context: AssistantContextInput;
  attachments?: AssistantAttachmentInput[];
  action?: AssistantActionInput | null;
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AssistantQuickAction {
  id: string;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  payload?: Record<string, unknown>;
}

export interface AssistantSourceReference {
  id?: string;
  title?: string;
  type?: string;
  url?: string;
  snippet?: string;
}

export interface AssistantStructuredData {
  [key: string]: unknown;
}

export type AssistantResponseType =
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

export interface AssistantResponse {
  success: boolean;
  type: AssistantResponseType;
  message: string;
  conversationId?: string | null;
  requestId?: string | null;
  requiresApproval?: boolean;
  approvalId?: string | null;
  data?: AssistantStructuredData;
  actions?: AssistantQuickAction[];
  sources?: AssistantSourceReference[];
  raw?: unknown;
}

export interface AssistantHealthResponse {
  ok: boolean;
  status: "healthy" | "degraded" | "offline";
  message?: string;
}

export interface TriggerN8NFlowInput {
  webhookUrl: string;
  payload?: Record<string, unknown>;
  apiKey?: string;
  timeoutMs?: number;
}

export interface TriggerN8NFlowResult {
  ok: boolean;
  status: number;
  data?: Record<string, any>;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 60_000;

function getEnv(name: string): string | undefined {
  const value = (
    import.meta as ImportMeta & { env?: Record<string, string | undefined> }
  ).env?.[name];

  return value?.trim() || undefined;
}

function getRequiredEnv(name: string): string {
  const value = getEnv(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function withTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  controller.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timeout);
    },
    { once: true },
  );

  return controller.signal;
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function getReadableFetchError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "The request to n8n timed out.";
    }

    return error.message;
  }

  return "Unknown network error while contacting n8n.";
}

async function postJson<TResponse>(
  url: string,
  payload: unknown,
  options?: {
    apiKey?: string;
    timeoutMs?: number;
    debugLabel?: string;
  },
): Promise<TResponse> {
  const debugLabel = options?.debugLabel ?? "n8n";

  console.log(`[${debugLabel}] POST`, url);
  console.log(`[${debugLabel}] payload`, payload);

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options?.apiKey ? { "x-api-key": options.apiKey } : {}),
      },
      body: JSON.stringify(payload),
      signal: withTimeoutSignal(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    const readableMessage = getReadableFetchError(error);
    console.error(`[${debugLabel}] fetch failed`, error);
    throw new Error(readableMessage);
  }

  console.log(`[${debugLabel}] response status`, response.status);

  const json = await parseJsonSafe<TResponse & { message?: string }>(response);
  console.log(`[${debugLabel}] response json`, json);

  if (!response.ok) {
    const errorMessage =
      (json && typeof json === "object" && "message" in json && json.message) ||
      `Request failed with status ${response.status}`;

    throw new Error(errorMessage);
  }

  if (!json) {
    throw new Error("n8n returned an empty or invalid JSON response.");
  }

  return json;
}

export async function sendAssistantMessageToN8n(
  input: AssistantMessageInput,
): Promise<AssistantResponse> {
  const webhookUrl = getRequiredEnv("VITE_N8N_AI_CHAT_WEBHOOK");
  const apiKey = getEnv("VITE_N8N_AI_API_KEY");

  console.log("[assistant-chat] webhook URL", webhookUrl);

  return postJson<AssistantResponse>(webhookUrl, input, {
    apiKey,
    debugLabel: "assistant-chat",
  });
}

export async function sendAssistantActionToN8n(input: {
  context: AssistantContextInput;
  conversationId?: string | null;
  action: AssistantActionInput;
  attachments?: AssistantAttachmentInput[];
  metadata?: Record<string, unknown>;
}): Promise<AssistantResponse> {
  const webhookUrl =
    getEnv("VITE_N8N_AI_ACTION_WEBHOOK") ||
    getRequiredEnv("VITE_N8N_AI_CHAT_WEBHOOK");
  const apiKey = getEnv("VITE_N8N_AI_API_KEY");

  console.log("[assistant-action] webhook URL", webhookUrl);

  return postJson<AssistantResponse>(webhookUrl, input, {
    apiKey,
    debugLabel: "assistant-action",
  });
}

export async function sendAssistantIngestToN8n(input: {
  context: AssistantContextInput;
  attachment: AssistantAttachmentInput;
  metadata?: Record<string, unknown>;
}): Promise<AssistantResponse> {
  const webhookUrl =
    getEnv("VITE_N8N_AI_INGEST_WEBHOOK") ||
    getRequiredEnv("VITE_N8N_AI_CHAT_WEBHOOK");
  const apiKey = getEnv("VITE_N8N_AI_API_KEY");

  console.log("[assistant-ingest] webhook URL", webhookUrl);

  return postJson<AssistantResponse>(webhookUrl, input, {
    apiKey,
    debugLabel: "assistant-ingest",
  });
}

export async function getAssistantHealth(): Promise<AssistantHealthResponse> {
  const healthUrl = getEnv("VITE_N8N_AI_HEALTH_URL");

  if (!healthUrl) {
    return {
      ok: true,
      status: "healthy",
      message:
        "Health endpoint not configured. Assuming healthy in local mode.",
    };
  }

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      signal: withTimeoutSignal(15_000),
    });

    if (!response.ok) {
      return {
        ok: false,
        status: "offline",
        message: `Health check failed with status ${response.status}`,
      };
    }

    const json = await parseJsonSafe<AssistantHealthResponse>(response);

    return (
      json || {
        ok: true,
        status: "healthy",
        message: "Health endpoint responded successfully.",
      }
    );
  } catch (error) {
    return {
      ok: false,
      status: "offline",
      message: getReadableFetchError(error),
    };
  }
}

export async function triggerN8NFlow({
  webhookUrl,
  payload = {},
  apiKey,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: TriggerN8NFlowInput): Promise<TriggerN8NFlowResult> {
  console.log("[trigger-n8n-flow] webhook URL", webhookUrl);
  console.log("[trigger-n8n-flow] payload", payload);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify(payload),
      signal: withTimeoutSignal(timeoutMs),
    });

    console.log("[trigger-n8n-flow] response status", response.status);

    const json = await parseJsonSafe<Record<string, any>>(response);
    console.log("[trigger-n8n-flow] response json", json);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error:
          (json && typeof json.message === "string" && json.message) ||
          `Request failed with status ${response.status}`,
        data: json ?? undefined,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: json ?? {},
    };
  } catch (error) {
    console.error("[trigger-n8n-flow] fetch failed", error);

    return {
      ok: false,
      status: 0,
      error: getReadableFetchError(error),
    };
  }
}
