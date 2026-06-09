import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { askAssistant } from "../../../lib/api/ai";
import { useOrganizationFeatures } from "../../../lib/hooks/useOrganizationFeatures";
import {
  buildAiRouterContext,
  canShowFloatingAiAssistant,
} from "../services/aiPermissionContext";
import { sendAiRouterMessage } from "../services/aiRouterClient";
import { runAiToolFallback } from "../tools";
import type { AiRouterMessage, AiRouterToolId } from "../types/aiToolTypes";

function createMessageId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringifyAssistantValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyAssistantValue(item))
      .filter(Boolean)
      .join("\n");
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
    const text = stringifyAssistantValue(value[key]);
    if (text) return text;
  }

  const dataText = isRecord(value.data)
    ? stringifyAssistantValue(value.data)
    : "";
  if (dataText) return dataText;

  return JSON.stringify(value, null, 2);
}

function formatHours(seconds: unknown) {
  const value = Number(seconds ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0h";
  if (value < 3600) return `${Math.max(1, Math.round(value / 60))}m`;
  const hours = value / 3600;
  return `${hours.toFixed(hours >= 10 ? 1 : 2)}h`;
}

function taskLink(boardId: unknown, taskId: unknown) {
  if (typeof boardId === "string" && typeof taskId === "string") {
    return `/boards/${boardId}?cardId=${taskId}`;
  }
  if (typeof taskId === "string") return `/tasks/${taskId}`;
  return null;
}

function formatTimeToolReply(toolId: AiRouterToolId, data: Record<string, unknown>) {
  if (toolId === "get_active_time_trackers") {
    const trackers = Array.isArray(data.trackers) ? data.trackers : [];
    if (trackers.length === 0) return "You are not currently tracking time on any task.";

    const lines = trackers.map((entry) => {
      const row = entry as Record<string, unknown>;
      const task = row.taskTitle ?? row.description ?? "Untitled task";
      const board = row.boardName ?? "No board";
      const link = typeof row.taskUrl === "string"
        ? row.taskUrl
        : taskLink(row.boardId, row.taskId);
      return `- ${task} on ${board}: ${formatHours(row.elapsedSeconds)} so far${link ? `\n  Open task: ${link}` : ""}`;
    });

    return `Here is what you are tracking right now:\n\n${lines.join("\n")}`;
  }

  if (toolId === "get_user_timesheet") {
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const user = isRecord(data.user) ? data.user : null;
    const name = typeof user?.name === "string" ? user.name : "You";
    const totalSeconds = Number(data.totalSeconds ?? 0);

    if (entries.length === 0) {
      return `${name} has no tracked time for that period.`;
    }

    const groups = new Map<string, {
      task: string;
      board: string;
      seconds: number;
      count: number;
      link: string | null;
      running: boolean;
    }>();

    for (const entry of entries) {
      const row = entry as Record<string, unknown>;
      const key = `${row.boardId ?? "no-board"}:${row.taskId ?? row.description ?? "no-task"}`;
      const current = groups.get(key) ?? {
        task: String(row.taskTitle ?? row.description ?? "Untitled task"),
        board: String(row.boardName ?? "No board"),
        seconds: 0,
        count: 0,
        link: typeof row.taskUrl === "string" ? row.taskUrl : taskLink(row.boardId, row.taskId),
        running: false,
      };
      current.seconds += Number(row.durationSeconds ?? 0);
      current.count += 1;
      current.running = current.running || row.isRunning === true;
      groups.set(key, current);
    }

    const lines = [...groups.values()]
      .sort((a, b) => b.seconds - a.seconds)
      .map((group) =>
        `- ${group.task} on ${group.board}: ${formatHours(group.seconds)} across ${group.count} entr${group.count === 1 ? "y" : "ies"}${group.running ? " (still running)" : ""}${group.link ? `\n  Open task: ${group.link}` : ""}`
      );

    return `${name} tracked ${formatHours(totalSeconds)}.\n\n${lines.join("\n")}`;
  }

  return "";
}

export function useFloatingAiAssistant() {
  const auth = useAuth();
  const { isEnabled, loading: featuresLoading } = useOrganizationFeatures();
  const [currentRoute, setCurrentRoute] = useState(
    () => window.location.pathname,
  );
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiRouterMessage[]>([]);
  const [error, setError] = useState("");

  const profile = auth?.profile ?? null;
  const visible = useMemo(
    () =>
      canShowFloatingAiAssistant({
        isAuthenticated: Boolean(auth?.user),
        role: profile?.primary_role,
        aiWorkspaceEnabled: isEnabled("ai_workspace"),
      }),
    [auth?.user, isEnabled, profile?.primary_role],
  );

  useEffect(() => {
    const syncRoute = () => setCurrentRoute(window.location.pathname);
    window.addEventListener("popstate", syncRoute);
    const intervalId = window.setInterval(syncRoute, 1000);
    return () => {
      window.removeEventListener("popstate", syncRoute);
      window.clearInterval(intervalId);
    };
  }, []);

  const context = useMemo(
    () =>
      buildAiRouterContext(profile, {
        currentRoute,
      }),
    [currentRoute, profile],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !context || busy) return;

      const userMessage: AiRouterMessage = {
        id: createMessageId("user"),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      setMessages((current) => [...current, userMessage]);
      setBusy(true);
      setError("");

      try {
        const routerTool = detectFallbackTool(trimmed);
        if (routerTool) {
          const response = await sendAiRouterMessage({
            message: trimmed,
            conversationId,
            context,
          });

          setConversationId(response.conversationId);
          setMessages((current) => [
            ...current,
            {
              id: response.messageId,
              role: "assistant",
              content:
                formatTimeToolReply(response.toolId ?? routerTool, response.data ?? {}) ||
                stringifyAssistantValue(response.reply),
              createdAt: new Date().toISOString(),
              toolId: response.toolId ?? null,
              data: response.data,
            },
          ]);
          return;
        }

        const response = await askAssistant({
          message: trimmed,
          conversationId,
          context: {
            userId: context.userId,
            organizationId: context.organizationId,
            fullName: context.fullName,
            role: context.role,
            department: context.department,
            currentRoute: context.currentRoute,
            currentModule: context.currentModule ?? "floating_ai",
            channel: "web",
            timezone: "Africa/Harare",
          },
          metadata: {
            source: "floating_ai_assistant",
            route: context.currentRoute,
          },
        });

        setConversationId(response.conversationId ?? conversationId);
        setMessages((current) => [
          ...current,
          {
            id: response.requestId ?? createMessageId("assistant"),
            role: "assistant",
            content: stringifyAssistantValue(response.message || response.raw),
            createdAt: new Date().toISOString(),
            toolId: null,
            data: response.data,
          },
        ]);
      } catch (assistantError) {
        try {
          const response = await sendAiRouterMessage({
            message: trimmed,
            conversationId,
            context,
          });

          setConversationId(response.conversationId);
          setMessages((current) => [
            ...current,
            {
              id: response.messageId,
              role: "assistant",
              content: stringifyAssistantValue(response.reply),
              createdAt: new Date().toISOString(),
              toolId: response.toolId ?? null,
              data: response.data,
            },
          ]);
        } catch (routerError) {
          try {
            const fallbackTool = detectFallbackTool(trimmed);
            if (!fallbackTool) throw routerError;

            const data = await runAiToolFallback(fallbackTool, context);
            setMessages((current) => [
              ...current,
              {
                id: createMessageId("assistant"),
                role: "assistant",
                content: formatFallbackReply(fallbackTool, data),
                createdAt: new Date().toISOString(),
                toolId: fallbackTool,
                data,
              },
            ]);
          } catch (fallbackError) {
            const message =
              fallbackError instanceof Error
                ? fallbackError.message
                : assistantError instanceof Error
                  ? assistantError.message
                  : routerError instanceof Error
                    ? routerError.message
                    : "AI assistant is unavailable.";
            setError(message);
            setMessages((current) => [
              ...current,
              {
                id: createMessageId("assistant"),
                role: "assistant",
                content: message,
                createdAt: new Date().toISOString(),
                error: true,
              },
            ]);
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, context, conversationId],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError("");
  }, []);

  return {
    visible: visible && !featuresLoading,
    open,
    setOpen,
    busy,
    messages,
    error,
    sendMessage,
    reset,
    context,
  };
}

function detectFallbackTool(message: string): AiRouterToolId | null {
  const lower = message.toLowerCase();
  if (/notification|inbox|alert/.test(lower)) return "search_notifications";
  if (/asset|equipment|serial|stock/.test(lower)) return "search_assets";
  if (/tracking\s+time|time\s+tracking|timer|tracking now|active time|currently tracking|which tasks?.*(tracking|timer)|what tasks?.*(tracking|timer)/.test(lower)) return "get_active_time_trackers";
  if (/timesheet|time entr|hours|tracked|time tracked|tracked time|worked on/.test(lower)) return "get_user_timesheet";
  if (/board/.test(lower)) return "list_boards";
  if (/attendance|clock/.test(lower)) return "get_attendance_summary";
  if (/task|todo|card/.test(lower)) return "summarize_my_tasks";
  return null;
}

function formatFallbackReply(
  toolId: AiRouterToolId,
  data: Record<string, unknown>,
): string {
  const timeReply = formatTimeToolReply(toolId, data);
  if (timeReply) return timeReply;

  return `I pulled this from your workspace (${toolId}):\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}
