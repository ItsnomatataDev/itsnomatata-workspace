export type AiRouterToolId =
  | "summarize_my_tasks"
  | "list_boards"
  | "create_board_card"
  | "start_time_tracker"
  | "stop_time_tracker"
  | "get_active_time_trackers"
  | "get_user_timesheet"
  | "get_attendance_summary"
  | "get_leave_balance"
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
  "get_leave_balance",
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
  "create_board_card",
  "start_time_tracker",
  "stop_time_tracker",
  "get_active_time_trackers",
  "get_user_timesheet",
  "get_attendance_summary",
  "get_leave_balance",
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

function readableToolValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(readableToolValue).filter(Boolean).join("\n");
  if (!value || typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  for (const key of ["message", "error", "reply", "content", "text", "summary"]) {
    const text = readableToolValue(record[key]);
    if (text) return text;
  }

  const matches = Array.isArray(record.matches) ? record.matches : [];
  if (matches.length > 0) {
    const lines = matches.map((item) => {
      const row = item as Record<string, unknown>;
      return `- ${row.title ?? row.name ?? "Match"}${row.taskId ? ` (${row.taskId})` : ""}`;
    });
    return `More than one match was found:\n${lines.join("\n")}`;
  }

  return JSON.stringify(record);
}

function extractTimerTargetPayload(message: string): Record<string, unknown> {
  const normalized = message.replace(/\s+/g, " ").trim();
  const payload: Record<string, unknown> = {};
  const email = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  if (email) {
    payload.userEmail = email;
    payload.assigneeEmail = email;
  }

  const nameBeforeEmail = normalized.match(
    /\b(?:user|employee|for)\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  );
  if (nameBeforeEmail?.[1]) {
    payload.userName = nameBeforeEmail[1].trim();
    payload.assigneeName = nameBeforeEmail[1].trim();
  }
  const possessiveName = normalized.match(/\b([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2})['’]s\s+(?:timer|time)\b/i);
  if (!payload.userName && possessiveName?.[1]) {
    payload.userName = possessiveName[1].trim();
    payload.assigneeName = possessiveName[1].trim();
  }
  const timerForName = normalized.match(
    /\b(?:timer|time tracker|time tracking|time)\s+for\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})(?=\s+(?:now|on|under|to|and|please|at|$)|[,.?!]|$)/i,
  ) ?? normalized.match(
    /\bfor\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})\s+(?:now|on|under|to|and|please|at|$)/i,
  );
  if (!payload.userName && timerForName?.[1]) {
    payload.userName = timerForName[1].trim();
    payload.assigneeName = timerForName[1].trim();
  }

  const quoted = normalized.match(/["']([^"']{3,160})["']/);
  const afterCard = normalized.match(
    /\b(?:card|task)\s*(?:called|named|is|titled|named)?\s*["']?([^"',?.]{3,160})/i,
  );
  const afterNamed = normalized.match(
    /\bnamed\s+["']?([^"',?.]{3,160})/i,
  );
  const afterOn = normalized.match(
    /\b(?:on|for)\s+(?:this\s+)?(?:card|task)?\s*["']?([^"',?.]{3,160})/i,
  );
  const target = quoted?.[1] ?? afterNamed?.[1] ?? afterCard?.[1] ?? afterOn?.[1] ?? "";
  const cleaned = cleanSearchText(
    target
      .replace(/\b(?:for\s+me|please|now|timer|time|tracking|track|start|begin|his|her|my|their|and|assign|him|to|a|card|task|named)\b/gi, " ")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
      .replace(/\s+/g, " "),
  );

  if (cleaned && !/^this\s+(card|task)$/i.test(cleaned)) {
    payload.taskTitle = cleaned;
    payload.query = cleaned;
  }

  const timeMatch = normalized.match(/\b(?:at|by)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (timeMatch?.[1]) {
    const scheduledFor = getHarareScheduledIso(
      Number(timeMatch[1]),
      Number(timeMatch[2] ?? 0),
      timeMatch[3],
      /\btomorrow\b/i.test(normalized),
    );
    if (scheduledFor) payload.scheduledFor = scheduledFor;
  }

  return payload;
}

function extractBoardCardPayload(message: string): Record<string, unknown> {
  const normalized = message.replace(/\s+/g, " ").trim();
  const timerPayload = extractTimerTargetPayload(normalized);
  const payload: Record<string, unknown> = {
    ...timerPayload,
    startTimer:
      /\b(start|begin|track|tracking)\b.*\b(timer|time tracker|time tracking|time)\b/i.test(normalized) ||
      /\btrack\s+(my|his|her|their)?\s*time\b/i.test(normalized),
  };

  const quoted = normalized.match(/["']([^"']{3,180})["']/);
  const afterNamed = normalized.match(
    /\b(?:card|task)?\s*(?:named|called|titled)\s+["']?([^"',?.]{3,180})/i,
  );
  const afterCreate = normalized.match(
    /\b(?:create|make|add)\s+(?:a\s+)?(?:new\s+)?(?:card|task)\s+["']?([^"',?.]{3,180})/i,
  );
  const rawTitle = quoted?.[1] ?? afterNamed?.[1] ?? afterCreate?.[1] ??
    String(payload.taskTitle ?? "");
  const title = cleanSearchText(
    rawTitle
      .replace(/\b(?:and|then|start|begin|track|tracking|time|timer|time tracker|assign|assigned|for|to|under|on|in|board|please|now)\b.*$/i, " ")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " "),
  );
  if (title) {
    payload.title = title;
    payload.taskTitle = title;
    payload.query = title;
  }

  const boardMatch = normalized.match(
    /\b(?:under|on|in|inside)\s+(?:the\s+)?(?:board|client|project)\s+["']?([^"',?.]{2,120})/i,
  ) ?? normalized.match(/\bboard\s*(?:called|named|is|:)?\s*["']?([^"',?.]{2,120})/i);
  if (boardMatch?.[1]) {
    payload.boardName = cleanSearchText(
      boardMatch[1].replace(/\b(?:and|then|start|track|tracking|assign|for|to)\b.*$/i, " "),
    );
  }

  if (!payload.assigneeEmail && payload.userEmail) payload.assigneeEmail = payload.userEmail;
  if (!payload.assigneeName && payload.userName) payload.assigneeName = payload.userName;

  return payload;
}

function getHarareScheduledIso(
  hourInput: number,
  minuteInput: number,
  meridiem: string | undefined,
  tomorrow: boolean,
) {
  if (!Number.isFinite(hourInput) || !Number.isFinite(minuteInput)) return null;
  let hour = hourInput;
  const minute = Math.max(0, Math.min(59, minuteInput));
  const marker = meridiem?.toLowerCase();
  if (marker === "pm" && hour < 12) hour += 12;
  if (marker === "am" && hour === 12) hour = 0;
  if (hour < 0 || hour > 23) return null;

  const now = new Date();
  const harareNowMs = now.getTime() + 2 * 60 * 60 * 1000;
  const harareNow = new Date(harareNowMs);
  const year = harareNow.getUTCFullYear();
  const month = harareNow.getUTCMonth();
  const day = harareNow.getUTCDate() + (tomorrow ? 1 : 0);
  let scheduledUtc = new Date(Date.UTC(year, month, day, hour - 2, minute, 0, 0));
  if (!tomorrow && scheduledUtc.getTime() <= now.getTime()) {
    scheduledUtc = new Date(scheduledUtc.getTime() + 24 * 60 * 60 * 1000);
  }
  return scheduledUtc.toISOString();
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

  if (/leave\s+(days?|balance|remaining|left|available)|days?\s+(left|remaining|available).*\bleave\b/.test(lower)) {
    return {
      toolId: "get_leave_balance",
      payload: extractTimerTargetPayload(message),
    };
  }

  if (/leave|vacation|time off|absence|pto/.test(lower)) {
    return {
      toolId: "search_leave_requests",
      payload: /pending/.test(lower) ? { status: "pending", daysBack: 120 } : { daysBack: 120 },
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
    /\b(create|make|add)\b.*\b(card|task)\b/.test(lower) ||
    /\b(card|task)\b.*\b(named|called|titled)\b/.test(lower)
  ) {
    return {
      toolId: "create_board_card",
      payload: extractBoardCardPayload(message),
    };
  }

  if (
    /\b(stop|pause|end|finish)\b.*\b(timer|time tracker|time tracking|tracking time)\b/.test(lower) ||
    /\bstop\s+(my\s+)?time\b/.test(lower)
  ) {
    return {
      toolId: "stop_time_tracker",
      payload: {
        ...extractTimerTargetPayload(message),
        notifyUser: /message|notify|tell|send/i.test(lower),
        notificationMessage: /start tracking time again|start.*timer.*again/i.test(lower)
          ? "Please start tracking time again on the correct task."
          : undefined,
      },
    };
  }

  if (
    /\b(start|begin|track|trac|tracking)\b.*\b(timer|time tracker|time tracking|tracking time|time)\b/.test(lower) ||
    /\btrac?k(?:ing)?\s+(my|his|her|their)?\s*time\b/.test(lower)
  ) {
    return {
      toolId: "start_time_tracker",
      payload: extractTimerTargetPayload(message),
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
    case "start_time_tracker": {
      if (data.ok === false) {
        return readableToolValue(data.error || data) || "I could not start the timer.";
      }
      if (data.scheduled === true) {
        return typeof data.message === "string"
          ? data.message
          : "Scheduled the time tracker.";
      }
      const entry = data.entry && typeof data.entry === "object"
        ? data.entry as Record<string, unknown>
        : {};
      const target = entry.task_id ? " on that card" : "";
      const link = typeof data.actionUrl === "string" ? data.actionUrl : null;
      const message = typeof data.message === "string"
        ? data.message
        : `Started your time tracker${target}.`;
      return `${message}${link ? `\n\n[Open card](${link})` : ""}`;
    }
    case "create_board_card": {
      if (data.ok === false) {
        return readableToolValue(data.error || data) || "I could not create that card.";
      }
      const message = typeof data.message === "string"
        ? data.message
        : "Created the card.";
      const actionUrl = typeof data.actionUrl === "string" ? data.actionUrl : null;
      const timer = data.timer && typeof data.timer === "object"
        ? data.timer as Record<string, unknown>
        : null;
      const timerLine = timer?.ok === false
        ? `\n\nTimer was not started: ${readableToolValue(timer.error) || "unknown error"}.`
        : timer?.message
        ? `\n\n${timer.message}`
        : "";
      return `${message}${actionUrl ? `\n\n[Open card](${actionUrl})` : ""}${timerLine}`;
    }
    case "stop_time_tracker": {
      if (data.ok === false) {
        return readableToolValue(data.error || data) || "I could not stop the timer.";
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
        return `- ${name} is tracking "${task}" on ${board} (${formatHours(row.elapsedSeconds)} so far)${link ? `\n  [Open card](${link})` : ""}`;
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
        `- ${group.taskTitle} on ${group.boardName}: ${formatHours(group.seconds)} across ${group.count} entr${group.count === 1 ? "y" : "ies"}${group.running ? " (still running)" : ""}${group.link ? `\n  [Open card](${group.link})` : ""}`
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
    case "get_leave_balance": {
      if (data.ok === false) {
        return readableToolValue(data.error || data) || "I could not find leave days for that user.";
      }
      const user = data.user && typeof data.user === "object"
        ? data.user as Record<string, unknown>
        : {};
      const balance = data.balance && typeof data.balance === "object"
        ? data.balance as Record<string, unknown>
        : {};
      return `${user.name ?? "This user"} has ${balance.remainingDays ?? "unknown"} leave day(s) remaining out of ${balance.totalDays ?? "unknown"}. Used: ${balance.usedDays ?? "unknown"}.`;
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
      const officeFilter = data.officeFilter && typeof data.officeFilter === "object"
        ? data.officeFilter as Record<string, unknown>
        : null;
      const lines = requests.slice(0, 10).map((item) => {
        const row = item as Record<string, unknown>;
        const details = [
          row.office ? `office: ${row.office}` : null,
          row.leaveType ? `type: ${row.leaveType}` : null,
          row.requestedDays ? `${row.requestedDays} day(s)` : null,
          row.rejectionReason ? `reason: ${row.rejectionReason}` : null,
        ].filter(Boolean).join(", ");
        return `- ${row.name ?? "Employee"}: ${row.startDate ?? "?"} to ${row.endDate ?? "?"} (${row.status ?? "unknown"}${details ? `, ${details}` : ""})`;
      }).join("\n");
      return `Found ${requests.length} leave request(s)${
        officeFilter?.name ? ` for ${officeFilter.name}` : ""
      }:\n\n${lines}`;
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
