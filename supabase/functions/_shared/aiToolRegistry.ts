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

function formatNumber(value: unknown, digits = 0): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return number.toLocaleString("en-ZA", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
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

  const date = `${year}-${String(month).padStart(2, "0")}-${
    String(day).padStart(2, "0")
  }`;
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
  const status = String(row.status ?? "unknown").toLowerCase();
  const office = row.office ?? row.profileOffice ?? "Unknown office";
  const clockInText = clockIn ? formatTimeOnly(clockIn) : "Not clocked in";
  const clockOutText = clockOut ? `, out ${formatTimeOnly(clockOut)}` : "";

  if (status === "absent" || !clockIn) {
    return `- ${row.name ?? "Team member"} - ${office}`;
  }

  return `- ${row.name ?? "Team member"} - ${clockInText}${clockOutText} - ${office}`;
}

function formatTimeOnly(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Harare",
  });
}

function attendanceStatusLabel(status: unknown): string {
  const normalized = String(status ?? "unknown").toLowerCase();
  if (normalized === "present") return "Present";
  if (normalized === "late") return "Late";
  if (normalized === "absent") return "Absent";
  if (normalized === "on_leave") return "On leave";
  if (normalized === "pending") return "Pending";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatAttendanceCountLine(counts?: Record<string, unknown>): string {
  if (!counts) return "";
  const order = ["present", "late", "absent", "on_leave", "pending"];
  const parts = order
    .filter((key) => Number(counts[key] ?? 0) > 0)
    .map((key) => `${attendanceStatusLabel(key)}: ${counts[key]}`);
  const extra = Object.entries(counts)
    .filter(([key, value]) => !order.includes(key) && Number(value ?? 0) > 0)
    .map(([key, value]) => `${attendanceStatusLabel(key)}: ${value}`);
  return [...parts, ...extra].join(" | ");
}

function formatAttendanceGroups(
  records: Record<string, unknown>[],
  perGroup = 6,
): string {
  const order = ["late", "absent", "present", "on_leave", "pending"];
  const groups = new Map<string, Record<string, unknown>[]>();

  for (const record of records) {
    const status = String(record.status ?? "unknown").toLowerCase() ||
      "unknown";
    groups.set(status, [...(groups.get(status) ?? []), record]);
  }

  const orderedKeys = [
    ...order.filter((key) => groups.has(key)),
    ...[...groups.keys()].filter((key) => !order.includes(key)),
  ];

  return orderedKeys
    .map((key) => {
      const items = groups.get(key) ?? [];
      const visible = items.slice(0, perGroup).map(formatAttendanceRecord);
      const hidden = items.length - visible.length;
      return [
        `${attendanceStatusLabel(key)} (${items.length})`,
        ...visible,
        hidden > 0 ? `- +${hidden} more` : "",
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

function formatSingleAttendanceAnswer(row: Record<string, unknown>): string {
  const name = row.name ?? "This person";
  const clockIn = row.clockInAt ?? row.actualClockInAt;
  const clockOut = row.clockOutAt ?? row.actualClockOutAt;
  const office = row.office ?? row.profileOffice ?? "Unknown office";
  const status = attendanceStatusLabel(row.status);

  if (!clockIn) {
    return `${name} has not clocked in for this period.\nStatus: ${status}\nOffice: ${office}`;
  }

  return `${name} clocked in at ${formatTimeOnly(clockIn)}.\nStatus: ${status}\nOffice: ${office}${clockOut ? `\nClock out: ${formatTimeOnly(clockOut)}` : ""}`;
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
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(readableToolValue).filter(Boolean).join("\n");
  }
  if (!value || typeof value !== "object") return "";

  const record = value as Record<string, unknown>;

  for (
    const key of ["message", "error", "reply", "content", "text", "summary"]
  ) {
    const text = readableToolValue(record[key]);
    if (text) return text;
  }

  const matches = Array.isArray(record.matches) ? record.matches : [];
  if (matches.length > 0) {
    const lines = matches.map((item) => {
      const row = item as Record<string, unknown>;
      return `- ${row.title ?? row.name ?? "Match"}${
        row.taskId ? ` (${row.taskId})` : ""
      }`;
    });
    return `More than one match was found:\n${lines.join("\n")}`;
  }

  return JSON.stringify(record);
}

function extractPersonNameForLeave(message: string): string | null {
  const lower = message.toLowerCase();

  if (/\b(my|me|mine|myself)\b/.test(lower)) {
    const hasThirdPartyName =
      /\b(?:for|check|show)\s+([a-z][a-z.'-]+(?:\s+[a-z][a-z.'-]+){0,2})\b/i
        .test(message) ||
      /\b[a-z][a-z.'-]+['']s\s+(?:leave|days?|balance)/i.test(lower);
    if (!hasThirdPartyName) return null;
  }

  // SKIP words that are never a person's name in this context
  const SKIP_WORDS = new Set([
    "show",
    "check",
    "what",
    "how",
    "leave",
    "balance",
    "days",
    "day",
    "remaining",
    "left",
    "available",
    "calculate",
    "get",
    "find",
    "tell",
    "does",
    "have",
    "for",
    "with",
    "me",
    "my",
    "mine",
    "myself",
    "his",
    "her",
    "their",
    "the",
    "a",
    "an",
    "is",
    "are",
  ]);

  function isValidName(raw: string): boolean {
    const parts = raw.toLowerCase().split(/\s+/);
    return parts.length >= 1 &&
      parts.every((p) => p.length >= 2 && !SKIP_WORDS.has(p));
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

  let scheduledUtc = new Date(
    Date.UTC(year, month, day, hour - 2, minute, 0, 0),
  );

  if (!tomorrow && scheduledUtc.getTime() <= now.getTime()) {
    scheduledUtc = new Date(scheduledUtc.getTime() + 24 * 60 * 60 * 1000);
  }

  return scheduledUtc.toISOString();
}

function extractTimerTargetPayload(message: string): Record<string, unknown> {
  const email = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];

  const possessiveName = message.match(
    /\b([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})['’]s\s+(?:timer|time|task|tracking|work)/,
  )?.[1];

  const directName = possessiveName ??
    message.match(
      /\b(?:is|for|show|stop|start|check|what is|what task is)\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})\b/,
    )?.[1];

  const cleanedName = directName
    ?.replace(/\b(timer|time|tracking|working|task|on)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    originalMessage: message,
    ...(email ? { userEmail: email, email, assigneeEmail: email } : {}),
    ...(cleanedName
      ? {
        userName: cleanedName,
        name: cleanedName,
        assigneeName: cleanedName,
      }
      : {}),
  };
}

function extractAttendanceTargetPayload(message: string): Record<string, unknown> {
  const email = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const direct =
    message.match(
      /\b(?:did|has|is|was|check|show|tell|find)\s+([A-Za-z0-9._%+-]+(?:\s+[A-Za-z][A-Za-z.'-]+){0,2})\s+(?:clock|clocked|present|late|absent|come|came|arrive|arrived)\b/i,
    )?.[1] ??
    message.match(
      /\b(?:attendance|clock[- ]?in|clocked\s+in|late|absent|present)\s+(?:for|of)\s+([A-Za-z0-9._%+-]+(?:\s+[A-Za-z][A-Za-z.'-]+){0,2})\b/i,
    )?.[1];

  const cleanedName = direct
    ?.replace(
      /\b(today|yesterday|this|morning|afternoon|evening|please|the|a|an)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  return {
    originalMessage: message,
    ...(email ? { userEmail: email, email, assigneeEmail: email } : {}),
    ...(cleanedName
      ? {
        userName: cleanedName,
        name: cleanedName,
        employeeName: cleanedName,
        assigneeName: cleanedName,
      }
      : {}),
  };
}

function extractBoardCardPayload(message: string): Record<string, unknown> {
  const normalized = message.replace(/\s+/g, " ").trim();
  const timerPayload = extractTimerTargetPayload(normalized);

  const payload: Record<string, unknown> = {
    ...timerPayload,
    startTimer:
      /\b(start|begin|track|tracking)\b.*\b(timer|time tracker|time tracking|time)\b/i
        .test(normalized) ||
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

  const boardMatch = normalized.match(
    /\b(?:under|on|in|inside)\s+(?:the\s+)?(?:board|client|project)\s+["']?([^"',?.]{2,120})/i,
  ) ??
    normalized.match(
      /\bboard\s*(?:called|named|is|:)?\s*["']?([^"',?.]{2,120})/i,
    );

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

  const genericAssetList =
    /\b(show|list|get|view|see|display)\b.*\b(assets?|equipment|stock)\b.*\b(system|workspace|database|registry|here|available|registered)\b/.test(
      lower,
    ) ||
    /\b(what|which)\b.*\b(assets?|equipment|stock)\b.*\b(system|workspace|database|registry|here|available|registered)\b/.test(
      lower,
    ) ||
    /\b(any|other)\s+(assets?|equipment|stock)\b/.test(lower) ||
    /\bassets?\s+(?:that\s+are\s+)?(?:in|on|inside|within)\s+(?:this|the|our)\s+(system|workspace|database|registry|company)\b/.test(
      lower,
    );

  const listAll =
    /\b(list|show|get|view)\b.*\b(all|every|everything)\b.*\b(assets?|equipment|stock)\b/
      .test(lower) ||
    /\ball\s+(assets?|equipment|stock)\b/.test(lower) ||
    genericAssetList;

  const serial =
    message.match(/\b(?:serial|sn|s\/n)\s*[:#-]?\s*([A-Z0-9-]{3,})\b/i)?.[1] ??
      null;

  const assetTag =
    message.match(/\b(?:asset\s*tag|tag)\s*[:#-]?\s*([A-Z0-9-]{2,})\b/i)?.[1] ??
      null;

  const cleaned = listAll ? "" : message
    .replace(
      /\b(show|list|find|search|get|view|see|display|any|all|every|everything|other|the|this|that|these|those|are|is|was|were|here|there|available|me|my|mine|assets?|asset|equipment|stock|registered|system|workspace|database|registry|on|in|inside|within|please|for|of|company|office)\b/gi,
      " ",
    )
    .replace(/\bserial\s*[:#-]?\s*[A-Z0-9-]{3,}\b/gi, " ")
    .replace(/\b(?:asset\s*tag|tag)\s*[:#-]?\s*[A-Z0-9-]{2,}\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const payload: Record<string, unknown> = {
    originalMessage: message,
    listAll,
    limit: listAll || /\b(all|list|show|everything)\b/i.test(message)
      ? 200
      : 50,
  };

  if (cleaned) {
    payload.query = cleaned;
    payload.search = cleaned;
  }

  if (serial) {
    payload.serialNumber = serial;
    payload.serial_number = serial;
  }

  if (assetTag) {
    payload.assetTag = assetTag;
    payload.asset_tag = assetTag;
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

  const isTeamTimerQuery =
    /\b(team|everyone|everybody|employees|employee|people|users|members|staff|who|trackers)\b/.test(
      lower,
    );

  const isPersonalTimerQuery =
    isSelf &&
    !isTeamTimerQuery &&
    (
      /\b(timer|timers|time tracker|time tracking|tracking time|tracking)\b/.test(lower) ||
      /\bactive timer|current timer\b/.test(lower) ||
      /\bworking on\b/.test(lower) ||
      /\bdoing\b/.test(lower)
    );

  const exportRequested =
    /\b(export|download|save|file|generate)\b/.test(lower) ||
    /\b(pdf|csv|excel|xlsx|json)\b/.test(lower);

  const requestedFormat = /\bpdf\b/.test(lower)
    ? "pdf"
    : /\bcsv\b/.test(lower)
      ? "csv"
      : /\b(excel|xlsx)\b/.test(lower)
        ? "xlsx"
        : /\bjson\b/.test(lower)
          ? "json"
          : null;

  const daysBackMatch =
    lower.match(/\b(?:last|past|previous)\s+(\d+)\s+days?\b/) ??
    lower.match(/\b(\d+)\s+days?\b/);

  const daysBackFromMessage = daysBackMatch
    ? Number(daysBackMatch[1])
    : /\b(two|2)\s+weeks?\b/.test(lower)
      ? 14
      : /\bweek(ly)?\b/.test(lower)
        ? 7
        : null;

  const timesheetPayload = /today|this day|current day/.test(lower)
    ? { from: today, to: today }
    : /yesterday/.test(lower)
      ? (() => {
          const date = new Date();
          date.setUTCDate(date.getUTCDate() - 1);
          const value = date.toISOString().slice(0, 10);
          return { from: value, to: value };
        })()
      : daysBackFromMessage
        ? { daysBack: daysBackFromMessage }
        : { daysBack: 7 };

  if (
    /current card|what card|which card|this card|currently viewing|card am i viewing/.test(
      lower,
    )
  ) {
    return {
      toolId: "search_tasks",
      payload: { useCurrentCard: true, originalMessage: message },
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
        originalMessage: message,
        ...(personName ? { userName: personName, assigneeName: personName } : {}),
      },
    };
  }

  if (/leave|vacation|time off|absence|pto/.test(lower)) {
    return {
      toolId: "search_leave_requests",
      payload: /pending/.test(lower)
        ? { status: "pending", daysBack: 120, originalMessage: message }
        : { daysBack: 120, originalMessage: message },
    };
  }

  if (
    /\bnot\s+tracking\b|\bisn'?t\s+tracking\b|\baren'?t\s+tracking\b|\bnot\s+on\s+(a\s+)?timer\b|\bwho\s+is\s+not\s+tracking\b|\bwho\s+isn'?t\s+tracking\b|\bnot\s+using\s+(a\s+)?timer\b/.test(
      lower,
    )
  ) {
    return {
      toolId: "get_active_time_trackers",
      payload: {
        scope: isSelf && !isTeamTimerQuery ? "me" : "team",
        currentUserOnly: isSelf && !isTeamTimerQuery,
        includeNotTracking: true,
        include_not_tracking: true,
        mode: "not_tracking",
        originalMessage: message,
      },
    };
  }

  if (
    /\b(stop|pause|end|finish)\b.*\b(timer|time tracker|time tracking|tracking time|time)\b/.test(
      lower,
    ) ||
    /\bstop\s+(my\s+)?time\b/.test(lower)
  ) {
    return {
      toolId: "stop_time_tracker",
      payload: {
        ...extractTimerTargetPayload(message),
        scope: isSelf && !isTeamTimerQuery ? "me" : "team",
        currentUserOnly: isSelf && !isTeamTimerQuery,
        notifyUser: /message|notify|tell|send/i.test(lower),
        notificationMessage:
          /start tracking time again|start.*timer.*again/i.test(lower)
            ? "Please start tracking time again on the correct card."
            : undefined,
        originalMessage: message,
      },
    };
  }

  if (
    /\b(start|begin)\b.*\b(timer|time tracker|time tracking|time)\b/.test(lower) ||
    /\bstart\s+(my\s+)?time\b/.test(lower) ||
    /\btrack\s+(my\s+)?time\b/.test(lower)
  ) {
    return {
      toolId: "start_time_tracker",
      payload: {
        ...extractTimerTargetPayload(message),
        scope: isSelf && !isTeamTimerQuery ? "me" : "team",
        currentUserOnly: isSelf && !isTeamTimerQuery,
        originalMessage: message,
      },
    };
  }

  if (
    /\b(list|show|send|give|check)\b.*\b(people|users|team|everyone|everybody|employees|members|staff|trackers)\b.*\b(tracking|timers?|time tracker|time trackers)\b/.test(
      lower,
    ) ||
    /\bwho\b.*\b(tracking|timers?|time tracker|time trackers)\b/.test(lower) ||
    /\blist active time trackers\b/.test(lower) ||
    /\bshow active timers\b/.test(lower)
  ) {
    return {
      toolId: "get_active_time_trackers",
      payload: {
        scope: "team",
        originalMessage: message,
      },
    };
  }

  if (isPersonalTimerQuery) {
    return {
      toolId: "get_active_time_trackers",
      payload: {
        scope: "me",
        currentUserOnly: true,
        originalMessage: message,
      },
    };
  }

  if (
    /working on|currently working|which task|which card|active timer|current timer|what is .* tracking|what .* tracking|on which task|timer on what|what task is .* tracking/.test(
      lower,
    )
  ) {
    return {
      toolId: "get_active_time_trackers",
      payload: {
        ...extractTimerTargetPayload(message),
        scope: isSelf && !isTeamTimerQuery ? "me" : "team",
        currentUserOnly: isSelf && !isTeamTimerQuery,
        originalMessage: message,
      },
    };
  }

  if (
    /\b(is|am|are)\b.*\b(timer|time tracker|tracking)\b.*\b(running|active|on)\b/.test(
      lower,
    ) ||
    /\b(timer|time tracker)\b.*\b(status|running|active)\b/.test(lower) ||
    /\b(my|me|mine)\b.*\b(timer|time tracker)\b/.test(lower)
  ) {
    return {
      toolId: "get_active_time_trackers",
      payload: {
        ...extractTimerTargetPayload(message),
        scope: isSelf && !isTeamTimerQuery ? "me" : "team",
        currentUserOnly: isSelf && !isTeamTimerQuery,
        originalMessage: message,
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
        scope: isSelf && !isTeamTimerQuery ? "me" : "team",
        currentUserOnly: isSelf && !isTeamTimerQuery,
        originalMessage: message,
      },
    };
  }

  if (
    exportRequested &&
    /\b(it|this|that|last|previous)\b.*\b(pdf|csv|excel|xlsx|json|file|download|export)\b/.test(
      lower,
    )
  ) {
    return {
      toolId: "get_user_timesheet",
      payload: {
        ...timesheetPayload,
        ...extractTimerTargetPayload(message),
        scope: "me",
        currentUserOnly: true,
        exportRequested: true,
        requestedFormat,
        originalMessage: message,
      },
    };
  }

  if (
    /timesheet|time\s*sheet|time entr|hours|tracked|time tracked|tracked time|worked on/.test(
      lower,
    ) ||
    (
      exportRequested &&
      /\b(timesheet|time\s*sheet|hours|tracked time|time report|work report)\b/.test(
        lower,
      )
    )
  ) {
    return {
      toolId: "get_user_timesheet",
      payload: {
        ...timesheetPayload,
        ...extractTimerTargetPayload(message),
        scope: isSelf ? "me" : "team",
        currentUserOnly: isSelf,
        exportRequested,
        requestedFormat,
        originalMessage: message,
      },
    };
  }

  if (
    /attendance|clock/.test(lower) ||
    /\b(who|show|list|which|people|staff|employees|team)\b.*\b(late|absent|present)\b/.test(
      lower,
    ) ||
    /\b(late|absent)\s+(today|this morning|this day)\b/.test(lower)
  ) {
    const attendanceMode =
      /\b(absent|absence|did not clock|didn'?t clock|not clocked|no clock[- ]?in|not in|missing clock|never clocked)\b/
        .test(lower)
        ? "absent"
        : /\b(late|clocked in late|arrived late)\b/.test(lower)
          ? "late"
          : /\b(on leave|leave today|approved leave)\b/.test(lower)
            ? "on_leave"
            : /\b(clock(?:ed)? in|clockins?|present|who is in|who came in)\b/.test(lower)
              ? "clocked_in"
              : "summary";

    return {
      toolId: "get_attendance_summary",
      payload: {
        ...todayInHarareRange(),
        ...extractTimerTargetPayload(message),
        ...extractAttendanceTargetPayload(message),
        mode: attendanceMode,
        status:
          attendanceMode === "summary" || attendanceMode === "clocked_in"
            ? undefined
            : attendanceMode,
        originalMessage: message,
      },
    };
  }

  if (
    /asset|equipment|serial|stock|macbook|mac book|laptop|desktop|phone|printer|monitor|keyboard|mouse|device_type|device type/.test(
      lower,
    )
  ) {
    return {
      toolId: "search_assets",
      payload: extractAssetPayload(message),
    };
  }

  if (
    /fleet|vehicle|service|maintenance|odometer|kilometers|kilometres|\bkm\b|fuel|diesel|petrol|mileage|service record|fuel purchase|fuel purchases/.test(
      lower,
    )
  ) {
    const fleetMode =
      /\b(list|show|which|what)\b.*\b(vehicles?|cars?|trucks?|vans?|fleet)\b/.test(
        lower,
      )
        ? "list_vehicles"
        : /service record|maintenance history|service history|maintenance record/.test(
            lower,
          )
          ? "service_records"
          : /fuel|diesel|petrol|purchase/.test(lower) &&
              /kilometers|kilometres|\bkm\b|mileage|odometer|covered|distance/.test(
                lower,
              )
            ? "daily_usage"
            : /fuel|diesel|petrol|purchase/.test(lower)
              ? "fuel"
              : /kilometers|kilometres|\bkm\b|mileage|odometer|covered|distance/.test(
                    lower,
                  )
                ? "usage"
                : "overview";

    return {
      toolId: "search_fleet_service_needs",
      payload: {
        originalMessage: message,
        query: message,
        mode: fleetMode,
        datePreset: /yesterday/.test(lower)
          ? "yesterday"
          : /today/.test(lower)
            ? "today"
            : null,
        horizon_days: /month|30/.test(lower) ? 30 : 14,
        limit: /\ball\b/.test(lower) ? 100 : 30,
      },
    };
  }

  if (/notification|inbox|alert/.test(lower)) {
    return {
      toolId: "search_notifications",
      payload: {
        unreadOnly: /unread/.test(lower),
        limit: 15,
        originalMessage: message,
      },
    };
  }

  if (/meeting|calendar|call|schedule/.test(lower)) {
    return {
      toolId: "search_meetings",
      payload: /today/.test(lower)
        ? { from: today, to: today, limit: 15, originalMessage: message }
        : { daysBack: 7, limit: 20, originalMessage: message },
    };
  }

  if (
    /what documents|documents do you know|list documents|available documents|known documents/.test(
      lower,
    )
  ) {
    return {
      toolId: "list_available_documents",
      payload: { limit: 50, originalMessage: message },
    };
  }

  if (
    /document|knowledge base|policy|sop|file|uploaded|leave policy|payslip|contract|letter/.test(
      lower,
    )
  ) {
    return {
      toolId: "search_documents",
      payload: { query: message, limit: 8, originalMessage: message },
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
        originalMessage: message,
      },
    };
  }

  if (/report|operational report|weekly report|monthly report/.test(lower)) {
    return {
      toolId: "search_reports",
      payload: {
        daysBack: /month|monthly/.test(lower) ? 30 : 90,
        limit: 15,
        originalMessage: message,
      },
    };
  }

  if (
    /\b(create|make|add)\b.*\b(card|task)\b/.test(lower) ||
    /\b(card|task)\b.*\b(named|called|titled)\b/.test(lower)
  ) {
    return {
      toolId: "create_board_card",
      payload: {
        ...extractBoardCardPayload(message),
        originalMessage: message,
      },
    };
  }

  if (/board/.test(lower)) {
    return { toolId: "list_boards", payload: { originalMessage: message } };
  }

  if (/task|todo|card/.test(lower)) {
    return {
      toolId: "summarize_my_tasks",
      payload: { originalMessage: message },
    };
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
    return (
      readableToolValue(data.error || data) ||
      "I could not complete that request."
    );
  }

  switch (toolId) {
    case "create_board_card": {
      const message = typeof data.message === "string"
        ? data.message
        : "Created the card.";
      const link =
        typeof data.cardUrl === "string"
          ? data.cardUrl
          : typeof data.taskUrl === "string"
            ? data.taskUrl
            : typeof data.actionUrl === "string"
              ? data.actionUrl
              : taskLink(data.boardId, data.cardId ?? data.taskId);

      return `${message}${link ? `\n\n[Open card](${link})` : ""}`;
    }

    case "get_active_time_trackers": {
      const trackers = Array.isArray(data.trackers) ? data.trackers : [];
      const notTracking = Array.isArray(data.notTracking)
        ? data.notTracking
        : [];

      const trackerLines = trackers.map((entry) => {
        const row = entry as Record<string, unknown>;

        const name = row.name ?? row.user_name ?? "Someone";
        const task = row.taskTitle ??
          row.task_title ??
          row.description ??
          "Untitled card";

        const board = row.boardName ?? row.board_name ?? "No board";

        const boardId = row.boardId ?? row.board_id ?? row.clientId ??
          row.client_id;
        const taskId = row.taskId ?? row.task_id ?? row.cardId ?? row.card_id;

        const link = row.taskUrl ??
          row.task_url ??
          row.cardUrl ??
          row.card_url ??
          taskLink(boardId, taskId);

        const elapsed = formatHours(row.elapsedSeconds);
        const taskLabel = link ? `[${task}](${link})` : `"${task}"`;

        return `- ${name} is tracking ${taskLabel} on ${board} (${elapsed} so far)`;
      });

      const notTrackingLines = notTracking.map((entry) => {
        const row = entry as Record<string, unknown>;
        const name = row.name ?? row.full_name ?? row.email ?? "Team member";
        const role = row.role ?? row.primary_role;
        const department = row.department;
        const details = [role, department].filter(Boolean).join(", ");

        return `- ${name}${details ? ` (${details})` : ""}`;
      });

      if (notTracking.length > 0 && trackers.length === 0) {
        return `Here is who is not tracking time:\n\n${
          notTrackingLines.join("\n")
        }`;
      }

      if (notTracking.length > 0 && trackers.length > 0) {
        return [
          `Here is what is being tracked right now:\n\n${
            trackerLines.join("\n")
          }`,
          `Here is who is not tracking time:\n\n${notTrackingLines.join("\n")}`,
        ].join("\n\n");
      }

      if (trackers.length === 0) {
        return typeof data.message === "string" && data.message.trim()
          ? data.message.trim()
          : "No active time trackers right now.";
      }

      return `Here is what is being tracked right now:\n\n${
        trackerLines.join("\n")
      }`;
    }
    case "get_user_timesheet": {
      const entries = Array.isArray(data.entries) ? data.entries : [];

      const user = data.user && typeof data.user === "object"
        ? (data.user as Record<string, unknown>)
        : {};

      const range = data.range && typeof data.range === "object"
        ? (data.range as Record<string, unknown>)
        : {};

      const name = user.name ?? "This user";
      const userId = String(user.id ?? "");
      const totalHours = Number(data.totalHours ?? 0).toFixed(2);
      const from = String(range.from ?? "").slice(0, 10);
      const to = String(range.to ?? "").slice(0, 10);

      if (entries.length === 0) {
        return `${name} has no time entries from ${from} to ${to}.`;
      }

      const grouped = new Map<
        string,
        {
          task: string;
          board: string;
          link: string | null;
          totalSeconds: number;
          rows: Record<string, unknown>[];
        }
      >();

      for (const entry of entries) {
        const row = entry as Record<string, unknown>;

        const task = String(
          row.taskTitle ??
            row.task_title ??
            row.description ??
            "Untitled work",
        ).trim() || "Untitled work";

        const board =
          String(row.boardName ?? row.board_name ?? "No board").trim() ||
          "No board";

        const link = typeof row.taskUrl === "string"
          ? row.taskUrl
          : taskLink(row.boardId, row.taskId);

        const seconds = Number(row.durationSeconds ?? 0);
        const key = `${row.taskId ?? task}-${row.boardId ?? board}`;
        const existing = grouped.get(key);

        if (existing) {
          existing.totalSeconds += seconds;
          existing.rows.push(row);
        } else {
          grouped.set(key, {
            task,
            board,
            link: link || null,
            totalSeconds: seconds,
            rows: [row],
          });
        }
      }

      const groupedRows = [...grouped.values()].sort(
        (a, b) => b.totalSeconds - a.totalSeconds,
      );

      const taskSections = groupedRows.map((group) => {
        const taskLabel = group.link
          ? `[${group.task}](${group.link})`
          : group.task;

        const groupHours = (group.totalSeconds / 3600).toFixed(2);

        const entryLines = group.rows
          .sort((a, b) =>
            String(b.startedAt ?? "").localeCompare(String(a.startedAt ?? ""))
          )
          .slice(0, 8)
          .map((row) => {
            const date = String(row.startedAt ?? row.started_at ?? "").slice(
              0,
              10,
            );
            const hours = (Number(row.durationSeconds ?? 0) / 3600).toFixed(2);
            const running = row.isRunning ? " — running" : "";

            return `  - ${date}: ${hours}h${running}`;
          });

        return [
          `- ${taskLabel}`,
          `  Board: ${group.board}`,
          `  Time tracked: ${groupHours}h`,
          ...entryLines,
        ].join("\n");
      });

      const exportPayload = {
        type: "timesheet_export",
        userId,
        from,
        to,
        formats: ["pdf", "csv", "xlsx", "json"],
      };

      return [
        `${name}'s timesheet`,
        `Period: ${from} to ${to}`,
        `Total tracked: ${totalHours}h`,
        `Tasks worked on: ${groupedRows.length}`,
        "",
        ...taskSections,
        "",
        `Say "export this timesheet as PDF, CSV, Excel, or JSON" when you want a download.`,
      ].join("\n");
    }

    case "get_attendance_summary": {
      const records = Array.isArray(data.records) ? data.records : [];
      const counts = data.counts as Record<string, unknown> | undefined;
      const mode = String(data.mode ?? "summary");
      const heading =
        mode === "late"
          ? "Late arrivals"
          : mode === "absent"
            ? "Not clocked in"
            : mode === "clocked_in"
              ? "Clocked in"
              : mode === "on_leave"
                ? "On leave"
                : "Attendance summary";

      if (records.length === 0) {
        return `No ${heading.toLowerCase()} records were found for this period.`;
      }

      if (data.teamView === false && records.length === 1) {
        return formatSingleAttendanceAnswer(
          records[0] as Record<string, unknown>,
        );
      }

      const countLine = formatAttendanceCountLine(counts);

      const lines = formatAttendanceGroups(
        records.map((item) => item as Record<string, unknown>),
      );

      return `${heading}${countLine ? `\n${countLine}` : ""}\n\n${lines}`;
    }

    case "search_assets": {
      const assets = Array.isArray(data.assets) ? data.assets : [];

      if (assets.length === 0) {
        return typeof data.message === "string" && data.message.trim()
          ? data.message.trim()
          : "I could not find any assets.";
      }

      const lines = assets.map((item) => {
        const row = item as Record<string, unknown>;
        const name = row.assetName ?? row.asset_name ?? row.name ?? "Asset";

        const details = [
          row.assetTag ? `tag ${row.assetTag}` : null,
          row.serialNumber ? `serial ${row.serialNumber}` : null,
          row.brand || row.model
            ? `${row.brand ?? ""} ${row.model ?? ""}`.trim()
            : null,
          row.status ? `status ${row.status}` : null,
          row.condition ? `condition ${row.condition}` : null,
        ]
          .filter(Boolean)
          .join(", ");

        return `- ${name}${details ? ` (${details})` : ""}${
          row.assetUrl ? `\n  Open asset: ${row.assetUrl}` : ""
        }`;
      });

      return `I found ${assets.length} asset${
        assets.length === 1 ? "" : "s"
      }:\n\n${lines.join("\n")}`;
    }

    case "search_fleet_service_needs": {
      const mode = String(data.mode ?? "overview");
      const vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
      const serviceRecords = Array.isArray(data.serviceRecords)
        ? data.serviceRecords
        : [];
      const dailySummaries = Array.isArray(data.dailySummaries)
        ? data.dailySummaries
        : [];
      const fuelPurchases = Array.isArray(data.fuelPurchases)
        ? data.fuelPurchases
        : [];
      const serviceNeeds = Array.isArray(data.serviceNeeds)
        ? data.serviceNeeds
        : [];

      if (mode === "list_vehicles") {
        if (vehicles.length === 0) return "No fleet vehicles were found.";
        const lines = vehicles.slice(0, 30).map((item) => {
          const row = item as Record<string, unknown>;
          const name = row.name ?? row.vehicleName ?? "Vehicle";
          const registration = row.registrationNumber
            ? ` (${row.registrationNumber})`
            : "";
          const model = [row.make, row.model].filter(Boolean).join(" ");
          const odo = row.currentOdometerKm
            ? `${formatNumber(row.currentOdometerKm)} km`
            : "no odometer";
          return `- ${name}${registration}${model ? ` - ${model}` : ""} - ${odo}`;
        });
        return `Fleet vehicles (${vehicles.length})\n\n${lines.join("\n")}`;
      }

      if (mode === "service_records") {
        if (serviceRecords.length === 0) {
          return typeof data.message === "string" && data.message.trim()
            ? data.message.trim()
            : "No fleet service records were found.";
        }
        const lines = serviceRecords.slice(0, 20).map((item) => {
          const row = item as Record<string, unknown>;
          const vehicle = row.vehicleName ?? row.registrationNumber ??
            "Vehicle";
          const cost = row.cost
            ? ` - ${row.currency ?? "USD"} ${formatNumber(row.cost, 2)}`
            : "";
          return `- ${vehicle} - ${row.serviceDate ?? "unknown date"} - ${row.serviceType ?? "service"}${row.odometerKm ? ` at ${formatNumber(row.odometerKm)} km` : ""}${row.provider ? ` - ${row.provider}` : ""}${cost}`;
        });
        return `Fleet service records (${serviceRecords.length})\n\n${lines.join("\n")}`;
      }

      if (mode === "fuel" || mode === "usage" || mode === "daily_usage") {
        if (dailySummaries.length === 0 && fuelPurchases.length === 0) {
          return typeof data.message === "string" && data.message.trim()
            ? data.message.trim()
            : `No fleet usage or fuel records were found for ${data.reportDate ?? "that date"}.`;
        }

        const summaryLines = dailySummaries.slice(0, 20).map((item) => {
          const row = item as Record<string, unknown>;
          const vehicle = row.vehicleName ?? row.registrationNumber ??
            "Vehicle";
          const fuel = row.fuelConsumptionLitres
            ? `${formatNumber(row.fuelConsumptionLitres, 2)} L`
            : "no fuel";
          const distance = `${formatNumber(row.routeLengthKm, 2)} km`;
          const odo = row.odometerKm
            ? `, odometer ${formatNumber(row.odometerKm)} km`
            : "";
          return `- ${vehicle}: ${distance}, ${fuel}${odo}`;
        });

        const purchaseLines = fuelPurchases.slice(0, 10).map((item) => {
          const row = item as Record<string, unknown>;
          const vehicle = row.vehicleName ?? row.registrationNumber ??
            "Vehicle";
          const cost = row.totalCost
            ? `${row.currency ?? "USD"} ${formatNumber(row.totalCost, 2)}`
            : "cost not set";
          return `- ${vehicle}: ${formatNumber(row.litres, 2)} L - ${cost}${row.stationName ? ` - ${row.stationName}` : ""}`;
        });

        return [
          `Fleet usage for ${data.reportDate ?? "selected date"}`,
          summaryLines.length ? `Daily summaries\n${summaryLines.join("\n")}` : "",
          purchaseLines.length ? `Fuel purchases\n${purchaseLines.join("\n")}` : "",
        ].filter(Boolean).join("\n\n");
      }

      if (serviceNeeds.length === 0) {
        return typeof data.message === "string" && data.message.trim()
          ? data.message.trim()
          : "No fleet service needs were found.";
      }

      const lines = serviceNeeds.slice(0, 20).map((item) => {
        const row = item as Record<string, unknown>;
        const vehicle = row.vehicleName ?? row.registrationNumber ??
          "Vehicle";
        return `- ${vehicle} - ${row.serviceType ?? row.scheduleName ?? "service"} due ${row.nextServiceDate ?? "by odometer"}${row.nextServiceOdometerKm ? ` or ${formatNumber(row.nextServiceOdometerKm)} km` : ""}`;
      });

      return `Fleet service needs (${serviceNeeds.length})\n\n${lines.join("\n")}`;
    }

    case "get_leave_balance": {
      const user = data.user && typeof data.user === "object"
        ? (data.user as Record<string, unknown>)
        : {};
      const balance = data.balance && typeof data.balance === "object"
        ? (data.balance as Record<string, unknown>)
        : {};

      const name = user.name ?? "This user";
      const remaining = Number(
        balance.remainingDays ?? balance.remaining_days ?? 0,
      );
      const total = Number(balance.totalDays ?? balance.total_days ?? 0);
      const used = Number(balance.usedDays ?? balance.used_days ?? 0);

      return `${name} has ${remaining} leave day${
        remaining === 1 ? "" : "s"
      } remaining out of ${total}. Used: ${used}.`;
    }

    case "list_boards": {
      const boards = Array.isArray(data.boards) ? data.boards : [];

      if (boards.length === 0) {
        return "No boards found for your organization.";
      }

      return `I found ${boards.length} board${
        boards.length === 1 ? "" : "s"
      }:\n\n${
        boards
          .map((board) => {
            const row = board as Record<string, unknown>;
            return `- ${row.name ?? "Board"}${
              row.id ? `\n  Open board: /boards/${row.id}` : ""
            }`;
          })
          .join("\n")
      }`;
    }

    default:
      return typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : "I found matching workspace data, but there is no readable summary available yet.";
  }
}
