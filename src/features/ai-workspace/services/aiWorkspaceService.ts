import { askAssistant, runAIAction } from "../../../lib/api/ai";
import type {
  AssistantActionInput,
  AssistantAttachmentInput,
  AssistantContextInput,
  AssistantResponse,
} from "../../../lib/api/n8n";
import { AI_ACTION_CATALOG, getActionById } from "../utils/actionCatalog";
import { getFeaturedToolsForRole, getToolsForRole } from "../utils/roleTools";
import type {
  AIWorkspaceActionRequest,
  AIWorkspaceApprovalItem,
  AIWorkspaceHistoryItem,
  AIWorkspaceOutput,
  AIWorkspaceTool,
} from "../types/aiWorkspace";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix = "aiws") {
  const randomPart = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}_${randomPart}`;
}

function minutesAgoIso(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to reach the AI service.";
}

function isServiceUnavailableError(error: unknown) {
  return /VITE_N8N_AI_WEBHOOK_URL|Failed to fetch|Load failed|NetworkError|AI request failed/i
    .test(
      getErrorMessage(error),
    );
}

function buildFallbackOutput(params: {
  title: string;
  prompt?: string;
  toolId?: string | null;
  conversationId?: string | null;
  requiresApproval?: boolean;
  error: unknown;
}): AIWorkspaceOutput {
  const errorMessage = getErrorMessage(params.error);

  return {
    id: makeId("output"),
    title: params.title,
    type: params.requiresApproval ? "approval_request" : "text",
    content: [
      "Live AI is not available right now, so this workspace is running in preview mode.",
      errorMessage,
      params.prompt ? `Request: ${params.prompt}` : null,
      "Configure `VITE_N8N_AI_WEBHOOK_URL` to enable real-time AI actions and assistant replies.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    createdAt: nowIso(),
    toolId: params.toolId ?? null,
    conversationId: params.conversationId ?? null,
    requiresApproval: params.requiresApproval ?? false,
    approvalId: params.requiresApproval ? makeId("approval") : null,
    data: {
      preview: true,
      unavailableReason: errorMessage,
    },
    sources: [
      {
        id: "ai-workspace-preview",
        title: "AI workspace preview mode",
        type: "system",
        snippet:
          "The workspace UI is ready. Add the n8n webhook configuration to enable live results.",
      },
    ],
  };
}

function mapCatalogTool(
  tool: (typeof AI_ACTION_CATALOG)[number],
): AIWorkspaceTool {
  return {
    ...tool,
  };
}

function toWorkspaceOutput(
  response: AssistantResponse,
  toolId?: string | null,
): AIWorkspaceOutput {
  return {
    id: response.requestId || makeId("output"),
    title: toolId ? getActionById(toolId)?.label || "AI Output" : "AI Output",
    type: response.type,
    content: response.message,
    createdAt: nowIso(),
    toolId: toolId ?? null,
    conversationId: response.conversationId ?? null,
    requiresApproval: response.requiresApproval ?? false,
    approvalId: response.approvalId ?? null,
    data: (response.data as Record<string, unknown>) ?? {},
    sources: response.sources ?? [],
  };
}

export async function getAvailableAIWorkspaceTools(
  role?: string | null,
): Promise<AIWorkspaceTool[]> {
  return getToolsForRole(role).map(mapCatalogTool);
}

export async function getFeaturedAIWorkspaceTools(
  role?: string | null,
): Promise<AIWorkspaceTool[]> {
  return getFeaturedToolsForRole(role).map(mapCatalogTool);
}

export async function getRecentAIWorkspaceOutputs(): Promise<
  AIWorkspaceOutput[]
> {
  return [
    {
      id: "aiws_welcome_output",
      title: "AI workspace ready",
      type: "text",
      content:
        "Your AI workspace is connected to role-aware tools for tasks, reports, knowledge, media, and automation. Use Quick Search, run a featured tool, or open the approvals view to continue.",
      createdAt: minutesAgoIso(8),
      toolId: "ask_codex",
      conversationId: null,
      requiresApproval: false,
      approvalId: null,
      data: {
        starter: true,
      },
      sources: [
        {
          id: "ai-action-catalog",
          title: "Role-based AI catalog",
          type: "system",
          snippet:
            "Featured tools and permissions have been loaded for the current workspace role.",
        },
      ],
    },
  ];
}

export async function getAIWorkspaceHistory(): Promise<
  AIWorkspaceHistoryItem[]
> {
  return [
    {
      id: "aiws_history_ready",
      title: "Workspace initialized",
      description:
        "AI workspace components loaded successfully and are ready for live or preview-mode actions.",
      createdAt: minutesAgoIso(12),
      status: "success",
      toolId: "ask_codex",
    },
  ];
}

export async function getPendingAIWorkspaceApprovals(): Promise<
  AIWorkspaceApprovalItem[]
> {
  return [];
}

export async function runAIWorkspaceTool(params: {
  context: AssistantContextInput;
  toolId: string;
  prompt?: string;
  attachments?: AssistantAttachmentInput[];
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<AIWorkspaceOutput> {
  const tool = getActionById(params.toolId);

  if (!tool) {
    throw new Error(`Unknown AI workspace tool: ${params.toolId}`);
  }

  const action: AssistantActionInput = {
    actionId: tool.id,
    label: tool.label,
    payload: {
      prompt: params.prompt ?? "",
      category: tool.category,
    },
    requiresApproval: tool.requiresApproval,
  };

  try {
    const response = await runAIAction({
      context: params.context,
      action,
      conversationId: params.conversationId ?? null,
      attachments: params.attachments ?? [],
      metadata: {
        toolId: tool.id,
        toolCategory: tool.category,
        ...(params.metadata ?? {}),
      },
    });

    return toWorkspaceOutput(response, tool.id);
  } catch (error) {
    if (!isServiceUnavailableError(error)) {
      throw error;
    }

    return buildFallbackOutput({
      title: `${tool.label} (preview mode)`,
      prompt: params.prompt,
      toolId: tool.id,
      conversationId: params.conversationId ?? null,
      requiresApproval: tool.requiresApproval,
      error,
    });
  }
}

export async function askAIWorkspaceAssistant(params: {
  context: AssistantContextInput;
  prompt: string;
  attachments?: AssistantAttachmentInput[];
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<AIWorkspaceOutput> {
  try {
    const response = await askAssistant({
      message: params.prompt,
      context: params.context,
      attachments: params.attachments ?? [],
      conversationId: params.conversationId ?? null,
      metadata: {
        source: "ai_workspace",
        ...(params.metadata ?? {}),
      },
    });

    return toWorkspaceOutput(response, null);
  } catch (error) {
    if (!isServiceUnavailableError(error)) {
      throw error;
    }

    return buildFallbackOutput({
      title: "AI Workspace Assistant (preview mode)",
      prompt: params.prompt,
      toolId: null,
      conversationId: params.conversationId ?? null,
      error,
    });
  }
}

export async function runAIWorkspaceRequest(params: {
  context: AssistantContextInput;
  request: AIWorkspaceActionRequest;
  conversationId?: string | null;
}): Promise<AIWorkspaceOutput> {
  const response = await runAIAction({
    context: params.context,
    action: params.request.action,
    conversationId: params.conversationId ?? null,
    attachments: params.request.attachments ?? [],
    metadata: params.request.metadata ?? {},
  });

  return toWorkspaceOutput(response, params.request.action.actionId);
}

export async function buildDefaultAIWorkspaceData(role?: string | null) {
  return {
    tools: await getAvailableAIWorkspaceTools(role),
    featuredTools: await getFeaturedAIWorkspaceTools(role),
    recentOutputs: await getRecentAIWorkspaceOutputs(),
    history: await getAIWorkspaceHistory(),
    pendingApprovals: await getPendingAIWorkspaceApprovals(),
  };
}
