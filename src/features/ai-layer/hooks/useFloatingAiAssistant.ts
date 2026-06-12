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
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^[{\[]/.test(trimmed)) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        const parsedText = stringifyAssistantValue(parsed);
        if (parsedText && parsedText !== trimmed) return parsedText;
      } catch {

      }
    }
    return trimmed;
  }
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

  const readableEntries = Object.entries(value)
    .filter(([, nested]) =>
      typeof nested === "string" ||
      typeof nested === "number" ||
      typeof nested === "boolean"
    )
    .map(([key, nested]) => `${key}: ${nested}`);

  return readableEntries.length > 0
    ? readableEntries.join("\n")
    : "I got a response, but it did not include readable text.";
}

function readableToolValue(value: unknown): string {
  const text = stringifyAssistantValue(value);
  if (text && text !== "[object Object]") return text;
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "";
    }
  }
  return "";
}

function formatHours(seconds: unknown) {
  const value = Number(seconds ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0h";
  if (value < 3600) return `${Math.max(1, Math.round(value / 60))}m`;
  const hours = value / 3600;
  return `${hours.toFixed(hours >= 10 ? 1 : 2)}h`;
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Harare",
  });
}

function formatAttendanceRecord(row: Record<string, unknown>) {
  const clockIn = row.clockInAt ?? row.actualClockInAt;
  const clockOut = row.clockOutAt ?? row.actualClockOutAt;
  return [
    `- ${row.name ?? "Team member"}`,
    `  Office: ${row.office ?? row.profileOffice ?? "Unknown"}`,
    `  Clock in: ${clockIn ? formatDateTime(clockIn) : "Not clocked in"}`,
    `  Clock out: ${clockOut ? formatDateTime(clockOut) : "Not clocked out"}`,
    `  Status: ${row.status ?? "unknown"}`,
  ].join("\n");
}

function taskLink(boardId: unknown, taskId: unknown) {
  if (typeof boardId === "string" && typeof taskId === "string") {
    return `/boards/${boardId}?cardId=${taskId}`;
  }

  return null;
}

function formatTimeToolReply(toolId: AiRouterToolId, data: Record<string, unknown>) {
  if (toolId === "get_active_time_trackers") {
    const trackers = Array.isArray(data.trackers) ? data.trackers : [];
    if (trackers.length === 0) return "You are not currently tracking time on any card.";

    const lines = trackers.map((entry) => {
      const row = entry as Record<string, unknown>;
      const task = row.taskTitle ?? row.description ?? "Untitled card";
      const board = row.boardName ?? "No board";
      const link = typeof row.taskUrl === "string"
        ? row.taskUrl
        : taskLink(row.boardId, row.taskId);
      return `- ${task} on ${board}: ${formatHours(row.elapsedSeconds)} so far${link ? `\n  Open card: ${link}` : ""}`;
    });

    return `Here is what you are tracking right now:\n\n${lines.join("\n")}`;
  }

  if (toolId === "start_time_tracker") {
    if (data.ok === false) {
      return readableToolValue(data.error || data) || "I could not start your time tracker.";
    }
    if (data.scheduled === true) {
      return typeof data.message === "string"
        ? data.message
        : "Scheduled the time tracker.";
    }
    const link = typeof data.actionUrl === "string" ? data.actionUrl : null;
    const message = typeof data.message === "string"
      ? data.message
      : "Started your time tracker.";
    return `${message}${link ? `\n\nOpen card: ${link}` : ""}`;
  }

  if (toolId === "create_board_card") {
    if (data.ok === false) {
      return readableToolValue(data.error || data) || "I could not create that card.";
    }
    const link = typeof data.actionUrl === "string" ? data.actionUrl : null;
    const timer = isRecord(data.timer) ? data.timer : null;
    const message = typeof data.message === "string"
      ? data.message
      : "Created the card.";
    const timerLine = timer?.ok === false
      ? `\n\nTimer was not started: ${readableToolValue(timer.error)}.`
      : timer?.message
      ? `\n\n${timer.message}`
      : "";
    return `${message}${link ? `\n\nOpen card: ${link}` : ""}${timerLine}`;
  }

  if (toolId === "stop_time_tracker") {
    if (data.ok === false) {
      return readableToolValue(data.error || data) || "I could not stop your time tracker.";
    }
    const message = typeof data.message === "string"
      ? data.message
      : "Stopped the time tracker.";
    return `${message}${
      data.durationSeconds !== undefined
        ? ` Total tracked: ${formatHours(data.durationSeconds)}.`
        : ""
    }`;
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
        `- ${group.task} on ${group.board}: ${formatHours(group.seconds)} across ${group.count} entr${group.count === 1 ? "y" : "ies"}${group.running ? " (still running)" : ""}${group.link ? `\n  open card: ${group.link}` : ""}`
      );

    return `${name} tracked ${formatHours(totalSeconds)}.\n\n${lines.join("\n")}`;
  }

  return "";
}

function formatAssetToolReply(data: Record<string, unknown>) {
  const assets = Array.isArray(data.assets) ? data.assets : [];
  const filters = isRecord(data.filters) ? data.filters : {};
  const filterLabel = [
    filters.query,
    filters.assetTag ? `tag ${filters.assetTag}` : null,
    filters.serialNumber ? `serial ${filters.serialNumber}` : null,
    filters.brand ? `brand ${filters.brand}` : null,
    filters.model ? `model ${filters.model}` : null,
    filters.status ? `status ${filters.status}` : null,
  ].filter(Boolean).join(", ");

  if (assets.length === 0) {
    return filterLabel
      ? `I could not find any assets matching ${filterLabel}.`
      : "I could not find any assets.";
  }

  const lines = assets.map((item) => {
    const row = item as Record<string, unknown>;
    const name = row.assetName ?? row.asset_name ?? row.name ?? "Asset";
    const details = [
      row.assetTag ? `tag ${row.assetTag}` : null,
      row.serialNumber ? `serial ${row.serialNumber}` : null,
      row.brand || row.model ? `${row.brand ?? ""} ${row.model ?? ""}`.trim() : null,
      row.status ? `status ${row.status}` : null,
      row.condition ? `condition ${row.condition}` : null,
    ].filter(Boolean).join(", ");

    return `- ${name}${details ? ` (${details})` : ""}${row.assetUrl ? `\n  Open asset: ${row.assetUrl}` : ""}`;
  });

  return `I found ${assets.length} asset${assets.length === 1 ? "" : "s"}${filterLabel ? ` matching ${filterLabel}` : ""}:\n\n${lines.join("\n")}`;
}

function formatWorkspaceToolReply(
  toolId: AiRouterToolId | null | undefined,
  data: Record<string, unknown> | undefined,
) {
  if (!toolId || !data) return "";

  const timeReply = formatTimeToolReply(toolId, data);
  if (timeReply) return timeReply;
  if (toolId === "search_assets") return formatAssetToolReply(data);

  if (toolId === "search_leave_requests") {
    const requests = Array.isArray(data.requests) ? data.requests : [];
    if (requests.length === 0) return "No matching leave requests found.";

    const lines = requests.slice(0, 10).map((item) => {
      const row = item as Record<string, unknown>;
      const details = [
        row.office ? `office: ${row.office}` : null,
        row.leaveType ? `type: ${row.leaveType}` : null,
        row.requestedDays ? `${row.requestedDays} day(s)` : null,
        row.rejectionReason ? `reason: ${row.rejectionReason}` : null,
      ].filter(Boolean).join(", ");
      return `- ${row.name ?? "Employee"}: ${row.startDate ?? "?"} to ${row.endDate ?? "?"} (${row.status ?? "unknown"}${details ? `, ${details}` : ""})`;
    });

    return `Found ${requests.length} leave request${requests.length === 1 ? "" : "s"}:\n\n${lines.join("\n")}`;
  }

  if (toolId === "summarize_my_tasks") {
    const openCount = Number(data.openCount ?? 0);
    const overdueCount = Number(data.overdueCount ?? 0);
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];

    if (tasks.length === 0) {
      return "You do not have any open assigned tasks right now.";
    }

    const lines = tasks.slice(0, 10).map((item) => {
      const row = item as Record<string, unknown>;
      const title = row.title ?? "Untitled task";
      const status = row.status ? `, ${row.status}` : "";
      const priority = row.priority ? `, ${row.priority} priority` : "";
      const board = row.boardName ? ` on ${row.boardName}` : "";
      const link = taskLink(row.boardId, row.id ?? row.taskId);
      return `- ${title}${board}${status}${priority}${link ? `\n  Open card: ${link}` : ""}`;
    });

    return `You have ${openCount} open card${openCount === 1 ? "" : "s"}${overdueCount > 0 ? `, with ${overdueCount} overdue` : ""}.\n\n${lines.join("\n")}`;
  }

  if (toolId === "list_boards") {
    const boards = Array.isArray(data.boards) ? data.boards : [];
    if (boards.length === 0) return "I could not find any boards.";

    const lines = boards.slice(0, 12).map((item) => {
      const row = item as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : null;
      return `- ${row.name ?? "Untitled board"}${row.status ? ` (${row.status})` : ""}${id ? `\n  Open board: /boards/${id}` : ""}`;
    });

    return `I found ${boards.length} board${boards.length === 1 ? "" : "s"}:\n\n${lines.join("\n")}`;
  }

  if (toolId === "search_notifications") {
    const notifications = Array.isArray(data.notifications)
      ? data.notifications
      : [];
    if (notifications.length === 0) return "You do not have matching notifications.";

    const lines = notifications.slice(0, 10).map((item) => {
      const row = item as Record<string, unknown>;
      const readLabel = row.is_read ? "read" : "unread";
      return `- ${row.title ?? "Notification"} (${readLabel})${row.message ? `\n  ${row.message}` : ""}${row.action_url ? `\n  Open: ${row.action_url}` : ""}`;
    });

    return `I found ${notifications.length} notification${notifications.length === 1 ? "" : "s"}:\n\n${lines.join("\n")}`;
  }

  if (toolId === "get_attendance_summary") {
    const records = Array.isArray(data.records) ? data.records : [];
    const counts = isRecord(data.counts) ? data.counts : {};
    const countLine = Object.entries(counts)
      .map(([status, count]) => `${status}: ${count}`)
      .join(", ");

    if (records.length === 0) return "No attendance records were found for today.";

    const lines = records.slice(0, 8).map((item) => {
      const row = item as Record<string, unknown>;
      return formatAttendanceRecord(row);
    });

    return `Attendance summary${countLine ? ` (${countLine})` : ""}.\n\n${lines.join("\n")}`;
  }

  if (toolId === "get_leave_balance") {
  if (data.ok === false) {
    return readableToolValue(data.error || data) ||
      "I could not find leave days for that user.";
  }

  const user = isRecord(data.user) ? data.user : {};

  const balance = isRecord(data.balance)
    ? data.balance
    : isRecord(data.data) && isRecord(data.data.balance)
      ? data.data.balance
      : {};

  const remainingDays =
    balance.remainingDays ??
    balance.remaining_days ??
    balance.remaining ??
    null;

  const totalDays =
    balance.totalDays ??
    balance.total_days ??
    balance.total ??
    null;

  const usedDays =
    balance.usedDays ??
    balance.used_days ??
    balance.used ??
    null;

  if (remainingDays === null && totalDays === null && usedDays === null) {
    return "I found the user, but no leave balance was returned.";
  }

  return `${user.name ?? "This user"} has ${remainingDays ?? 0} leave day(s) remaining out of ${totalDays ?? 0}. Used: ${usedDays ?? 0}.`;
}

  const message = typeof data.message === "string" ? data.message.trim() : "";
  return message || "I found matching workspace data, but there is no readable summary available yet.";
}

export function useFloatingAiAssistant() {
  const auth = useAuth();
  const { isEnabled, loading: featuresLoading } = useOrganizationFeatures();
  const [currentRoute, setCurrentRoute] = useState(
    () => `${window.location.pathname}${window.location.search}`,
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
    const syncRoute = () => setCurrentRoute(`${window.location.pathname}${window.location.search}`);
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
          const toolReply =
            formatWorkspaceToolReply(response.toolId ?? routerTool, response.data) ||
            stringifyAssistantValue(response.reply);

          setConversationId(response.conversationId);
          setMessages((current) => [
            ...current,
            {
              id: response.messageId,
              role: "assistant",
              content: toolReply,
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
        const fallbackTool = detectFallbackTool(trimmed);
        if (!fallbackTool) {
          const message = assistantError instanceof Error
            ? assistantError.message
            : "The n8n assistant webhook is unavailable right now.";
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
          return;
        }

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
              content:
                formatWorkspaceToolReply(response.toolId ?? fallbackTool, response.data) ||
                stringifyAssistantValue(response.reply),
              createdAt: new Date().toISOString(),
              toolId: response.toolId ?? null,
              data: response.data,
            },
          ]);
        } catch (routerError) {
          try {
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
  if (/\b(create|make|add)\b.*\b(card|task)\b/.test(lower) || /\b(card|task)\b.*\b(named|called|titled)\b/.test(lower)) return "create_board_card";
  if (/\b(stop|pause|end|finish)\b.*\b(timer|time tracker|time tracking|tracking time)\b/.test(lower) || /\bstop\s+(my\s+)?time\b/.test(lower)) return "stop_time_tracker";
  if (/\b(show|who|which|list|people|users|team)\b.*\b(tracking|timer|time tracker|time tracking)\b/.test(lower)) return "get_active_time_trackers";
  if (/\b(start|begin|track|trac|tracking)\b.*\b(timer|time tracker|time tracking|tracking time|time)\b/.test(lower) || /\btrac?k(?:ing)?\s+(my|his|her|their)?\s*time\b/.test(lower)) return "start_time_tracker";
  if (/leave\s+(days?|balance|remaining|left|available)|days?\s+(left|remaining|available).*\bleave\b/.test(lower)) return "get_leave_balance";
  if (/leave|vacation|time off|absence|pto/.test(lower)) return "search_leave_requests";
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
  return formatWorkspaceToolReply(toolId, data);
}
