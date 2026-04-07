import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AssistantAttachmentInput,
  AssistantContextInput,
} from "../../../lib/api/n8n";
import {
  askAIWorkspaceAssistant,
  buildDefaultAIWorkspaceData,
  runAIWorkspaceTool,
} from "../services/aiWorkspaceService";
import type {
  AIWorkspaceApprovalItem,
  AIWorkspaceHistoryItem,
  AIWorkspaceOutput,
  AIWorkspaceState,
  AIWorkspaceTool,
  AIWorkspaceViewMode,
} from "../types/aiWorkspace";

type UseAIWorkspaceParams = {
  context: AssistantContextInput;
  role?: string | null;
};

export function useAIWorkspace({ context, role }: UseAIWorkspaceParams) {
  const [state, setState] = useState<AIWorkspaceState>({
    loading: true,
    running: false,
    selectedToolId: null,
    tools: [],
    featuredTools: [],
    recentOutputs: [],
    history: [],
    pendingApprovals: [],
    error: null,
    viewMode: "overview",
  });

  const [conversationId, setConversationId] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const data = await buildDefaultAIWorkspaceData(role);

      setState((prev) => ({
        ...prev,
        loading: false,
        tools: data.tools,
        featuredTools: data.featuredTools,
        recentOutputs: data.recentOutputs,
        history: data.history,
        pendingApprovals: data.pendingApprovals,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load AI workspace.",
      }));
    }
  }, [role]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const setViewMode = useCallback((viewMode: AIWorkspaceViewMode) => {
    setState((prev) => ({ ...prev, viewMode }));
  }, []);

  const selectTool = useCallback((toolId: string | null) => {
    setState((prev) => ({ ...prev, selectedToolId: toolId }));
  }, []);

  const addOutput = useCallback(
    (output: AIWorkspaceOutput) => {
      const historyItem: AIWorkspaceHistoryItem = {
        id: output.id,
        title: output.title,
        description: output.content,
        createdAt: output.createdAt,
        status: output.type === "error" ? "failed" : "success",
        toolId: output.toolId ?? null,
      };

      const approvalItem: AIWorkspaceApprovalItem | null =
        output.requiresApproval
          ? {
              id: output.approvalId || output.id,
              title: output.title,
              description: output.content,
              createdAt: output.createdAt,
              status: "pending",
              requestedBy: context.fullName ?? context.userId,
              toolId: output.toolId ?? null,
            }
          : null;

      setState((prev) => ({
        ...prev,
        recentOutputs: [output, ...prev.recentOutputs].slice(0, 10),
        history: [historyItem, ...prev.history].slice(0, 20),
        pendingApprovals: approvalItem
          ? [approvalItem, ...prev.pendingApprovals]
          : prev.pendingApprovals,
      }));
    },
    [context.fullName, context.userId],
  );

  const runTool = useCallback(
    async (params: {
      toolId: string;
      prompt?: string;
      attachments?: AssistantAttachmentInput[];
      metadata?: Record<string, unknown>;
    }) => {
      setState((prev) => ({ ...prev, running: true, error: null }));

      try {
        const output = await runAIWorkspaceTool({
          context,
          toolId: params.toolId,
          prompt: params.prompt,
          attachments: params.attachments,
          conversationId,
          metadata: params.metadata,
        });

        setConversationId(output.conversationId ?? conversationId);
        addOutput(output);
        setState((prev) => ({ ...prev, running: false }));
        return output;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to run AI workspace tool.";

        setState((prev) => ({
          ...prev,
          running: false,
          error: message,
        }));
        throw error;
      }
    },
    [addOutput, context, conversationId],
  );

  const askAssistant = useCallback(
    async (prompt: string, attachments?: AssistantAttachmentInput[]) => {
      setState((prev) => ({ ...prev, running: true, error: null }));

      try {
        const output = await askAIWorkspaceAssistant({
          context,
          prompt,
          attachments,
          conversationId,
          metadata: {
            currentModule: context.currentModule,
          },
        });

        setConversationId(output.conversationId ?? conversationId);
        addOutput(output);
        setState((prev) => ({ ...prev, running: false }));
        return output;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to ask AI assistant.";

        setState((prev) => ({
          ...prev,
          running: false,
          error: message,
        }));
        throw error;
      }
    },
    [addOutput, context, conversationId],
  );

  const groupedTools = useMemo(() => {
    return state.tools.reduce<Record<string, AIWorkspaceTool[]>>(
      (acc, tool) => {
        if (!acc[tool.category]) acc[tool.category] = [];
        acc[tool.category].push(tool);
        return acc;
      },
      {},
    );
  }, [state.tools]);

  return {
    ...state,
    conversationId,
    groupedTools,
    loadWorkspace,
    setViewMode,
    selectTool,
    runTool,
    askAssistant,
  };
}
