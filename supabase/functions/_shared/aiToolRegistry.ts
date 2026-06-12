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
  | "search_tasks"
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
  "search_tasks",
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
  "search_tasks",
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

export function canUseAiRouter(role: string | null | undefined): boolean {
  const normalized = String(role ?? "").toLowerCase();
  return AI_ALLOWED_ROLES.has(normalized);
}

function formatHours(seconds: unknown): string {
  const value = Number(seconds ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0h";
  const hours = value / 3600;
  if (hours < 1) return `${Math.max(1, Math.round(value / 60))}m`;
  return `${hours.toFixed(hours >= 10 ? 1 : 2)}h`;
}

function formatDateTime(value: unknown): string {
  if (typeof value !== "string" || !value) return "unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Harare",
  });
}

function todayInHarareRange(): Record<string, unknown> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Harare",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const start = new Date(Date.UTC(year, month - 1, day, -2, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, -2, 0, 0, -1));

  return {
    date,
    from: start.toISOString(),
    to: end.toISOString(),
    timezone: "Africa/Harare",
  };
}

function formatAttendanceRecord(row: Record<string, unknown>): string {
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

function taskLink(boardId: unknown, taskId: unknown): string | null {
  if (typeof boardId === "string" && typeof taskId === "string") {
    return `/boards/${boardId}?cardId=${taskId}`;
  }
  return null;
}

function cleanSearchText(value: string): string {
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

function extractPersonNameForLeave(message: string): string | null {
  const lower = message.toLowerCase();

  if (/\b(my|me|mine|myself)\b/.test(lower)) {
    const hasThirdPartyName = /\b(?:for|check|show)\s+([a-z][a-z.'-]+(?:\s+[a-z][a-z.'-]+){0,2})\b/i.test(message) ||
      /\b[a-z][a-z.'-]+['']s\s+(?:leave|days?|balance)/i.test(lower);
    if (!hasThirdPartyName) return null;
  }

  // SKIP words that are never a person's name in this context
  const SKIP_WORDS = new Set([
    "show", "check", "what", "how", "leave", "balance", "days", "day",
    "remaining", "left", "available", "calculate", "get", "find",
    "tell", "does", "have", "for", "with", "me", "my", "mine",
    "myself", "his", "her", "their", "the", "a", "an", "is", "are",
  ]);

  function isValidName(raw: string): boolean {
    const parts = raw.toLowerCase().split(/\s+/);
    return parts.length >= 1 && parts.every((p) => p.length >= 2 && !SKIP_WORDS.has(p));
  }

  // 1. Possessive: "lizwe's leave" or "Lizwe Masuku's balance"
  const possessive = message.match(
    /\b([A-Za-z][A-Za-z.'-]+(?:\s+[A-Za-z][A-Za-z.'-]+){0,2})['']s\s+(?:leave|days?|balance|remaining|pto|vacation|time\s+off)/i,
  );
  if (possessive?.[1] && isValidName(possessive[1])) {
    // Title-case it for consistent matching downstream
    return possessive[1]
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  // 2. Explicit "for <name>" pattern
  const forName = message.match(
    /\bfor\s+([A-Za-z][A-Za-z.'-]+(?:\s+[A-Za-z][A-Za-z.'-]+){0,2})(?:\s+(?:leave|days?|balance|pto|remaining|vacation|time\s+off)|\?|$)/i,
  );
  if (forName?.[1] && isValidName(forName[1])) {
    return forName[1]
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  // 3. Capitalised proper name anywhere in message (original-case input)
  const properName = message.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/);
  if (properName?.[1] && isValidName(properName[1])) {
    return properName[1];
  }

  return null;
}

function getHarareScheduledIso(
  hourInput: number,
  minuteInput: number,
  meridiem: string | undefined,
  tomorrow: boolean,
): string | null {
  if (!Number.isFinite(hourInput) || !Number.isFinite(minuteInput)) return null;

  let hour = hourInput;
  const minute = Math.max(0, Math.min(59, minuteInput));
  const marker = meridiem?.toLowerCase();

  if (marker === "pm" && hour < 12) hour += 12;
  if (marker === "am" && hour === 12) hour = 0;
  if (hour < 0 || hour > 23) return null;

  const now = new Date();
  const harareNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const year = harareNow.getUTCFullYear();
  const month = harareNow.getUTCMonth();
  const day = harareNow.getUTCDate() + (tomorrow ? 1 : 0);

  let scheduledUtc = new Date(Date.UTC(year, month, day, hour - 2, minute, 0, 0));

  if (!tomorrow && scheduledUtc.getTime() <= now.getTime()) {
    scheduledUtc = new Date(scheduledUtc.getTime() + 24 * 60 * 60 * 1000);
  }

  return scheduledUtc.toISOString();
}

function extractTimerTargetPayload(message: string): Record<string, unknown> {
  const normalized = message.replace(/\s+/g, " ").trim();
  const payload: Record<string, unknown> = {};

  const email = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  if (email) {
    payload.userEmail = email;
    payload.assigneeEmail = email;
  }

  // ── Name patterns (in priority order) ─────────────────────────────────────

  // "name before email": "user John Smith john@..." or "for John Smith john@..."
  const nameBeforeEmail = normalized.match(
    /\b(?:user|employee|for)\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  );

  // "is/for X working/tracking": "is John Smith working"
  const workingName = normalized.match(
    /\b(?:is|for)\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})\s+(?:working|tracking)/i,
  );

  // "John's timer" / "John's time"
  const possessiveName = normalized.match(
    /\b([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2})['']s\s+(?:timer|time)\b/i,
  );

  // "timer for John Smith" / "for John Smith now"
  const timerForName =
    normalized.match(
      /\b(?:timer|time tracker|time tracking|time)\s+for\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})(?=\s+(?:now|on|under|to|and|please|at|$)|[,.?!]|$)/i,
    ) ??
    normalized.match(
      /\bfor\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})\s+(?:now|on|under|to|and|please|at|$)/i,
    );

  const resolvedName =
    nameBeforeEmail?.[1]?.trim() ??
    workingName?.[1]?.trim() ??
    possessiveName?.[1]?.trim() ??
    timerForName?.[1]?.trim() ??
    null;

  if (resolvedName) {
    payload.userName = resolvedName;
    payload.assigneeName = resolvedName;
  }

  const quoted = normalized.match(/["']([^"']{3,160})["']/);
  const afterCard = normalized.match(
    /\b(?:card|task)\s*(?:called|named|is|titled|named)?\s*["']?([^"',?.]{3,160})/i,
  );
  const afterNamed = normalized.match(/\bnamed\s+["']?([^"',?.]{3,160})/i);
  const afterOn = normalized.match(
    /\b(?:on|for)\s+(?:this\s+)?(?:card|task)?\s*["']?([^"',?.]{3,160})/i,
  );

  const rawTarget = quoted?.[1] ?? afterNamed?.[1] ?? afterCard?.[1] ?? afterOn?.[1] ?? "";

  const cleaned = cleanSearchText(
    rawTarget
      .replace(
        /\b(?:for\s+me|please|now|timer|time|tracking|track|start|begin|his|her|my|their|and|assign|him|to|a|card|task|named)\b/gi,
        " ",
      )
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
      .replace(/\s+/g, " "),
  );

  if (cleaned && !/^this\s+(card|task)$/i.test(cleaned)) {
    payload.taskTitle = cleaned;
    payload.query = cleaned;
  }

  const timeMatch = normalized.match(
    /\b(?:at|by)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
  );

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

  const rawTitle =
    quoted?.[1] ?? afterNamed?.[1] ?? afterCreate?.[1] ?? String(payload.taskTitle ?? "");

  const title = cleanSearchText(
    rawTitle
      .replace(
        /\b(?:and|then|start|begin|track|tracking|time|timer|time tracker|assign|assigned|for|to|under|on|in|board|please|now)\b.*$/i,
        " ",
      )
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " "),
  );

  if (title) {
    payload.title = title;
    payload.taskTitle = title;
    payload.query = title;
  }

  const boardMatch =
    normalized.match(
      /\b(?:under|on|in|inside)\s+(?:the\s+)?(?:board|client|project)\s+["']?([^"',?.]{2,120})/i,
    ) ??
    normalized.match(/\bboard\s*(?:called|named|is|:)?\s*["']?([^"',?.]{2,120})/i);

  if (boardMatch?.[1]) {
    payload.boardName = cleanSearchText(
      boardMatch[1].replace(
        /\b(?:and|then|start|track|tracking|assign|for|to)\b.*$/i,
        " ",
      ),
    );
  }

  // Ensure assignee fields are always consistent
  if (!payload.assigneeEmail && payload.userEmail) {
    payload.assigneeEmail = payload.userEmail;
  }
  if (!payload.assigneeName && payload.userName) {
    payload.assigneeName = payload.userName;
  }

  return payload;
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
      .replace(
        /\b(show|list|find|search|any|all|the|assets?|equipment|stock|named|called|with|that|are|is|please)\b/gi,
        " ",
      )
      .replace(
        /\b(in stock|available|active|assigned|allocated|repair|maintenance|broken)\b/gi,
        " ",
      )
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
  const lower = message.toLowerCase().trim();
  const today = new Date().toISOString().slice(0, 10);

  const isSelf =
    /\b(my|me|mine|myself)\b/.test(lower) ||
    /\b(i am|am i|what am i|what i'm|i'm)\b/.test(lower);

  const isPersonalTimerQuery =
    isSelf &&
    (
      /\b(timer|timers|time tracker|time tracking|tracking time|tracking)\b/.test(lower) ||
      /\bactive timer|current timer\b/.test(lower) ||
      /\bworking on\b/.test(lower) ||
      /\bdoing\b/.test(lower)
    );

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

  if (
    /current card|what card|which card|this card|currently viewing|card am i viewing/.test(
      lower,
    )
  ) {
    return {
      toolId: "search_tasks",
      payload: { useCurrentCard: true },
    };
  }

  if (
    /leave\s+(days?|balance|remaining|left|available)|days?\s+(left|remaining|available).*\bleave\b/.test(
      lower,
    )
  ) {
    const personName = extractPersonNameForLeave(message);

    return {
      toolId: "get_leave_balance",
      payload: {
        ...(personName ? { userName: personName, assigneeName: personName } : {}),
      },
    };
  }

  if (/leave|vacation|time off|absence|pto/.test(lower)) {
    return {
      toolId: "search_leave_requests",
      payload: /pending/.test(lower)
        ? { status: "pending", daysBack: 120 }
        : { daysBack: 120 },
    };
  }

  /**
   * IMPORTANT:
   * Personal active timer queries must be caught before generic team timer logic,
   * timesheets, tasks, and fallback routing.
   */
  if (isPersonalTimerQuery) {
    return {
      toolId: "get_active_time_trackers",
      payload: {
        scope: "me",
        currentUserOnly: true,
      },
    };
  }

  if (
    /\bnot\s+tracking|isn'?t\s+tracking|aren'?t\s+tracking|not\s+on\s+(a\s+)?timer|who\s+is\s+not\s+tracking|who\s+isn'?t\s+tracking/.test(
      lower,
    )
  ) {
    return {
      toolId: "get_active_time_trackers",
      payload: {
        ...extractTimerTargetPayload(message),
        scope: isSelf ? "me" : "team",
        currentUserOnly: isSelf,
        includeNotTracking: true,
        mode: "not_tracking",
      },
    };
  }

  if (
    /\b(list|show|send|give|check)\b.*\b(people|users|team|everyone|who)\b.*\b(tracking|timers?|time tracker)\b/.test(
      lower,
    ) ||
    /\bwho\b.*\b(tracking|timers?|time tracker)\b/.test(lower)
  ) {
    return {
      toolId: "get_active_time_trackers",
      payload: {
        ...extractTimerTargetPayload(message),
        scope: "team",
      },
    };
  }

  if (
    /\b(is|are)\b.*\b(timer|time tracker|tracking)\b.*\b(running|active|on)\b/.test(
      lower,
    ) ||
    /\b(timer|time tracker)\b.*\b(status|running|active)\b/.test(lower)
  ) {
    return {
      toolId: "get_active_time_trackers",
      payload: {
        ...extractTimerTargetPayload(message),
        scope: "team",
      },
    };
  }

  if (
    /working on|currently working|which task|which card|active timer|current timer|what is .* tracking|what .* tracking|on which task|timer on what/.test(
      lower,
    )
  ) {
    return {
      toolId: "get_active_time_trackers",
      payload: {
        ...extractTimerTargetPayload(message),
        scope: isSelf ? "me" : "team",
        currentUserOnly: isSelf,
      },
    };
  }

  if (
    /\b(stop|pause|end|finish)\b.*\b(timer|time tracker|time tracking|tracking time)\b/.test(
      lower,
    ) ||
    /\bstop\s+(my\s+)?time\b/.test(lower)
  ) {
    return {
      toolId: "stop_time_tracker",
      payload: {
        ...extractTimerTargetPayload(message),
        scope: isSelf ? "me" : "team",
        currentUserOnly: isSelf,
        notifyUser: /message|notify|tell|send/i.test(lower),
        notificationMessage:
          /start tracking time again|start.*timer.*again/i.test(lower)
            ? "Please start tracking time again on the correct card."
            : undefined,
      },
    };
  }

  if (
    /\b(start|begin)\b.*\b(timer|time tracker|time tracking)\b/.test(lower) ||
    /\bstart\s+(my\s+)?time\b/.test(lower) ||
    /\btrack\s+(my\s+)?time\b/.test(lower)
  ) {
    return {
      toolId: "start_time_tracker",
      payload: {
        ...extractTimerTargetPayload(message),
        scope: isSelf ? "me" : "team",
        currentUserOnly: isSelf,
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
      payload: {
        ...extractTimerTargetPayload(message),
        scope: isSelf ? "me" : "team",
        currentUserOnly: isSelf,
      },
    };
  }

  if (
    /timesheet|time entr|hours|tracked|time tracked|tracked time|worked on/.test(
      lower,
    )
  ) {
    return {
      toolId: "get_user_timesheet",
      payload: {
        ...timesheetPayload,
        ...extractTimerTargetPayload(message),
      },
    };
  }

  if (/attendance|clock/.test(lower)) {
    return {
      toolId: "get_attendance_summary",
      payload: {
        ...todayInHarareRange(),
        ...extractTimerTargetPayload(message),
      },
    };
  }

  if (/asset|equipment|serial|stock/.test(lower)) {
    return {
      toolId: "search_assets",
      payload: extractAssetPayload(message),
    };
  }

  if (/notification|inbox|alert/.test(lower)) {
    return {
      toolId: "search_notifications",
      payload: { unreadOnly: /unread/.test(lower), limit: 15 },
    };
  }

  if (/meeting|calendar|call|schedule/.test(lower)) {
    return {
      toolId: "search_meetings",
      payload: /today/.test(lower)
        ? { from: today, to: today, limit: 15 }
        : { daysBack: 7, limit: 20 },
    };
  }

  if (
    /what documents|documents do you know|list documents|available documents|known documents/.test(
      lower,
    )
  ) {
    return {
      toolId: "list_available_documents",
      payload: { limit: 50 },
    };
  }

  if (
    /document|knowledge base|policy|sop|file|uploaded|leave policy|payslip|contract|letter/.test(
      lower,
    )
  ) {
    return {
      toolId: "search_documents",
      payload: { query: message, limit: 8 },
    };
  }

  if (
    /social|post|caption|instagram|facebook|linkedin|tiktok|scheduled post/.test(
      lower,
    )
  ) {
    return {
      toolId: "search_social_posts",
      payload: {
        status: /scheduled/.test(lower) ? "scheduled" : undefined,
        limit: 15,
      },
    };
  }

  if (/fleet|vehicle|service|maintenance|odometer/.test(lower)) {
    return {
      toolId: "search_fleet_service_needs",
      payload: { horizon_days: /month|30/.test(lower) ? 30 : 14, limit: 20 },
    };
  }

  if (/report|operational report|weekly report|monthly report/.test(lower)) {
    return {
      toolId: "search_reports",
      payload: { daysBack: /month|monthly/.test(lower) ? 30 : 90, limit: 15 },
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

  if (/board/.test(lower)) {
    return { toolId: "list_boards", payload: {} };
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
      "I can help with workspace lookups:",
      "- Summarize my cards",
      "- List boards",
      "- Show timesheet or active timers",
      "- Show attendance summary",
      "- Show leave requests, meetings, reports, documents, social posts, or fleet service needs",
      "- Show notifications",
      "- Search assets",
    ].join("\n");
  }

  if (data.ok === false) {
    return readableToolValue(data.error || data) || "I could not complete that request.";
  }

  switch (toolId) {
    case "get_leave_balance": {
      const user =
        data.user && typeof data.user === "object"
          ? (data.user as Record<string, unknown>)
          : {};
      const balance =
        data.balance && typeof data.balance === "object"
          ? (data.balance as Record<string, unknown>)
          : {};

      const name = user.name ?? "This user";
      const remaining = balance.remainingDays ?? balance.remaining_days;
      const total = balance.totalDays ?? balance.total_days;
      const used = balance.usedDays ?? balance.used_days;
      const remainingNum = Number(remaining ?? 0);
      const totalNum = Number(total ?? 0);
      const usedNum = Number(used ?? 0);

      if (remainingNum <= 0) {
        return `${name} has no leave days remaining (used all ${totalNum} day${totalNum === 1 ? "" : "s"}).`;
      }

      return `${name} has ${remainingNum} leave day${remainingNum === 1 ? "" : "s"} remaining out of ${totalNum}. Used: ${usedNum}.`;
    }

    case "get_active_time_trackers": {
      const trackers = Array.isArray(data.trackers) ? data.trackers : [];
      const notTracking = Array.isArray(data.notTracking) ? data.notTracking : [];

      if (trackers.length === 0 && notTracking.length === 0) {
        return "No active time trackers right now.";
      }

      const lines = trackers.map((entry) => {
        const row = entry as Record<string, unknown>;
        const name = row.name ?? row.user_name ?? "Someone";
        const task = row.taskTitle ?? row.task_title ?? row.description ?? "Untitled card";
        const board = row.boardName ?? row.board_name ?? "No board";
        const link = row.taskUrl ?? taskLink(row.boardId, row.taskId);
        const elapsed = formatHours(row.elapsedSeconds);

        return `- ${name} is tracking "${task}" on ${board} (${elapsed} so far)${
          link ? `\n  Open card: ${link}` : ""
        }`;
      });

      return `Here is what is being tracked right now:\n\n${lines.join("\n")}`;
    }

    case "get_attendance_summary": {
      const records = Array.isArray(data.records) ? data.records : [];
      const counts = data.counts as Record<string, unknown> | undefined;

      if (records.length === 0) return "No attendance records were found for today.";

      const countLine = counts
        ? Object.entries(counts)
            .map(([status, count]) => `${status}: ${count}`)
            .join(", ")
        : "";

      const lines = records
        .slice(0, 10)
        .map((item) => formatAttendanceRecord(item as Record<string, unknown>))
        .join("\n");

      return `Attendance summary${countLine ? ` (${countLine})` : ""}.\n\n${lines}`;
    }

    case "search_assets": {
      const assets = Array.isArray(data.assets) ? data.assets : [];
      if (assets.length === 0) return "I could not find any assets.";

      const lines = assets.map((item) => {
        const row = item as Record<string, unknown>;
        const name = row.assetName ?? row.asset_name ?? row.name ?? "Asset";
        const details = [
          row.assetTag ? `tag ${row.assetTag}` : null,
          row.serialNumber ? `serial ${row.serialNumber}` : null,
          row.brand || row.model ? `${row.brand ?? ""} ${row.model ?? ""}`.trim() : null,
          row.status ? `status ${row.status}` : null,
          row.condition ? `condition ${row.condition}` : null,
        ]
          .filter(Boolean)
          .join(", ");

        return `- ${name}${details ? ` (${details})` : ""}${
          row.assetUrl ? `\n  Open asset: ${row.assetUrl}` : ""
        }`;
      });

      return `I found ${assets.length} asset${assets.length === 1 ? "" : "s"}:\n\n${lines.join("\n")}`;
    }

    case "search_tasks": {
      const tasks = Array.isArray(data.tasks)
        ? data.tasks
        : Array.isArray(data.cards)
        ? data.cards
        : [];

      const currentCard =
        data.card && typeof data.card === "object"
          ? (data.card as Record<string, unknown>)
          : (tasks[0] as Record<string, unknown> | undefined);

      if (!currentCard) return "I could not find the current card.";

      const title = currentCard.title ?? currentCard.name ?? "Untitled card";
      const status = currentCard.status ?? "unknown";
      const description = currentCard.description ?? "No description.";
      const boardName = currentCard.boardName ?? currentCard.board_name ?? "this board";
      const boardId = currentCard.boardId ?? currentCard.board_id ?? currentCard.client_id;
      const cardId = currentCard.cardId ?? currentCard.taskId ?? currentCard.id;
      const link = taskLink(boardId, cardId);

      return [
        `You are viewing card: ${title}`,
        `Board: ${boardName}`,
        `Status: ${status}`,
        `Description: ${description}`,
        link ? `Open card: ${link}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    case "list_boards": {
      const boards = Array.isArray(data.boards) ? data.boards : [];
      if (boards.length === 0) return "No boards found for your organization.";

      return `I found ${boards.length} board${boards.length === 1 ? "" : "s"}:\n\n${boards
        .map((board) => {
          const row = board as Record<string, unknown>;
          return `- ${row.name ?? "Board"}${row.id ? `\n  Open board: /boards/${row.id}` : ""}`;
        })
        .join("\n")}`;
    }

    default:
      return typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : "I found matching workspace data, but there is no readable summary available yet.";
  }
}