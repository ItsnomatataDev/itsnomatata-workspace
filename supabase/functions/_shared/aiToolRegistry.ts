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

function cleanSearchText(value: string) {
  return value
    .replace(/^["'\s]+|["'\s.,?!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAssetPayload(message: string): Record<string, unknown> {
  const lower = message.toLowerCase();
  const normalized = message.replace(/\s+/g, " ").trim();
  const payload: Record<string, unknown> = { limit: 10 };

  const namedMatch = normalized.match(
    /\b(?:named|called|name is|asset name is)\s+["']?([^"',?.]+)["']?/i,
  );
  const tagMatch = normalized.match(
    /\b(?:tag|asset tag)\s*(?:is|=|:)?\s*["']?([a-z0-9._-]+)["']?/i,
  );
  const serialMatch = normalized.match(
    /\b(?:serial|serial number)\s*(?:is|=|:)?\s*["']?([a-z0-9._-]+)["']?/i,
  );
  const brandMatch = normalized.match(
    /\bbrand\s*(?:is|=|:)?\s*["']?([^"',?.]+)["']?/i,
  );
  const modelMatch = normalized.match(
    /\bmodel\s*(?:is|=|:)?\s*["']?([^"',?.]+)["']?/i,
  );

  if (namedMatch?.[1]) payload.query = cleanSearchText(namedMatch[1]);
  if (tagMatch?.[1]) payload.assetTag = cleanSearchText(tagMatch[1]);
  if (serialMatch?.[1]) payload.serialNumber = cleanSearchText(serialMatch[1]);
  if (brandMatch?.[1]) payload.brand = cleanSearchText(brandMatch[1]);
  if (modelMatch?.[1]) payload.model = cleanSearchText(modelMatch[1]);

  if (/\b(in stock|available|active)\b/.test(lower)) payload.status = "available";
  if (/\b(assigned|allocated)\b/.test(lower)) payload.status = "assigned";
  if (/\b(repair|maintenance|broken)\b/.test(lower)) payload.status = "maintenance";

  if (!payload.query && !payload.assetTag && !payload.serialNumber) {
    const stripped = normalized
      .replace(/\b(show|list|find|search|any|all|the|assets?|equipment|stock|named|called|with|that|are|is|please)\b/gi, " ")
      .replace(/\b(in stock|available|active|assigned|allocated|repair|maintenance|broken)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (stripped) payload.query = cleanSearchText(stripped);
  }

  return payload;
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
    return { toolId: "search_assets", payload: extractAssetPayload(message) };
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
      const lines = boards
        .map((board) => {
          const row = board as Record<string, unknown>;
          return `- ${row.name ?? "Board"}${row.status ? ` (${row.status})` : ""}${row.id ? `\n  Open board: /boards/${row.id}` : ""}`;
        })
        .join("\n");
      return `I found ${boards.length} board${boards.length === 1 ? "" : "s"}:\n\n${lines}`;
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
      const records = Array.isArray(data.records) ? data.records : [];
      const counts = data.counts as Record<string, unknown> | undefined;
      const countLine = counts
        ? Object.entries(counts).map(([status, count]) => `${status}: ${count}`).join(", ")
        : "";
      if (records.length === 0) return "I could not find attendance records for that period.";
      const lines = records.slice(0, 10).map((item) => {
        const row = item as Record<string, unknown>;
        return `- ${row.name ?? "Team member"}: ${row.status ?? "unknown"} on ${row.date ?? "unknown date"}`;
      }).join("\n");
      return `Attendance summary${countLine ? ` (${countLine})` : ""}.\n\n${lines}`;
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
      const filters = data.filters as Record<string, unknown> | undefined;
      const filterLabel = [
        filters?.query,
        filters?.assetTag ? `tag ${filters.assetTag}` : null,
        filters?.serialNumber ? `serial ${filters.serialNumber}` : null,
        filters?.brand ? `brand ${filters.brand}` : null,
        filters?.model ? `model ${filters.model}` : null,
        filters?.status ? `status ${filters.status}` : null,
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
    default:
      return typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : "I found matching workspace data, but there is no readable summary available yet.";
  }
}
