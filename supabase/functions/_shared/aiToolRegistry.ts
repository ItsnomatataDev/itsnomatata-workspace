export type AiRouterToolId =
  | "summarize_my_tasks"
  | "list_boards"
  | "get_active_time_trackers"
  | "get_user_timesheet"
  | "get_attendance_summary"
  | "search_notifications"
  | "search_assets";

export const READ_ONLY_AI_TOOLS = new Set<AiRouterToolId>([
  "summarize_my_tasks",
  "list_boards",
  "get_active_time_trackers",
  "get_user_timesheet",
  "get_attendance_summary",
  "search_notifications",
  "search_assets",
]);

export const CODEX_DELEGATED_TOOLS = new Set<AiRouterToolId>([
  "summarize_my_tasks",
  "list_boards",
  "get_active_time_trackers",
  "get_user_timesheet",
  "get_attendance_summary",
  "search_notifications",
  "search_assets",
]);

const AI_ALLOWED_ROLES = new Set([
  "admin",
  "org_admin",
  "super_admin",
  "superadmin",
  "manager",
  "hr",
  "it",
  "it-superadmin",
  "social_media",
  "media_team",
  "seo_specialist",
  "employee",
]);

export function canUseAiRouter(role: string | null | undefined) {
  const normalized = String(role ?? "").toLowerCase();
  return AI_ALLOWED_ROLES.has(normalized);
}

function formatHours(seconds: unknown) {
  const value = Number(seconds ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0h";
  const hours = value / 3600;
  if (hours < 1) return `${Math.max(1, Math.round(value / 60))}m`;
  return `${hours.toFixed(hours >= 10 ? 1 : 2)}h`;
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string" || !value) return "unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Harare",
  });
}

function taskLink(boardId: unknown, taskId: unknown) {
  if (typeof boardId === "string" && typeof taskId === "string") {
    return `/boards/${boardId}?cardId=${taskId}`;
  }
  if (typeof taskId === "string") return `/tasks/${taskId}`;
  return null;
}

function groupTimeEntriesByBoardAndTask(entries: unknown[]) {
  const groups = new Map<string, {
    boardName: string;
    taskTitle: string;
    link: string | null;
    seconds: number;
    running: boolean;
    count: number;
  }>();

  for (const item of entries) {
    const row = item as Record<string, unknown>;
    const boardId = row.boardId;
    const taskId = row.taskId;
    const key = `${String(boardId ?? "no-board")}::${String(taskId ?? row.description ?? "no-task")}`;
    const current = groups.get(key) ?? {
      boardName: String(row.boardName ?? "No board"),
      taskTitle: String(row.taskTitle ?? row.description ?? "Untitled task"),
      link: taskLink(boardId, taskId),
      seconds: 0,
      running: false,
      count: 0,
    };

    current.seconds += Number(row.durationSeconds ?? row.elapsedSeconds ?? 0);
    current.running = current.running || row.isRunning === true;
    current.count += 1;
    groups.set(key, current);
  }

  return [...groups.values()].sort((a, b) => b.seconds - a.seconds);
}

export function detectAiTool(message: string): {
  toolId: AiRouterToolId;
  payload: Record<string, unknown>;
} | null {
  const lower = message.toLowerCase();
  const today = new Date().toISOString().slice(0, 10);

  const timesheetPayload = /today|this day|current day/.test(lower)
    ? { from: today, to: today }
    : /yesterday/.test(lower)
    ? (() => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - 1);
      const value = date.toISOString().slice(0, 10);
      return { from: value, to: value };
    })()
    : { daysBack: 7 };

  if (/notification|inbox|alert/.test(lower)) {
    return {
      toolId: "search_notifications",
      payload: { unreadOnly: /unread/.test(lower), limit: 15 },
    };
  }

  if (
    /tracking\s+time|time\s+tracking|timer|tracking now|active time|currently tracking|which tasks?.*(tracking|timer)|what tasks?.*(tracking|timer)/.test(
      lower,
    )
  ) {
    return {
      toolId: "get_active_time_trackers",
      payload: { scope: /\b(i|me|my|mine|am i)\b/.test(lower) ? "me" : "team" },
    };
  }

  if (
    /timesheet|time entr|hours|tracked|time tracked|tracked time|worked on/.test(
      lower,
    )
  ) {
    return { toolId: "get_user_timesheet", payload: timesheetPayload };
  }

  if (/asset|equipment|serial|stock/.test(lower)) {
    const query = message
      .replace(/search assets?|find assets?|assets?/gi, "")
      .trim();
    return { toolId: "search_assets", payload: { query } };
  }

  if (/board/.test(lower)) {
    return { toolId: "list_boards", payload: {} };
  }

  if (/attendance|clock/.test(lower)) {
    return { toolId: "get_attendance_summary", payload: {} };
  }

  if (/task|todo|card/.test(lower)) {
    return { toolId: "summarize_my_tasks", payload: {} };
  }

  return null;
}

export function formatToolReply(
  toolId: AiRouterToolId | null,
  data: Record<string, unknown>,
): string {
  if (!toolId) {
    return [
      "I can help with read-only workspace lookups:",
      "- Summarize my tasks",
      "- List boards",
      "- Show timesheet or active timers",
      "- Show attendance summary",
      "- Show notifications",
      "- Search assets",
    ].join("\n");
  }

  switch (toolId) {
    case "summarize_my_tasks": {
      const openCount = Number(data.openCount ?? 0);
      const overdueCount = Number(data.overdueCount ?? 0);
      const tasks = Array.isArray(data.tasks) ? data.tasks : [];
      const lines = tasks
        .slice(0, 8)
        .map((task) => {
          const row = task as Record<string, unknown>;
          return `- ${row.title ?? "Untitled"} (${row.status ?? "unknown"})`;
        })
        .join("\n");
      return `You have ${openCount} open task(s), ${overdueCount} overdue.\n\n${lines || "No open tasks found."}`;
    }
    case "list_boards": {
      const boards = Array.isArray(data.boards) ? data.boards : [];
      if (boards.length === 0) return "No boards found for your organization.";
      return boards
        .map((board) => {
          const row = board as Record<string, unknown>;
          return `- ${row.name ?? "Board"} (${row.id})`;
        })
        .join("\n");
    }
    case "get_active_time_trackers": {
      const trackers = Array.isArray(data.trackers) ? data.trackers : [];
      if (trackers.length === 0) return "No active time trackers right now.";
      const lines = trackers.map((entry) => {
        const row = entry as Record<string, unknown>;
        const name = row.name ?? row.user_name ?? "Someone";
        const task = row.taskTitle ?? row.task_title ?? row.description ?? "Untitled task";
        const board = row.boardName ?? "No board";
        const link = taskLink(row.boardId, row.taskId);
        return `- ${name} is tracking "${task}" on ${board} (${formatHours(row.elapsedSeconds)} so far)${link ? `\n  Open task: ${link}` : ""}`;
      });
      return `Here is what is being tracked right now:\n\n${lines.join("\n")}`;
    }
    case "get_user_timesheet": {
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const totalSeconds = Number(data.totalSeconds ?? 0);
      const user = data.user as Record<string, unknown> | undefined;
      const range = data.range as Record<string, unknown> | undefined;
      const grouped = groupTimeEntriesByBoardAndTask(entries);
      const name = user?.name ?? "You";

      if (entries.length === 0) {
        return `${name} has no tracked time in this period.`;
      }

      const lines = grouped.map((group) =>
        `- ${group.taskTitle} on ${group.boardName}: ${formatHours(group.seconds)} across ${group.count} entr${group.count === 1 ? "y" : "ies"}${group.running ? " (still running)" : ""}${group.link ? `\n  Open task: ${group.link}` : ""}`
      );

      const rangeLabel = range?.from && range?.to
        ? ` from ${formatDateTime(range.from).replace(/, 00:00$/, "")} to ${formatDateTime(range.to).replace(/, 23:59$/, "")}`
        : "";

      return `${name} tracked ${formatHours(totalSeconds)}${rangeLabel}.\n\n${lines.join("\n")}`;
    }
    case "get_attendance_summary": {
      const sessions = Array.isArray(data.sessions) ? data.sessions : [];
      return `Attendance summary: ${sessions.length} session(s) in range.`;
    }
    case "search_notifications": {
      const notifications = Array.isArray(data.notifications)
        ? data.notifications
        : [];
      if (notifications.length === 0) return "No notifications found.";
      return notifications
        .map((item) => {
          const row = item as Record<string, unknown>;
          const readLabel = row.is_read ? "read" : "unread";
          return `- [${readLabel}] ${row.title ?? "Notification"}`;
        })
        .join("\n");
    }
    case "search_assets": {
      const assets = Array.isArray(data.assets) ? data.assets : [];
      if (assets.length === 0) return "No assets matched that search.";
      return assets
        .map((item) => {
          const row = item as Record<string, unknown>;
          return `- ${row.asset_name ?? "Asset"} (${row.asset_tag ?? row.serial_number ?? row.id})`;
        })
        .join("\n");
    }
    default:
      return JSON.stringify(data, null, 2);
  }
}
