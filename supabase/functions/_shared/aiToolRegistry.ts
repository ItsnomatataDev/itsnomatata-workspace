export type AiRouterToolId =
  | "summarize_my_tasks"
  | "list_boards"
  | "get_active_time_trackers"
  | "get_user_timesheet"
  | "get_attendance_summary"
  | "search_leave_requests"
  | "search_meetings"
  | "search_notifications"
  | "search_assets"
  | "search_reports"
  | "search_employee_documents"
  | "search_social_posts"
  | "search_fleet_service_needs"
  | "list_available_documents"
  | "search_documents"
  | "get_document";

export const READ_ONLY_AI_TOOLS = new Set<AiRouterToolId>([
  "summarize_my_tasks",
  "list_boards",
  "get_active_time_trackers",
  "get_user_timesheet",
  "get_attendance_summary",
  "search_leave_requests",
  "search_meetings",
  "search_notifications",
  "search_assets",
  "search_reports",
  "search_employee_documents",
  "search_social_posts",
  "search_fleet_service_needs",
  "list_available_documents",
  "search_documents",
  "get_document",
]);

export const CODEX_DELEGATED_TOOLS = new Set<AiRouterToolId>([
  "summarize_my_tasks",
  "list_boards",
  "get_active_time_trackers",
  "get_user_timesheet",
  "get_attendance_summary",
  "search_leave_requests",
  "search_meetings",
  "search_notifications",
  "search_assets",
  "search_reports",
  "search_employee_documents",
  "search_social_posts",
  "search_fleet_service_needs",
  "list_available_documents",
  "search_documents",
  "get_document",
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

  if (/fleet|vehicle|service|maintenance|odometer/.test(lower)) {
    return {
      toolId: "search_fleet_service_needs",
      payload: { horizon_days: /month|30/.test(lower) ? 30 : 14, limit: 20 },
    };
  }

  if (/meeting|calendar|call|schedule/.test(lower)) {
    return {
      toolId: "search_meetings",
      payload: /today/.test(lower) ? { from: today, to: today, limit: 15 } : { daysBack: 7, limit: 20 },
    };
  }

  if (/leave|vacation|time off|absence|pto/.test(lower)) {
    return {
      toolId: "search_leave_requests",
      payload: /pending/.test(lower) ? { status: "pending", daysBack: 30 } : { daysBack: 30 },
    };
  }

  if (/report|operational report|weekly report|monthly report/.test(lower)) {
    return {
      toolId: "search_reports",
      payload: { daysBack: /month|monthly/.test(lower) ? 30 : 90, limit: 15 },
    };
  }

  if (/what documents|documents do you know|list documents|available documents|known documents/.test(lower)) {
    return {
      toolId: "list_available_documents",
      payload: { limit: 50 },
    };
  }

  if (/document|knowledge base|policy|sop|file|uploaded|leave policy|payslip|contract|letter/.test(lower)) {
    return {
      toolId: "search_documents",
      payload: { query: message, limit: 8 },
    };
  }

  if (/social|post|caption|instagram|facebook|linkedin|tiktok|scheduled post/.test(lower)) {
    return {
      toolId: "search_social_posts",
      payload: { status: /scheduled/.test(lower) ? "scheduled" : undefined, limit: 15 },
    };
  }

  if (
    /not\s+tracking|isn'?t\s+tracking|aren'?t\s+tracking|not\s+on\s+(a\s+)?timer|who\s+is\s+not\s+tracking|who\s+isn'?t\s+tracking/.test(
      lower,
    )
  ) {
    return {
      toolId: "get_active_time_trackers",
      payload: {
        scope: /\b(i|me|my|mine|am i)\b/.test(lower) ? "me" : "team",
        includeNotTracking: true,
        mode: "not_tracking",
      },
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
      "- Show leave requests, meetings, reports, documents, social posts, or fleet service needs",
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
      const notTracking = Array.isArray(data.notTracking)
        ? data.notTracking
        : [];
      const wantsNotTracking = Number(data.notTrackingCount ?? 0) > 0 ||
        notTracking.length > 0 ||
        data.notTrackingCount === 0 && data.peopleCount !== undefined;
      if (trackers.length === 0 && !wantsNotTracking) {
        return "No active time trackers right now.";
      }
      const lines = trackers.map((entry) => {
        const row = entry as Record<string, unknown>;
        const name = row.name ?? row.user_name ?? "Someone";
        const task = row.taskTitle ?? row.task_title ?? row.description ?? "Untitled task";
        const board = row.boardName ?? "No board";
        const link = taskLink(row.boardId, row.taskId);
        return `- ${name} is tracking "${task}" on ${board} (${formatHours(row.elapsedSeconds)} so far)${link ? `\n  Open task: ${link}` : ""}`;
      });
      if (wantsNotTracking) {
        const missingLines = notTracking.map((entry) => {
          const row = entry as Record<string, unknown>;
          const detail = [row.department, row.role].filter(Boolean).join(" - ");
          return `- ${row.name ?? "Unknown user"}${row.email ? ` — ${row.email}` : ""}${detail ? ` (${detail})` : ""}`;
        });
        return [
          `${Number(data.activeCount ?? trackers.length)} user(s) are tracking time. ${Number(data.notTrackingCount ?? notTracking.length)} user(s) are not tracking.`,
          lines.length ? `\nTracking now:\n${lines.join("\n")}` : "\nTracking now:\nNo active timers.",
          missingLines.length
            ? `\nNot tracking:\n${missingLines.join("\n")}`
            : "\nNot tracking:\nEveryone in scope is tracking time.",
        ].join("\n");
      }
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
    case "search_leave_requests": {
      const requests = Array.isArray(data.requests) ? data.requests : [];
      if (requests.length === 0) return "No matching leave requests found.";
      const lines = requests.slice(0, 10).map((item) => {
        const row = item as Record<string, unknown>;
        return `- ${row.name ?? "Employee"}: ${row.startDate ?? "?"} to ${row.endDate ?? "?"} (${row.status ?? "unknown"})`;
      }).join("\n");
      return `Found ${requests.length} leave request(s):\n\n${lines}`;
    }
    case "search_meetings": {
      const meetings = Array.isArray(data.meetings) ? data.meetings : [];
      if (meetings.length === 0) return "No matching meetings found.";
      const lines = meetings.slice(0, 10).map((item) => {
        const row = item as Record<string, unknown>;
        return `- ${row.title ?? "Meeting"} with ${row.hostName ?? "unknown host"} at ${formatDateTime(row.scheduledStart)}`;
      }).join("\n");
      return `Found ${meetings.length} meeting(s):\n\n${lines}`;
    }
    case "search_reports": {
      const reports = Array.isArray(data.reports) ? data.reports : [];
      if (reports.length === 0) return "No matching reports found.";
      const lines = reports.slice(0, 10).map((item) => {
        const row = item as Record<string, unknown>;
        return `- ${row.title ?? "Report"} (${row.status ?? "unknown"})${row.clientName ? ` for ${row.clientName}` : ""}`;
      }).join("\n");
      return `Found ${reports.length} report(s):\n\n${lines}`;
    }
    case "search_employee_documents": {
      const documents = Array.isArray(data.documents) ? data.documents : [];
      if (documents.length === 0) return "No matching employee documents found.";
      const lines = documents.slice(0, 10).map((item) => {
        const row = item as Record<string, unknown>;
        return `- ${row.title ?? row.fileName ?? "Document"} (${row.documentType ?? "document"})`;
      }).join("\n");
      return `Found ${documents.length} employee document(s):\n\n${lines}`;
    }
    case "search_social_posts": {
      const posts = Array.isArray(data.posts) ? data.posts : [];
      if (posts.length === 0) return "No matching social posts found.";
      const lines = posts.slice(0, 10).map((item) => {
        const row = item as Record<string, unknown>;
        return `- ${row.title ?? "Post"} on ${row.platform ?? "platform"} (${row.status ?? "unknown"})`;
      }).join("\n");
      return `Found ${posts.length} social post(s):\n\n${lines}`;
    }
    case "search_fleet_service_needs": {
      const serviceNeeds = Array.isArray(data.serviceNeeds) ? data.serviceNeeds : [];
      if (serviceNeeds.length === 0) return "No fleet service needs found in that window.";
      const lines = serviceNeeds.slice(0, 10).map((item) => {
        const row = item as Record<string, unknown>;
        return `- ${row.vehicleName ?? row.registrationNumber ?? "Vehicle"}: ${row.serviceType ?? "service"} due ${row.nextServiceDate ?? "soon"}`;
      }).join("\n");
      return `Found ${serviceNeeds.length} fleet service need(s):\n\n${lines}`;
    }
    case "list_available_documents": {
      const documents = Array.isArray(data.documents) ? data.documents : [];
      if (documents.length === 0) return "I do not have indexed internal documents yet.";
      const lines = documents.slice(0, 20).map((item) => {
        const row = item as Record<string, unknown>;
        return `- ${row.name ?? "Document"} (${row.type ?? "document"})`;
      }).join("\n");
      return `I know about ${documents.length} indexed document(s):\n\n${lines}`;
    }
    case "search_documents": {
      const results = Array.isArray(data.results) ? data.results : [];
      if (results.length === 0) return "No indexed internal documents matched that search.";
      const lines = results.slice(0, 8).map((item) => {
        const row = item as Record<string, unknown>;
        return `- ${row.name ?? "Document"} (${row.type ?? "document"})\n  ${row.snippet ?? ""}`;
      }).join("\n");
      return `Found ${results.length} internal document result(s):\n\n${lines}`;
    }
    case "get_document": {
      const document = data.document as Record<string, unknown> | undefined;
      const summary = data.summary as Record<string, unknown> | undefined;
      if (!document) return "I could not load that document.";
      return [
        `Document: ${document.name ?? "Untitled"} (${document.type ?? "document"})`,
        summary?.short ? `Summary: ${summary.short}` : "",
        data.content ? `Content preview:\n${String(data.content).slice(0, 1800)}` : "",
      ].filter(Boolean).join("\n\n");
    }
    default:
      return typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : "I found matching workspace data, but there is no readable summary available yet.";
  }
}
