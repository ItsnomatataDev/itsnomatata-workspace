import { askAssistant, runAIAction } from "../../../lib/api/ai";
import type {
  AssistantActionInput,
  AssistantAttachmentInput,
  AssistantContextInput,
  AssistantResponse,
} from "../../../lib/api/n8n";
import {
  type AIApprovalRow,
  type AIMessageRow,
  createApproval,
  createConversation,
  createMessage,
  getHistoryItems,
  getPendingApprovals,
  getRecentOutputs,
} from "../../../lib/supabase/queries/aiWorkspace";
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

// ── Map DB rows → workspace types ─────────────────────────

function messageToOutput(
  msg: AIMessageRow & {
    conversation?: { title?: string | null; tool_id?: string | null } | null;
  },
): AIWorkspaceOutput {
  const toolId = msg.tool_id ?? msg.conversation?.tool_id ?? null;
  return {
    id: msg.id,
    title: msg.conversation?.title ?? getActionById(toolId ?? "")?.label ??
      "AI Output",
    type: (msg.type as AIWorkspaceOutput["type"]) ?? "text",
    content: msg.content,
    createdAt: msg.created_at,
    toolId,
    conversationId: msg.conversation_id,
    requiresApproval: msg.requires_approval,
    approvalId: msg.approval_id,
    data: msg.data,
    sources: msg.sources as AIWorkspaceOutput["sources"],
  };
}

function messageToHistoryItem(
  msg: AIMessageRow & {
    conversation?: { title?: string | null; tool_id?: string | null } | null;
  },
): AIWorkspaceHistoryItem {
  return {
    id: msg.id,
    title: msg.conversation?.title ?? getActionById(msg.tool_id ?? "")?.label ??
      "AI Action",
    description: msg.content.slice(0, 200),
    createdAt: msg.created_at,
    status: msg.error ? "failed" : "success",
    toolId: msg.tool_id ?? msg.conversation?.tool_id ?? null,
    conversationId: msg.conversation_id,
  };
}

function approvalRowToItem(row: AIApprovalRow): AIWorkspaceApprovalItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    createdAt: row.created_at,
    status: row.status,
    requestedBy: row.user_id,
    toolId: row.tool_id,
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

export async function getRecentAIWorkspaceOutputs(
  userId?: string | null,
): Promise<AIWorkspaceOutput[]> {
  if (!userId) return [];
  try {
    const rows = await getRecentOutputs(userId, 10);
    return rows.map(messageToOutput);
  } catch (err) {
    console.warn("AI outputs load failed, returning empty:", err);
    return [];
  }
}

export async function getAIWorkspaceHistory(
  userId?: string | null,
): Promise<AIWorkspaceHistoryItem[]> {
  if (!userId) return [];
  try {
    const rows = await getHistoryItems(userId, 20);
    return rows.map(messageToHistoryItem);
  } catch (err) {
    console.warn("AI history load failed, returning empty:", err);
    return [];
  }
}

export async function getPendingAIWorkspaceApprovals(
  organizationId?: string | null,
): Promise<AIWorkspaceApprovalItem[]> {
  if (!organizationId) return [];
  try {
    const rows = await getPendingApprovals(organizationId, 20);
    return rows.map(approvalRowToItem);
  } catch (err) {
    console.warn("AI approvals load failed, returning empty:", err);
    return [];
  }
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

  // Ensure a conversation exists
  let conversationId = params.conversationId;
  if (
    !conversationId && params.context.userId && params.context.organizationId
  ) {
    try {
      const conv = await createConversation({
        organizationId: params.context.organizationId,
        userId: params.context.userId,
        title: tool.label,
        toolId: tool.id,
      });
      conversationId = conv.id;
    } catch (err) {
      console.warn(
        "Failed to create AI conversation, continuing without persistence:",
        err,
      );
    }
  }

  // Persist user message
  if (conversationId && params.prompt) {
    try {
      await createMessage({
        conversationId,
        role: "user",
        content: params.prompt,
        type: "text",
        toolId: tool.id,
      });
    } catch (err) {
      console.warn("Failed to persist user message:", err);
    }
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
      conversationId: conversationId ?? null,
      attachments: params.attachments ?? [],
      metadata: {
        toolId: tool.id,
        toolCategory: tool.category,
        ...(params.metadata ?? {}),
      },
    });

    const output = toWorkspaceOutput(response, tool.id);
    output.conversationId = conversationId;

    // Persist assistant response
    if (conversationId) {
      try {
        const assistantMsg = await createMessage({
          conversationId,
          role: "assistant",
          content: response.message,
          type: response.type,
          toolId: tool.id,
          data: (response.data as Record<string, unknown>) ?? {},
          sources: (response.sources ?? []) as Array<Record<string, unknown>>,
          actions: (response.actions ?? []) as unknown as Array<
            Record<string, unknown>
          >,
          requiresApproval: response.requiresApproval ?? false,
        });

        // Create approval record if needed
        if (
          response.requiresApproval && params.context.organizationId &&
          params.context.userId
        ) {
          try {
            const approval = await createApproval({
              organizationId: params.context.organizationId,
              userId: params.context.userId,
              conversationId,
              messageId: assistantMsg.id,
              toolId: tool.id,
              title: tool.label,
              description: response.message.slice(0, 500),
              payload: {
                actionId: tool.id,
                prompt: params.prompt,
                response: response.data,
              },
            });
            output.approvalId = approval.id;
          } catch (err) {
            console.warn("Failed to create approval:", err);
          }
        }
      } catch (err) {
        console.warn("Failed to persist assistant response:", err);
      }
    }

    return output;
  } catch (error) {
    // Persist error
    if (conversationId) {
      try {
        await createMessage({
          conversationId,
          role: "assistant",
          content: getErrorMessage(error),
          type: "error",
          toolId: tool.id,
          error: true,
        });
      } catch (_) { /* ignore */ }
    }

    if (!isServiceUnavailableError(error)) {
      throw error;
    }

    const fallback = buildFallbackOutput({
      title: `${tool.label} (preview mode)`,
      prompt: params.prompt,
      toolId: tool.id,
      conversationId,
      requiresApproval: tool.requiresApproval,
      error,
    });
    fallback.conversationId = conversationId;
    return fallback;
  }
}

export async function askAIWorkspaceAssistant(params: {
  context: AssistantContextInput;
  prompt: string;
  attachments?: AssistantAttachmentInput[];
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<AIWorkspaceOutput> {
  // Ensure a conversation exists
  let conversationId = params.conversationId;
  if (
    !conversationId && params.context.userId && params.context.organizationId
  ) {
    try {
      const conv = await createConversation({
        organizationId: params.context.organizationId,
        userId: params.context.userId,
        title: params.prompt.slice(0, 80),
      });
      conversationId = conv.id;
    } catch (err) {
      console.warn("Failed to create AI conversation:", err);
    }
  }

  // Persist user message
  if (conversationId) {
    try {
      await createMessage({
        conversationId,
        role: "user",
        content: params.prompt,
        type: "text",
      });
    } catch (err) {
      console.warn("Failed to persist user message:", err);
    }
  }

  try {
    const response = await askAssistant({
      message: params.prompt,
      context: params.context,
      attachments: params.attachments ?? [],
      conversationId: conversationId ?? null,
      metadata: {
        source: "ai_workspace",
        ...(params.metadata ?? {}),
      },
    });

    const output = toWorkspaceOutput(response, null);
    output.conversationId = conversationId;

    // Persist assistant response
    if (conversationId) {
      try {
        await createMessage({
          conversationId,
          role: "assistant",
          content: response.message,
          type: response.type,
          data: (response.data as Record<string, unknown>) ?? {},
          sources: (response.sources ?? []) as Array<Record<string, unknown>>,
          actions: (response.actions ?? []) as unknown as Array<
            Record<string, unknown>
          >,
        });
      } catch (err) {
        console.warn("Failed to persist assistant response:", err);
      }
    }

    return output;
  } catch (error) {
    if (conversationId) {
      try {
        await createMessage({
          conversationId,
          role: "assistant",
          content: getErrorMessage(error),
          type: "error",
          error: true,
        });
      } catch (_) { /* ignore */ }
    }

    if (!isServiceUnavailableError(error)) {
      throw error;
    }

    const fallback = buildFallbackOutput({
      title: "AI Workspace Assistant (preview mode)",
      prompt: params.prompt,
      toolId: null,
      conversationId,
      error,
    });
    fallback.conversationId = conversationId;
    return fallback;
  }
}

export async function runAIWorkspaceRequest(params: {
  context: AssistantContextInput;
  request: AIWorkspaceActionRequest;
  conversationId?: string | null;
}): Promise<AIWorkspaceOutput> {
  return runAIWorkspaceTool({
    context: params.context,
    toolId: params.request.action.actionId,
    prompt: (params.request.action.payload?.prompt as string) ?? undefined,
    attachments: params.request.attachments,
    conversationId: params.conversationId,
    metadata: params.request.metadata,
  });
}

export async function reviewAIApproval(params: {
  approvalId: string;
  reviewerId: string;
  status: "approved" | "rejected";
  reviewNote?: string | null;
}) {
  const { reviewApproval, getApproval } = await import(
    "../../../lib/supabase/queries/aiWorkspace"
  );

  const approval = await reviewApproval(params);

  // On approval, persist the review outcome to the audit log
  if (approval.status === "approved" || approval.status === "rejected") {
    try {
      const { supabase } = await import("../../../lib/supabase/client");
      await supabase.from("ai_audit_logs").insert({
        organization_id: approval.organization_id,
        user_id: params.reviewerId,
        action: `approval_${approval.status}`,
        status: "success",
        request_payload: {
          approvalId: params.approvalId,
          toolId: approval.tool_id,
          reviewNote: params.reviewNote,
        },
        response_payload: { status: approval.status },
      });
    } catch {
      // Non-critical — don't fail the review
    }
  }

  return approval;
}

/**
 * Execute the action that was originally gated behind an approval.
 * Called after a reviewer approves the request.
 */
export async function executeApprovedAction(params: {
  context: AssistantContextInput;
  approvalId: string;
  conversationId?: string | null;
}): Promise<AIWorkspaceOutput> {
  const { getApproval } = await import(
    "../../../lib/supabase/queries/aiWorkspace"
  );
  const approval = await getApproval(params.approvalId);

  if (approval.status !== "approved") {
    throw new Error(
      `Cannot execute action — approval status is "${approval.status}".`,
    );
  }

  const toolId = approval.tool_id;
  const prompt = typeof approval.payload?.prompt === "string"
    ? approval.payload.prompt
    : undefined;

  if (!toolId) {
    throw new Error("Approval record has no associated tool ID.");
  }

  return runAIWorkspaceTool({
    context: params.context,
    toolId,
    prompt,
    conversationId: params.conversationId ?? approval.conversation_id ?? null,
    metadata: {
      triggeredByApproval: params.approvalId,
    },
  });
}

export async function buildDefaultAIWorkspaceData(
  role?: string | null,
  userId?: string | null,
  organizationId?: string | null,
) {
  return {
    tools: await getAvailableAIWorkspaceTools(role),
    featuredTools: await getFeaturedAIWorkspaceTools(role),
    recentOutputs: await getRecentAIWorkspaceOutputs(userId),
    history: await getAIWorkspaceHistory(userId),
    pendingApprovals: await getPendingAIWorkspaceApprovals(organizationId),
  };
}
