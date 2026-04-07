// src/features/ai-workspace/services/aiWorkspaceService.ts

import { askAssistant, runAIAction } from "../../../lib/api/ai";
import type {
  AssistantActionInput,
  AssistantAttachmentInput,
  AssistantContextInput,
  AssistantResponse,
} from "../../../lib/api/n8n";
import {
  AI_ACTION_CATALOG,
  getActionById,
} from "../utils/actionCatalog";
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
  return `${prefix}_${crypto.randomUUID()}`;
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
  return [];
}

export async function getAIWorkspaceHistory(): Promise<
  AIWorkspaceHistoryItem[]
> {
  return [];
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
}

export async function askAIWorkspaceAssistant(params: {
  context: AssistantContextInput;
  prompt: string;
  attachments?: AssistantAttachmentInput[];
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<AIWorkspaceOutput> {
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
