import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveTargetProfile } from "../_shared/userResolver.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ToolContext = {
  userId?: string;
  organizationId?: string;
  officeId?: string | null;
  role?: string | null;
  department?: string | null;
  fullName?: string | null;
};

type ExecuteToolBody = {
  toolId?: string;
  payload?: Record<string, unknown>;
  context?: ToolContext;
  dryRun?: boolean;
};

type DbRow = Record<string, any>;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-api-key, x-codex-internal-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MANAGER_ROLES = new Set([
  "admin",
  "manager",
  "hr",
  "superadmin",
  "super_admin",
  "it-superadmin",
  "it",
  "org_admin",
]);

const CLOSED_STATUSES = new Set(["done", "cancelled", "approved"]);

// ─────────────────────────────────────────────────────────────────────────────
// Small utilities
// ─────────────────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

function hasInternalSecret(req: Request) {
  const secret =
    Deno.env.get("INTERNAL_API_KEY") ?? Deno.env.get("CODEX_TOOL_SECRET");
  if (!secret) return false;
  const inbound =
    req.headers.get("x-codex-internal-key") ??
    req.headers.get("x-internal-api-key");
  return inbound === secret;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNestedString(
  payload: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const direct = readString(payload, key);
    if (direct) return direct;
  }
  for (const nestedKey of [
    "targetUser",
    "target_user",
    "user",
    "employee",
    "assignee",
  ]) {
    const nested = payload[nestedKey];
    if (!nested || typeof nested !== "object" || Array.isArray(nested))
      continue;
    const record = nested as Record<string, unknown>;
    for (const key of keys) {
      const value =
        typeof record[key] === "string" ? (record[key] as string).trim() : "";
      if (value) return value;
    }
  }
  return null;
}

function normalizePriority(value: unknown) {
  const normalized = String(value ?? "medium").toLowerCase();
  return ["low", "medium", "high", "urgent"].includes(normalized)
    ? normalized
    : "medium";
}

function normalizeUuid(value: unknown) {
  if (typeof value !== "string") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
    ? value
    : null;
}

function buildBoardCardUrl(boardId: string, taskId: string) {
  return `/boards/${boardId}?cardId=${taskId}`;
}

function isManagerRole(role: string | null | undefined) {
  return MANAGER_ROLES.has(String(role ?? "").toLowerCase());
}

function canViewContentWorkspace(role: string | null | undefined) {
  return (
    isManagerRole(role) ||
    ["media_team", "social_media", "seo_specialist"].includes(
      String(role ?? "").toLowerCase(),
    )
  );
}

function isPrivilegedDocumentRole(role: string | null | undefined) {
  return (
    isManagerRole(role) ||
    ["hr", "it", "it-superadmin"].includes(String(role ?? "").toLowerCase())
  );
}

function snippet(value: unknown, max = 700) {
  const clean = stripHtml(value).replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

function stripHtml(value: unknown) {
  const text = String(value ?? "");
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeHtml(value: unknown) {
  return /<!doctype html|<html[\s>]|<body[\s>]|<script[\s>]/i.test(
    String(value ?? ""),
  );
}

function cleanDocumentUrl(value: unknown) {
  const url = typeof value === "string" ? value : "";
  if (!url || /infranodus\.com/i.test(url)) return "";
  return url;
}

function canAccessDocument(ctx: Required<ToolContext>, row: DbRow) {
  const accessLevel = String(row.access_level ?? "internal").toLowerCase();
  if (accessLevel === "admin") return isManagerRole(ctx.role);
  if (accessLevel === "management") return isManagerRole(ctx.role);
  if (accessLevel === "department") {
    return (
      !row.department ||
      row.department === ctx.department ||
      isPrivilegedDocumentRole(ctx.role)
    );
  }
  if (accessLevel === "private") {
    return (
      row.uploaded_by === ctx.userId || isPrivilegedDocumentRole(ctx.role)
    );
  }
  return true;
}

function secondsBetween(start: string, end = new Date().toISOString()) {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

function readDateString(
  payload: Record<string, unknown>,
  key: string,
  fallback?: string,
) {
  const value = readString(payload, key);
  if (!value) return fallback ?? null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback ?? null;
  return value.length <= 10
    ? `${value.slice(0, 10)}T00:00:00.000Z`
    : date.toISOString();
}

function readEndDateString(payload: Record<string, unknown>, key: string) {
  const value = readString(payload, key);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return value.length <= 10
    ? `${value.slice(0, 10)}T23:59:59.999Z`
    : date.toISOString();
}

function defaultFromDate(daysBack: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysBack);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

function defaultToDate() {
  const date = new Date();
  date.setUTCHours(23, 59, 59, 999);
  return date.toISOString();
}

function harareDateKey(value: string | Date = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime()))
    return new Date().toISOString().slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Harare",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function harareDayRange(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, -2, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, -2, 0, 0, -1));
  return { from: start.toISOString(), to: end.toISOString() };
}

function readDateRange(payload: Record<string, unknown>, defaultDaysBack = 7) {
  const from =
    readDateString(payload, "from") ??
    readDateString(payload, "start_date") ??
    readDateString(payload, "startDate") ??
    defaultFromDate(defaultDaysBack);
  const to =
    readEndDateString(payload, "to") ??
    readEndDateString(payload, "end_date") ??
    readEndDateString(payload, "endDate") ??
    defaultToDate();
  return { from, to };
}

function profileDisplayName(
  profile: Record<string, unknown> | null | undefined,
) {
  return String(
    profile?.username ??
      profile?.full_name ??
      profile?.email ??
      "Unknown user",
  );
}

function buildTaskLink(boardId: unknown, taskId: unknown) {
  if (typeof boardId === "string" && typeof taskId === "string") {
    return `/boards/${boardId}?cardId=${taskId}`;
  }
  if (typeof taskId === "string") return `/tasks/${taskId}`;
  return null;
}

function escapeIlike(value: string) {
  return value.replace(/[%_\\]/g, (match) => `\\${match}`);
}

function readFirstString(
  payload: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = readString(payload, key);
    if (value) return value;
  }
  return null;
}

function extractEmailFromText(value: string) {
  return (
    value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null
  );
}

function extractNamedUserFromText(value: string) {
  const match = value.match(
    /\b(?:for|user|employee|assign(?:ed)?\s+(?:him|her|them)?\s*to)\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})(?=\s+(?:now|on|under|to|and|please|at|$)|[,.?!]|$)/i,
  );
  const possessive = value.match(
    /\b([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2})['']s\s+(?:timer|time)\b/i,
  );
  return match?.[1]?.trim() ?? possessive?.[1]?.trim() ?? null;
}

function extractTaskTitleFromText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  const match =
    normalized.match(
      /\b(?:card|task)\s*(?:called|named|titled|is)?\s*["']?([^"',?.]{3,180})/i,
    ) ?? normalized.match(/\bnamed\s+["']?([^"',?.]{3,180})/i);

  const raw = match?.[1]?.trim() ?? "";
  if (!raw) return null;

  const cleaned = raw
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
    .replace(
      /\b(?:for|this|user|employee|assign|assigned|him|her|them|to|timer|time|tracking|track|start|begin|please|now)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || null;
}

function normalizeOfficeMention(value: string) {
  const lower = value.toLowerCase();
  if (/three\s+little\s+birds|\btlb\b/.test(lower)) return "three-little-birds";
  if (
    /its\s*no\s*matata|it's\s*no\s*matata|itsnomatata|it'?s\s+nomatata/.test(
      lower,
    )
  ) {
    return "its-no-matata";
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Database helpers
// ─────────────────────────────────────────────────────────────────────────────

async function fetchProfilesByIds(
  adminClient: any,
  organizationId: string,
  userIds: string[],
) {
  const ids = [...new Set(userIds.filter(Boolean))];
  const profilesById = new Map<string, Record<string, unknown>>();
  if (ids.length === 0) return profilesById;

  const { data, error } = await adminClient
    .from("profiles")
    .select(
      "id, email, full_name, username, avatar_url, primary_role, department, office_id",
    )
    .eq("organization_id", organizationId)
    .in("id", ids);

  if (error) throw error;
  for (const profile of data ?? []) {
    profilesById.set(profile.id as string, profile);
  }
  return profilesById;
}

async function fetchAssignedTaskIds(
  adminClient: any,
  organizationId: string,
  userId: string,
) {
  const { data, error } = await adminClient
    .from("task_assignees")
    .select("task_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .limit(500);

  if (error) throw error;
  return ((data ?? []) as DbRow[])
    .map((row) => String(row.task_id ?? ""))
    .filter(Boolean);
}

async function resolveBoardId(
  adminClient: any,
  organizationId: string,
  payload: Record<string, unknown>,
) {
  const boardId = normalizeUuid(payload.board_id ?? payload.boardId);
  if (boardId) {
    const { data } = await adminClient
      .from("clients")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("id", boardId)
      .maybeSingle();
    if (data?.id) return data;
  }

  const boardName =
    readString(payload, "board_name") ?? readString(payload, "boardName");
  if (!boardName) return null;

  const { data } = await adminClient
    .from("clients")
    .select("id, name")
    .eq("organization_id", organizationId)
    .ilike("name", `%${boardName}%`)
    .order("name", { ascending: true })
    .limit(5);

  const exact = ((data ?? []) as DbRow[]).find(
    (row) =>
      String(row.name ?? "").toLowerCase() === boardName.toLowerCase(),
  );
  return exact ?? data?.[0] ?? null;
}

async function resolveOfficeForPayload(
  adminClient: any,
  organizationId: string,
  payload: Record<string, unknown>,
) {
  const explicitOffice = readNestedString(payload, [
    "office",
    "office_name",
    "officeName",
    "company",
    "office_slug",
    "officeSlug",
  ]);
  const originalMessage = readString(payload, "originalMessage") ?? "";
  const officeSlug = normalizeOfficeMention(
    [explicitOffice, originalMessage].filter(Boolean).join(" "),
  );
  const officeText = explicitOffice || officeSlug;

  if (/\b(both|all|two)\s+offices\b/i.test(originalMessage)) return null;
  if (!officeText && !officeSlug) return null;

  let query = adminClient
    .from("company_offices")
    .select("id, name, slug")
    .eq("organization_id", organizationId)
    .limit(5);

  if (officeSlug) {
    query = query.eq("slug", officeSlug);
  } else if (officeText) {
    query = query.or(`name.ilike.%${officeText}%,slug.ilike.%${officeText}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as DbRow[])[0] ?? null;
}

async function resolveAssigneeIds(
  adminClient: any,
  organizationId: string,
  payload: Record<string, unknown>,
) {
  const ids = new Set<string>();

  const directIds = payload.assignee_user_ids ?? payload.assigneeIds;
  if (Array.isArray(directIds)) {
    for (const entry of directIds) {
      const id = normalizeUuid(entry);
      if (id) ids.add(id);
    }
  }

  const singleId = normalizeUuid(
    payload.assignee_user_id ??
      payload.assigneeUserId ??
      payload.assigned_to,
  );
  if (singleId) ids.add(singleId);

  const email =
    readString(payload, "assignee_email") ??
    readString(payload, "assigneeEmail");
  if (email) {
    const { data } = await adminClient
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (data?.id) ids.add(data.id as string);
  }

  const name =
    readString(payload, "assignee_name") ??
    readString(payload, "assigneeName");
  if (name) {
    const { data } = await adminClient
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId)
      .ilike("full_name", `%${name}%`)
      .limit(1)
      .maybeSingle();
    if (data?.id) ids.add(data.id as string);
  }

  return [...ids];
}

async function resolveTimerTaskContext(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
  taskId: string | null,
  targetUserId?: string | null,
) {
  let query = adminClient
    .from("tasks")
    .select(
      "id, title, status, client_id, project_id, campaign_id, office_id, assigned_to, created_by",
    )
    .eq("organization_id", ctx.organizationId)
    .is("archived_at", null)
    .not("status", "in", "(done,cancelled)")
    .limit(5);

  if (taskId) {
    query = query.eq("id", taskId);
  } else {
    const taskText = readFirstString(payload, [
      "task_title",
      "taskTitle",
      "task_name",
      "taskName",
      "card_title",
      "cardTitle",
      "card_name",
      "cardName",
      "query",
      "search",
    ]);
    if (!taskText) return { task: null, error: null };

    query = query.ilike("title", `%${escapeIlike(taskText)}%`);

    const boardId = normalizeUuid(
      payload.board_id ??
        payload.boardId ??
        payload.client_id ??
        payload.clientId,
    );
    if (boardId) query = query.eq("client_id", boardId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as DbRow[];
  if (rows.length === 0) {
    return {
      task: null,
      error: taskId ? "Task not found or not available for time tracking." : null,
    };
  }

  const accessUserId = targetUserId ?? ctx.userId;
  const assignedRows = await fetchAssignedTaskIds(
    adminClient,
    ctx.organizationId,
    accessUserId,
  );
  const assignedTaskIds = new Set(assignedRows);
  const accessibleRows = rows.filter(
    (row) =>
      row.assigned_to === accessUserId ||
      row.created_by === accessUserId ||
      assignedTaskIds.has(String(row.id)) ||
      isManagerRole(ctx.role),
  );

  if (accessibleRows.length === 0) {
    return {
      task: null,
      error: targetUserId
        ? "No matching task assigned to that user was found."
        : "No matching task assigned to you was found.",
    };
  }

  if (!taskId && accessibleRows.length > 1) {
    return {
      task: null,
      error:
        "More than one matching task was found. Please include the exact card or task link.",
      matches: accessibleRows.map((row) => ({
        taskId: row.id,
        title: row.title,
        boardId: row.client_id,
      })),
    };
  }

  return { task: accessibleRows[0], error: null };
}

async function insertTaskNotification(
  adminClient: any,
  params: {
    organizationId: string;
    userId: string;
    taskId: string;
    taskTitle: string;
    boardId: string;
    actorUserId: string;
    actorName: string | null;
  },
) {
  await adminClient.from("notifications").insert({
    organization_id: params.organizationId,
    user_id: params.userId,
    type: "task_assigned",
    title: "New task assigned",
    message: params.actorName
      ? `${params.actorName} assigned you to "${params.taskTitle}".`
      : `You were assigned to: ${params.taskTitle}`,
    entity_type: "task",
    entity_id: params.taskId,
    action_url: buildBoardCardUrl(params.boardId, params.taskId),
    priority: "high",
    category: "tasks",
    actor_user_id: params.actorUserId,
    metadata: {
      taskId: params.taskId,
      taskTitle: params.taskTitle,
      boardId: params.boardId,
      clientId: params.boardId,
      actorUserId: params.actorUserId,
      source: "codex_execute_tool",
    },
    delivery_state: "pending",
    is_read: false,
  });
}

async function createDocumentQueryEmbedding(query: string) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: query.slice(0, 7000),
    }),
  });

  const data = await response.json();
  if (!response.ok) return null;
  const embedding = data.data?.[0]?.embedding;
  return Array.isArray(embedding) ? embedding : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool implementations
// ─────────────────────────────────────────────────────────────────────────────

async function toolSummarizeMyTasks(
  adminClient: any,
  ctx: Required<ToolContext>,
) {
  const [
    { data: primaryTasks, error: primaryError },
    { data: assigneeRows, error: assigneeError },
  ] = await Promise.all([
    adminClient
      .from("tasks")
      .select(
        "id, title, status, priority, due_date, client_id, assigned_to, created_at, updated_at",
      )
      .eq("organization_id", ctx.organizationId)
      .eq("assigned_to", ctx.userId)
      .limit(40),
    adminClient
      .from("task_assignees")
      .select("task_id")
      .eq("organization_id", ctx.organizationId)
      .eq("user_id", ctx.userId),
  ]);

  if (primaryError) throw primaryError;
  if (assigneeError) throw assigneeError;

  const assignedTaskIds = ((assigneeRows ?? []) as DbRow[]).map(
    (row) => row.task_id as string,
  );
  let collaboratorTasks: typeof primaryTasks = [];

  if (assignedTaskIds.length > 0) {
    const { data, error } = await adminClient
      .from("tasks")
      .select(
        "id, title, status, priority, due_date, client_id, assigned_to, created_at, updated_at",
      )
      .eq("organization_id", ctx.organizationId)
      .in("id", assignedTaskIds)
      .limit(40);
    if (error) throw error;
    collaboratorTasks = data ?? [];
  }

  const taskMap = new Map<string, Record<string, unknown>>();
  for (const task of [...(primaryTasks ?? []), ...collaboratorTasks]) {
    taskMap.set(task.id as string, task);
  }
  const tasks = [...taskMap.values()];
  const openTasks = tasks.filter(
    (task) => !CLOSED_STATUSES.has(String(task.status ?? "")),
  );
  const overdue = openTasks.filter((task) => {
    if (!task.due_date) return false;
    return new Date(task.due_date as string).getTime() < Date.now();
  });

  const boardIds = [
    ...new Set(
      openTasks
        .map((task) => task.client_id as string | null)
        .filter(Boolean) as string[],
    ),
  ];
  const boardNameById = new Map<string, string>();
  if (boardIds.length > 0) {
    const { data: boards } = await adminClient
      .from("clients")
      .select("id, name")
      .in("id", boardIds);
    for (const board of boards ?? []) {
      boardNameById.set(board.id as string, board.name as string);
    }
  }

  return {
    ok: true,
    summary: {
      totalOpen: openTasks.length,
      overdueCount: overdue.length,
      tasks: openTasks.slice(0, 15).map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.due_date,
        boardId: task.client_id,
        boardName: task.client_id
          ? boardNameById.get(task.client_id as string) ?? null
          : null,
        actionUrl: task.client_id
          ? buildBoardCardUrl(task.client_id as string, task.id as string)
          : `/tasks/${task.id}`,
      })),
    },
    message:
      openTasks.length === 0
        ? "You have no open assigned tasks."
        : `You have ${openTasks.length} open task(s), ${overdue.length} overdue.`,
  };
}

async function toolListBoards(
  adminClient: any,
  organizationId: string,
  payload: Record<string, unknown>,
) {
  const search =
    readString(payload, "search") ?? readString(payload, "query");
  let query = adminClient
    .from("clients")
    .select("id, name, status, office_id")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })
    .limit(25);

  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) throw error;

  return {
    ok: true,
    boards: ((data ?? []) as DbRow[]).map((board) => ({
      id: board.id,
      name: board.name,
      status: board.status,
    })),
    message: `${data?.length ?? 0} board(s) found.`,
  };
}

async function toolGetActiveTimeTrackers(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown> = {},
) {
  const scope = String(payload.scope ?? "").toLowerCase();

  const personalScope =
    scope === "me" ||
    scope === "current_user" ||
    payload.currentUserOnly === true;

  const includeNotTracking =
    payload.include_not_tracking === true ||
    payload.includeNotTracking === true ||
    String(payload.mode ?? "").toLowerCase() === "not_tracking";

  const hasTargetPerson = Boolean(
    payload.userId ||
      payload.user_id ||
      payload.userEmail ||
      payload.user_email ||
      payload.email ||
      payload.userName ||
      payload.user_name ||
      payload.name ||
      payload.assigneeName ||
      payload.assignee_name ||
      payload.assigneeEmail ||
      payload.assignee_email,
  );

  const targetProfile =
    hasTargetPerson && !personalScope
      ? await resolveTargetProfile(adminClient, ctx, payload)
      : null;

  let query = adminClient
    .from("time_entries")
    .select(
      "id, user_id, task_id, client_id, project_id, description, started_at, duration_seconds, is_running",
    )
    .eq("organization_id", ctx.organizationId)
    .eq("is_running", true)
    .is("ended_at", null)
    .order("started_at", { ascending: true })
    .limit(100);

  if (personalScope) {
    query = query.eq("user_id", ctx.userId);
  } else if (targetProfile?.id) {
    query = query.eq("user_id", targetProfile.id);
  } else if (!isManagerRole(ctx.role)) {
    query = query.eq("user_id", ctx.userId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as DbRow[];

  const profilesById = await fetchProfilesByIds(
    adminClient,
    ctx.organizationId,
    rows.map((row) => row.user_id as string),
  );

  const taskIds = [
    ...new Set(rows.map((row) => row.task_id).filter(Boolean) as string[]),
  ];

  const boardIds = [
    ...new Set(rows.map((row) => row.client_id).filter(Boolean) as string[]),
  ];

  const tasksById = new Map<string, DbRow>();
  const boardsById = new Map<string, DbRow>();

  if (taskIds.length > 0) {
    const { data: tasks, error: taskError } = await adminClient
      .from("tasks")
      .select("id, title, status")
      .eq("organization_id", ctx.organizationId)
      .in("id", taskIds);

    if (taskError) throw taskError;
    for (const task of tasks ?? []) tasksById.set(task.id as string, task);
  }

  if (boardIds.length > 0) {
    const { data: boards, error: boardError } = await adminClient
      .from("clients")
      .select("id, name")
      .eq("organization_id", ctx.organizationId)
      .in("id", boardIds);

    if (boardError) throw boardError;
    for (const board of boards ?? []) boardsById.set(board.id as string, board);
  }

  const trackers = rows.map((row) => {
    const profile = profilesById.get(row.user_id as string);
    const task = row.task_id ? tasksById.get(row.task_id as string) : null;
    const board = row.client_id ? boardsById.get(row.client_id as string) : null;

    const elapsedSeconds = row.started_at
      ? secondsBetween(row.started_at as string)
      : Number(row.duration_seconds ?? 0);

    return {
      entryId: row.id,
      userId: row.user_id,
      name: profileDisplayName(profile),
      email: profile?.email ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      role: profile?.primary_role ?? null,
      department: profile?.department ?? null,
      taskId: row.task_id,
      taskTitle: task?.title ?? null,
      taskStatus: task?.status ?? null,
      boardId: row.client_id,
      boardName: board?.name ?? null,
      taskUrl: buildTaskLink(row.client_id, row.task_id),
      boardUrl:
        typeof row.client_id === "string" ? `/boards/${row.client_id}` : null,
      description: row.description,
      startedAt: row.started_at,
      elapsedSeconds,
    };
  });

  const activeUserIds = new Set(trackers.map((t) => String(t.userId)));

  let notTracking: Array<Record<string, unknown>> = [];
  let peopleCount = activeUserIds.size;

  if (includeNotTracking) {
    let peopleQuery = adminClient
      .from("profiles")
      .select(
        "id, email, full_name, username, avatar_url, primary_role, department, job_title, is_active, account_status, is_suspended",
      )
      .eq("organization_id", ctx.organizationId)
      .order("full_name", { ascending: true })
      .limit(250);

    if (personalScope) {
      peopleQuery = peopleQuery.eq("id", ctx.userId);
    } else if (targetProfile?.id) {
      peopleQuery = peopleQuery.eq("id", targetProfile.id);
    } else if (!isManagerRole(ctx.role)) {
      peopleQuery = peopleQuery.eq("id", ctx.userId);
    } else {
      peopleQuery = peopleQuery
        .eq("account_status", "active")
        .eq("is_suspended", false);
    }

    const { data: people, error: peopleError } = await peopleQuery;
    if (peopleError) throw peopleError;

    const employees = ((people ?? []) as DbRow[]).filter((profile) => {
      if (profile.is_active === false) return false;
      if (profile.account_status && profile.account_status !== "active") return false;
      if (profile.is_suspended === true) return false;
      return true;
    });

    peopleCount = employees.length;

    notTracking = employees
      .filter((profile) => !activeUserIds.has(String(profile.id)))
      .map((profile) => ({
        userId: profile.id,
        name: profileDisplayName(profile),
        email: profile.email ?? null,
        avatarUrl: profile.avatar_url ?? null,
        role: profile.primary_role ?? null,
        department: profile.department ?? null,
        jobTitle: profile.job_title ?? null,
      }));
  }

  return {
    ok: true,
    scope: personalScope ? "me" : targetProfile?.id ? "person" : "team",
    count: trackers.length,
    activeCount: trackers.length,
    peopleCount,
    notTrackingCount: notTracking.length,
    trackers,
    notTracking,
    message: includeNotTracking
      ? `${trackers.length} user(s) are tracking time and ${notTracking.length} are not tracking.`
      : personalScope && trackers.length === 0
        ? "You do not currently have an active timer running."
        : targetProfile?.id && trackers.length === 0
          ? `${profileDisplayName(targetProfile)} is not currently tracking time.`
          : trackers.length === 0
            ? "No one is currently tracking time."
            : `${trackers.length} user(s) are currently tracking time.`,
  };
}

async function toolGetUserTimesheet(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const originalMessage = String(payload.originalMessage ?? "");

  const scope = String(payload.scope ?? "").toLowerCase();

  const currentUserOnly =
    scope === "me" ||
    scope === "current_user" ||
    payload.currentUserOnly === true ||
    /\b(my|me|mine|myself|i)\b/i.test(originalMessage);

  const profile = currentUserOnly
    ? await resolveTargetProfile(adminClient, ctx, {
        userId: ctx.userId,
        user_id: ctx.userId,
      })
    : await resolveTargetProfile(adminClient, ctx, payload);

  if (!profile?.id) return { ok: false, error: "User not found." };

  const daysBack =
    typeof payload.daysBack === "number"
      ? payload.daysBack
      : typeof payload.days_back === "number"
        ? payload.days_back
        : /\b(two|2)\s+weeks?\b/i.test(originalMessage)
          ? 14
          : /\bweek(ly)?\b/i.test(originalMessage)
            ? 7
            : 7;

  const { from, to } = readDateRange(payload, daysBack);

  const { data, error } = await adminClient
    .from("time_entries")
    .select(
      "id, task_id, client_id, project_id, description, started_at, ended_at, duration_seconds, is_running, is_billable, approval_status, source",
    )
    .eq("organization_id", ctx.organizationId)
    .eq("user_id", profile.id)
    .gte("started_at", from)
    .lte("started_at", to)
    .order("started_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  const entries = (data ?? []) as DbRow[];

  const taskIds = [
    ...new Set(
      entries
        .map((row) => row.task_id as string | null)
        .filter(Boolean) as string[],
    ),
  ];

  const boardIds = [
    ...new Set(
      entries
        .map((row) => row.client_id as string | null)
        .filter(Boolean) as string[],
    ),
  ];

  const tasksById = new Map<string, DbRow>();
  const boardsById = new Map<string, DbRow>();

  if (taskIds.length > 0) {
    const { data: tasks, error: taskError } = await adminClient
      .from("tasks")
      .select("id, title, client_id")
      .eq("organization_id", ctx.organizationId)
      .in("id", taskIds);

    if (taskError) throw taskError;

    for (const task of tasks ?? []) {
      tasksById.set(task.id as string, task);
      if (task.client_id) boardIds.push(task.client_id as string);
    }
  }

  const uniqueBoardIds = [...new Set(boardIds.filter(Boolean))];

  if (uniqueBoardIds.length > 0) {
    const { data: boards, error: boardError } = await adminClient
      .from("clients")
      .select("id, name")
      .eq("organization_id", ctx.organizationId)
      .in("id", uniqueBoardIds);

    if (boardError) throw boardError;

    for (const board of boards ?? []) {
      boardsById.set(board.id as string, board);
    }
  }

  const normalizedEntries = entries.map((entry) => {
    const task = entry.task_id
      ? tasksById.get(entry.task_id as string)
      : null;

    const resolvedBoardId =
      entry.client_id ?? task?.client_id ?? null;

    const seconds =
      entry.is_running && entry.started_at
        ? secondsBetween(entry.started_at as string)
        : Number(entry.duration_seconds ?? 0);

    return {
      id: entry.id,
      taskId: entry.task_id,
      taskTitle: entry.task_id
        ? tasksById.get(entry.task_id as string)?.title ?? null
        : null,
      boardId: resolvedBoardId,
      boardName: resolvedBoardId
        ? boardsById.get(resolvedBoardId as string)?.name ?? null
        : null,
      taskUrl: buildTaskLink(resolvedBoardId, entry.task_id),
      boardUrl:
        typeof resolvedBoardId === "string"
          ? `/boards/${resolvedBoardId}`
          : null,
      description: entry.description,
      startedAt: entry.started_at,
      endedAt: entry.ended_at,
      durationSeconds: seconds,
      durationHours: Number((seconds / 3600).toFixed(2)),
      isRunning: entry.is_running,
      isBillable: entry.is_billable,
      approvalStatus: entry.approval_status,
      source: entry.source,
    };
  });

  const totalSeconds = normalizedEntries.reduce(
    (sum, entry) => sum + Number(entry.durationSeconds ?? 0),
    0,
  );

  return {
    ok: true,
    user: {
      id: profile.id,
      name: profileDisplayName(profile),
      email: profile.email ?? null,
      avatarUrl: profile.avatar_url ?? null,
      role: profile.primary_role ?? null,
      department: profile.department ?? null,
    },
    range: { from, to, daysBack },
    totalSeconds,
    totalHours: Number((totalSeconds / 3600).toFixed(2)),
    entryCount: normalizedEntries.length,
    entries: normalizedEntries,
    message:
      normalizedEntries.length === 0
        ? `${profileDisplayName(profile)} has no time entries in this period.`
        : `${profileDisplayName(profile)} tracked ${(
            totalSeconds / 3600
          ).toFixed(2)} hour(s) in this period.`,
  };
}

async function toolGetAttendanceSummary(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const explicitFrom = readString(payload, "from");
  const explicitTo = readString(payload, "to");
  const dateKey = (
    readString(payload, "date") ??
    readString(payload, "attendance_date") ??
    (explicitFrom ? harareDateKey(explicitFrom) : harareDateKey())
  ).slice(0, 10);
  const defaultRange = harareDayRange(dateKey);
  const from = explicitFrom ?? defaultRange.from;
  const to = explicitTo ?? defaultRange.to;
  const fromDateKey = harareDateKey(from);
  const toDateKey = harareDateKey(to);

  const hasTargetUser = Boolean(
    normalizeUuid(
      payload.user_id ??
        payload.userId ??
        payload.employee_id ??
        payload.employeeId,
    ) ||
      readString(payload, "user_name") ||
      readString(payload, "userName") ||
      readString(payload, "employee_name") ||
      readString(payload, "employeeName") ||
      readString(payload, "email") ||
      readString(payload, "user_email") ||
      readString(payload, "userEmail"),
  );

  const teamView = isManagerRole(ctx.role) && !hasTargetUser;
  const targetProfile = teamView
    ? null
    : await resolveTargetProfile(adminClient, ctx, payload);

  let query = adminClient
    .from("attendance_daily_status")
    .select(
      "id, user_id, attendance_date, status, expected_clock_in_at, actual_clock_in_at, notes",
    )
    .eq("organization_id", ctx.organizationId)
    .gte("attendance_date", fromDateKey)
    .lte("attendance_date", toDateKey)
    .order("attendance_date", { ascending: false })
    .limit(300);

  if (!teamView)
    query = query.eq("user_id", targetProfile?.id ?? ctx.userId);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as DbRow[];
  const profilesById = await fetchProfilesByIds(
    adminClient,
    ctx.organizationId,
    rows.map((row) => row.user_id as string),
  );
  const profileOfficeIds = [
    ...new Set(
      [...profilesById.values()]
        .map((p) => p.office_id as string | null)
        .filter(Boolean) as string[],
    ),
  ];
  const officesById = new Map<string, DbRow>();
  if (profileOfficeIds.length > 0) {
    const { data: offices, error: officeError } = await adminClient
      .from("company_offices")
      .select("id, name, slug")
      .eq("organization_id", ctx.organizationId)
      .in("id", profileOfficeIds);
    if (officeError) throw officeError;
    for (const officeRow of offices ?? []) {
      officesById.set(officeRow.id as string, officeRow);
    }
  }

  let sessionsQuery = adminClient
    .from("attendance_sessions")
    .select("id, user_id, clock_in_at, clock_out_at, status")
    .eq("organization_id", ctx.organizationId)
    .gte("clock_in_at", from)
    .lte("clock_in_at", to)
    .order("clock_in_at", { ascending: true })
    .limit(300);

  if (!teamView)
    sessionsQuery = sessionsQuery.eq(
      "user_id",
      targetProfile?.id ?? ctx.userId,
    );

  const { data: sessionData, error: sessionError } = await sessionsQuery;
  if (sessionError) throw sessionError;
  const sessionsByUser = new Map<string, DbRow>();
  for (const session of (sessionData ?? []) as DbRow[]) {
    const userId = session.user_id as string;
    const current = sessionsByUser.get(userId);
    if (
      !current ||
      String(session.clock_in_at ?? "") < String(current.clock_in_at ?? "")
    ) {
      sessionsByUser.set(userId, session);
    }
  }

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    const status = String(row.status ?? "unknown");
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    ok: true,
    range: { from, to, date: dateKey, timezone: "Africa/Harare" },
    counts,
    records: rows.map((row) => {
      const profile = profilesById.get(row.user_id as string);
      const profileOffice = profile?.office_id
        ? officesById.get(profile.office_id as string)
        : null;
      const session = sessionsByUser.get(row.user_id as string);
      return {
        id: row.id,
        userId: row.user_id,
        name: profileDisplayName(profile),
        office: profileOffice?.name ?? null,
        profileOffice: profileOffice?.name ?? null,
        profileOfficeSlug: profileOffice?.slug ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        date: row.attendance_date,
        status: row.status,
        expectedClockInAt: row.expected_clock_in_at,
        actualClockInAt:
          row.actual_clock_in_at ?? session?.clock_in_at ?? null,
        clockInAt: row.actual_clock_in_at ?? session?.clock_in_at ?? null,
        actualClockOutAt: session?.clock_out_at ?? null,
        clockOutAt: session?.clock_out_at ?? null,
        notes: row.notes,
      };
    }),
    message:
      rows.length === 0
        ? "No attendance records were found for today."
        : `${rows.length} attendance record(s) found.`,
  };
}

// ─── Leave balance ─────────────────────────────────────────────────────────────
//
// FIX: resolveTargetProfile is called with the payload from ai-router which now
// always sets BOTH userName AND assigneeName together, preventing the split
// where one field pointed to the wrong person.
//
async function toolGetLeaveBalance(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const profile = await resolveTargetProfile(adminClient, ctx, payload);
  if (!profile?.id) return { ok: false, error: "User not found." };

  const totalDays = Number(profile.leave_days_total ?? 22);

  const { data: requests, error } = await adminClient
    .from("leave_requests")
    .select(
      "id, start_date, end_date, requested_days, status, reason, created_at",
    )
    .eq("organization_id", ctx.organizationId)
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const approvedRequests = ((requests ?? []) as DbRow[]).filter(
    (request) =>
      String(request.status ?? "").toLowerCase() === "approved",
  );

  const usedDays = approvedRequests.reduce((sum, request) => {
    return sum + Number(request.requested_days ?? 0);
  }, 0);

  const remainingDays = Math.max(totalDays - usedDays, 0);

  return {
    ok: true,
    user: {
      id: profile.id,
      name: profileDisplayName(profile),
      email: profile.email ?? null,
      avatarUrl: profile.avatar_url ?? null,
      role: profile.primary_role ?? null,
      department: profile.department ?? null,
    },
    balance: { totalDays, remainingDays, usedDays },
    recentRequests: requests ?? [],
    message: `${profileDisplayName(profile)} has ${remainingDays} leave day(s) remaining.`,
  };
}

async function toolGetBoardTaskSummary(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const board = await resolveBoardId(adminClient, ctx.organizationId, payload);
  if (!board?.id) {
    return {
      ok: false,
      error:
        "board_id or board_name is required and must match an existing board.",
    };
  }

  const { data, error } = await adminClient
    .from("tasks")
    .select(
      "id, title, status, priority, due_date, assigned_to, created_at, updated_at",
    )
    .eq("organization_id", ctx.organizationId)
    .eq("client_id", board.id)
    .order("updated_at", { ascending: false })
    .limit(300);

  if (error) throw error;

  const tasks = (data ?? []) as DbRow[];
  const statusCounts = tasks.reduce<Record<string, number>>((acc, task) => {
    const status = String(task.status ?? "unknown");
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  const priorityCounts = tasks.reduce<Record<string, number>>((acc, task) => {
    const priority = String(task.priority ?? "none");
    acc[priority] = (acc[priority] ?? 0) + 1;
    return acc;
  }, {});
  const openTasks = tasks.filter(
    (task) => !CLOSED_STATUSES.has(String(task.status ?? "")),
  );
  const overdueTasks = openTasks.filter(
    (task) =>
      task.due_date &&
      new Date(task.due_date as string).getTime() < Date.now(),
  );
  const profilesById = await fetchProfilesByIds(
    adminClient,
    ctx.organizationId,
    tasks
      .map((task) => task.assigned_to as string | null)
      .filter(Boolean) as string[],
  );

  return {
    ok: true,
    board: { id: board.id, name: board.name },
    totals: {
      totalTasks: tasks.length,
      openTasks: openTasks.length,
      overdueTasks: overdueTasks.length,
      statusCounts,
      priorityCounts,
    },
    tasks: tasks.slice(0, 40).map((task) => {
      const assignee = task.assigned_to
        ? profilesById.get(task.assigned_to as string)
        : null;
      return {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.due_date,
        assigneeId: task.assigned_to,
        assigneeName: assignee ? profileDisplayName(assignee) : null,
        assigneeAvatarUrl: assignee?.avatar_url ?? null,
        actionUrl: buildBoardCardUrl(board.id as string, task.id as string),
      };
    }),
    message: `${board.name} has ${tasks.length} task(s), ${overdueTasks.length} overdue.`,
  };
}

async function toolCreateBoardCard(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
  dryRun: boolean,
) {
  const title = readString(payload, "title");
  if (!title) return { ok: false, error: "title is required." };

  const board = await resolveBoardId(adminClient, ctx.organizationId, payload);
  if (!board?.id) {
    return {
      ok: false,
      error:
        "board_id or board_name is required and must match an existing board.",
    };
  }

  const assigneeIds = await resolveAssigneeIds(
    adminClient,
    ctx.organizationId,
    payload,
  );
  const primaryAssignee = assigneeIds[0] ?? null;
  const priority = normalizePriority(payload.priority);
  const dueDateRaw =
    readString(payload, "due_date") ?? readString(payload, "dueDate");
  const dueDate = dueDateRaw
    ? new Date(`${dueDateRaw.slice(0, 10)}T15:00:00.000Z`).toISOString()
    : null;
  const description = readString(payload, "description");
  const canCreateDirectly = isManagerRole(ctx.role);

  const preview = {
    boardId: board.id,
    boardName: board.name,
    title,
    description,
    priority,
    dueDate,
    assigneeIds,
    requiresApproval: !canCreateDirectly,
  };

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      preview,
      message: canCreateDirectly
        ? "Ready to create this card."
        : "This card would be submitted for manager approval.",
    };
  }

  if (!canCreateDirectly) {
    const { data: suggestion, error } = await adminClient
      .from("ai_task_suggestions")
      .insert({
        organization_id: ctx.organizationId,
        source: "codex_chat",
        suggested_title: title,
        suggested_description: description,
        suggested_priority: priority,
        suggested_assignee: primaryAssignee,
        suggested_due_date: dueDate,
        suggested_department: ctx.department,
        requires_approval: true,
        reason: "Codex created this task suggestion from chat.",
        status: "pending",
        created_by: ctx.userId,
        metadata: {
          board_id: board.id,
          board_name: board.name,
          assignee_ids: assigneeIds,
        },
      })
      .select("id, suggested_title")
      .single();

    if (error) throw error;

    return {
      ok: true,
      requiresApproval: true,
      suggestionId: suggestion.id,
      preview,
      actionUrl: "/ai-automation-review",
      message: `Task suggestion "${suggestion.suggested_title}" was sent for approval.`,
    };
  }

  const { data: boardRow } = await adminClient
    .from("clients")
    .select("office_id")
    .eq("id", board.id)
    .maybeSingle();

  let officeId = boardRow?.office_id ?? null;
  if (!officeId) {
    const { data: profileRow } = await adminClient
      .from("profiles")
      .select("office_id")
      .eq("id", ctx.userId)
      .maybeSingle();
    officeId = profileRow?.office_id ?? null;
  }

  const { data: card, error: cardError } = await adminClient
    .from("tasks")
    .insert({
      organization_id: ctx.organizationId,
      office_id: officeId,
      client_id: board.id,
      title,
      description,
      status: readString(payload, "status") ?? "todo",
      priority,
      assigned_to: primaryAssignee,
      assigned_by: ctx.userId,
      created_by: ctx.userId,
      due_date: dueDate,
      position: 0,
      ai_generated: true,
      metadata: { source: "codex_execute_tool" },
    })
    .select("id, title, client_id")
    .single();

  if (cardError) throw cardError;

  if (assigneeIds.length > 0) {
    await adminClient.from("task_assignees").upsert(
      assigneeIds.map((userId) => ({
        organization_id: ctx.organizationId,
        task_id: card.id,
        user_id: userId,
      })),
      { onConflict: "organization_id,task_id,user_id", ignoreDuplicates: true },
    );

    for (const assigneeId of assigneeIds.filter((id) => id !== ctx.userId)) {
      try {
        await insertTaskNotification(adminClient, {
          organizationId: ctx.organizationId,
          userId: assigneeId,
          taskId: card.id,
          taskTitle: title,
          boardId: board.id as string,
          actorUserId: ctx.userId,
          actorName: ctx.fullName ?? null,
        });
      } catch (notifError) {
        console.warn("codex-execute-tool notification failed:", notifError);
      }
    }
  }

  const actionUrl = buildBoardCardUrl(board.id as string, card.id as string);
  const shouldStartTimer =
    payload.startTimer === true ||
    payload.start_timer === true ||
    /\b(start|begin|track|tracking)\b.*\b(timer|time tracker|time tracking|time)\b/i.test(
      readString(payload, "originalMessage") ?? "",
    );

  let timerResult: Record<string, unknown> | null = null;
  if (shouldStartTimer) {
    timerResult = await toolStartTimeTracker(
      adminClient,
      ctx,
      {
        ...payload,
        taskId: card.id,
        task_id: card.id,
        boardId: board.id,
        board_id: board.id,
        clientId: board.id,
        client_id: board.id,
        taskTitle: card.title,
        cardTitle: card.title,
        description:
          readString(payload, "timerDescription") ??
          readString(payload, "description") ??
          `Work on ${card.title}`,
      },
      false,
    );
  }

  return {
    ok: true,
    taskId: card.id,
    boardId: board.id,
    boardName: board.name,
    actionUrl,
    timer: timerResult,
    preview,
    message:
      timerResult?.ok === true
        ? `Created card "${card.title}" on board "${board.name}" and started the timer.`
        : `Created card "${card.title}" on board "${board.name}".`,
  };
}

async function toolNotifyContentReview(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
  dryRun: boolean,
) {
  const draftId = normalizeUuid(payload.draft_id ?? payload.draftId);
  if (!draftId) return { ok: false, error: "draft_id is required." };

  const title = readString(payload, "title") ?? "Content review update";
  const message =
    readString(payload, "message") ??
    "There is an update on a content review draft.";
  const actionUrl = `/admin/content-studio/editor/${draftId}`;

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      draftId,
      message: "Would notify content review team.",
    };
  }

  const { data: draft, error: draftError } = await adminClient
    .from("content_review_drafts")
    .select("id, organization_id, created_by, assigned_to")
    .eq("id", draftId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (draftError) throw draftError;
  if (!draft) return { ok: false, error: "Content review draft not found." };

  const recipientIds = new Set<string>();
  if (draft.created_by) recipientIds.add(draft.created_by as string);
  if (draft.assigned_to) recipientIds.add(draft.assigned_to as string);

  const { data: admins } = await adminClient
    .from("profiles")
    .select("id, office_id")
    .eq("organization_id", ctx.organizationId)
    .eq("primary_role", "admin");

  const officeIds = [
    ...new Set(
      (admins ?? [])
        .map((admin: DbRow) => admin.office_id as string | null)
        .filter(Boolean) as string[],
    ),
  ];

  if (officeIds.length > 0) {
    const { data: offices } = await adminClient
      .from("company_offices")
      .select("id, slug")
      .in("id", officeIds);

    const itsNoMatataOfficeIds = new Set(
      (offices ?? [])
        .filter((office: DbRow) => office.slug === "its-no-matata")
        .map((office: DbRow) => office.id as string),
    );

    for (const admin of admins ?? []) {
      if (
        admin.office_id &&
        itsNoMatataOfficeIds.has(admin.office_id as string)
      ) {
        recipientIds.add(admin.id as string);
      }
    }
  }

  const notifications = [...recipientIds].map((userId) => ({
    organization_id: ctx.organizationId,
    user_id: userId,
    type: "system_alert",
    title,
    message,
    entity_type: "content_review_draft",
    entity_id: draftId,
    action_url: actionUrl,
    priority: "medium",
    category: "content_review",
    actor_user_id: ctx.userId,
    metadata: { draftId, source: "codex_execute_tool" },
    delivery_state: "pending",
    is_read: false,
  }));

  if (notifications.length > 0) {
    const { error } = await adminClient
      .from("notifications")
      .insert(notifications);
    if (error) throw error;
  }

  return {
    ok: true,
    draftId,
    actionUrl,
    recipientCount: notifications.length,
    message: `Notified ${notifications.length} team member(s) about the content draft.`,
  };
}

async function toolSearchNotifications(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const limit = typeof payload.limit === "number" ? payload.limit : 15;
  const unreadOnly = payload.unreadOnly === true;

  let query = adminClient
    .from("notifications")
    .select(
      "id, type, title, message, is_read, created_at, action_url, priority, category",
    )
    .eq("organization_id", ctx.organizationId)
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) query = query.eq("is_read", false);

  const { data, error } = await query;
  if (error) throw error;

  return {
    ok: true,
    notifications: data ?? [],
    count: data?.length ?? 0,
    unreadOnly,
  };
}
async function toolSearchAssets(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const listAll = payload.listAll === true || payload.list_all === true;

  const rawQuery =
    readString(payload, "query") ?? readString(payload, "search") ?? "";

  const queryText = listAll
    ? ""
    : rawQuery
        .replace(
          /\b(show|list|find|search|get|view|any|all|every|everything|the|me|my|mine|assets?|asset|equipment|stock|registered|system|on|in|please|for|of|company|office)\b/gi,
          " ",
        )
        .replace(/\s+/g, " ")
        .trim();

  const assetTag =
    readString(payload, "assetTag") ?? readString(payload, "asset_tag");

  const serialNumber =
    readString(payload, "serialNumber") ??
    readString(payload, "serial_number");

  const brand = readString(payload, "brand");
  const model = readString(payload, "model");
  const status = readString(payload, "status");

  const limit = Math.min(
    typeof payload.limit === "number" ? payload.limit : listAll ? 200 : 50,
    500,
  );

  let query = adminClient
    .from("assets")
    .select(
      "id, asset_name, asset_tag, serial_number, status, brand, model, condition, assigned_to, updated_at",
    )
    .eq("organization_id", ctx.organizationId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (queryText) {
    const normalized = queryText.toLowerCase();
    const terms = new Set<string>();

    terms.add(queryText);

    if (/macbook|mac book|apple laptop|apple|mac/.test(normalized)) {
      terms.add("macbook");
      terms.add("mac book");
      terms.add("mac");
      terms.add("apple");
      terms.add("laptop");
    }

    if (/laptop|notebook/.test(normalized)) {
      terms.add("laptop");
      terms.add("notebook");
      terms.add("computer");
    }

    const orFilter = [...terms]
      .map((term) => term.replace(/[%_,]/g, " ").trim())
      .filter(Boolean)
      .flatMap((term) => [
        `asset_name.ilike.%${term}%`,
        `asset_tag.ilike.%${term}%`,
        `serial_number.ilike.%${term}%`,
        `brand.ilike.%${term}%`,
        `model.ilike.%${term}%`,
      ])
      .join(",");

    if (orFilter) query = query.or(orFilter);
  }

  if (assetTag) query = query.ilike("asset_tag", `%${assetTag}%`);
  if (serialNumber) query = query.ilike("serial_number", `%${serialNumber}%`);
  if (brand) query = query.ilike("brand", `%${brand}%`);
  if (model) query = query.ilike("model", `%${model}%`);
  if (status) query = query.ilike("status", `%${status}%`);

  const { data, error } = await query;
  if (error) throw error;

  const assets = ((data ?? []) as DbRow[]).map((asset) => ({
    id: asset.id,
    name: asset.asset_name,
    assetName: asset.asset_name,
    assetTag: asset.asset_tag,
    serialNumber: asset.serial_number,
    status: asset.status,
    brand: asset.brand,
    model: asset.model,
    condition: asset.condition,
    assignedTo: asset.assigned_to,
    updatedAt: asset.updated_at,
    assetUrl: typeof asset.id === "string" ? `/assets/${asset.id}` : null,
  }));

  return {
    ok: true,
    assets,
    count: assets.length,
    filters: {
      listAll,
      query: queryText || null,
      rawQuery: rawQuery || null,
      assetTag: assetTag || null,
      serialNumber: serialNumber || null,
      brand: brand || null,
      model: model || null,
      status: status || null,
      limit,
    },
    message:
      assets.length === 0
        ? listAll
          ? "No assets are registered in the asset registry."
          : queryText
            ? `No assets matched "${queryText}".`
            : "No assets were found."
        : `Found ${assets.length} asset${assets.length === 1 ? "" : "s"}.`,
  };
}

async function toolSearchPeople(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const queryText =
    readString(payload, "query") ?? readString(payload, "search") ?? "";
  const department = readString(payload, "department");
  const role = readString(payload, "role");
  const status =
    readString(payload, "status") ??
    readString(payload, "account_status");
  const limit = Math.min(
    typeof payload.limit === "number" ? payload.limit : 25,
    75,
  );

  let query = adminClient
    .from("profiles")
    .select(
      "id, email, full_name, username, phone, avatar_url, job_title, department, primary_role, employee_code, last_seen_at, is_active, account_status, is_suspended, office_id",
    )
    .eq("organization_id", ctx.organizationId)
    .order("full_name", { ascending: true })
    .limit(limit);

  if (!isManagerRole(ctx.role)) {
    query = query.eq("account_status", "active").eq("is_suspended", false);
  }
  if (queryText) {
    query = query.or(
      `full_name.ilike.%${queryText}%,username.ilike.%${queryText}%,email.ilike.%${queryText}%,job_title.ilike.%${queryText}%,department.ilike.%${queryText}%`,
    );
  }
  if (department) query = query.ilike("department", `%${department}%`);
  if (role) query = query.eq("primary_role", role);
  if (status) query = query.eq("account_status", status);

  const { data, error } = await query;
  if (error) throw error;

  return {
    ok: true,
    people: ((data ?? []) as DbRow[]).map((profile) => ({
      id: profile.id,
      name: profileDisplayName(profile),
      email: profile.email,
      phone:
        isManagerRole(ctx.role) || profile.id === ctx.userId
          ? profile.phone
          : null,
      avatarUrl: profile.avatar_url,
      jobTitle: profile.job_title,
      department: profile.department,
      role: profile.primary_role,
      employeeCode: isManagerRole(ctx.role) ? profile.employee_code : null,
      lastSeenAt: profile.last_seen_at,
      isActive: profile.is_active,
      accountStatus: isManagerRole(ctx.role) ? profile.account_status : null,
      isSuspended: isManagerRole(ctx.role) ? profile.is_suspended : null,
    })),
    count: data?.length ?? 0,
    message: `${data?.length ?? 0} people found.`,
  };
}

async function toolSearchTasks(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const queryText =
    readString(payload, "query") ?? readString(payload, "search") ?? "";
  const status = readString(payload, "status");
  const priority = readString(payload, "priority");
  const boardId = normalizeUuid(
    payload.board_id ??
      payload.boardId ??
      payload.client_id ??
      payload.clientId,
  );
  const assignedTo = normalizeUuid(
    payload.assigned_to ??
      payload.assignedTo ??
      payload.user_id ??
      payload.userId,
  );
  const limit = Math.min(
    typeof payload.limit === "number" ? payload.limit : 30,
    75,
  );

  let query = adminClient
    .from("tasks")
    .select(
      "id, client_id, project_id, title, description, status, priority, assigned_to, created_by, department, due_date, completed_at, blocked_reason, tracked_seconds_cache, updated_at",
    )
    .eq("organization_id", ctx.organizationId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!isManagerRole(ctx.role)) {
    query = query.or(
      `assigned_to.eq.${ctx.userId},created_by.eq.${ctx.userId}`,
    );
  }
  if (queryText) {
    query = query.or(
      `title.ilike.%${queryText}%,description.ilike.%${queryText}%`,
    );
  }
  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (boardId) query = query.eq("client_id", boardId);
  if (assignedTo && isManagerRole(ctx.role)) {
    query = query.eq("assigned_to", assignedTo);
  }

  const { data, error } = await query;
  if (error) throw error;

  const tasks = (data ?? []) as DbRow[];
  const profilesById = await fetchProfilesByIds(
    adminClient,
    ctx.organizationId,
    tasks
      .map((task) => task.assigned_to as string | null)
      .filter(Boolean) as string[],
  );

  const boardIds = [
    ...new Set(
      tasks
        .map((task) => task.client_id as string | null)
        .filter(Boolean) as string[],
    ),
  ];
  const boardsById = new Map<string, DbRow>();
  if (boardIds.length > 0) {
    const { data: boards, error: boardError } = await adminClient
      .from("clients")
      .select("id, name")
      .eq("organization_id", ctx.organizationId)
      .in("id", boardIds);
    if (boardError) throw boardError;
    for (const board of boards ?? [])
      boardsById.set(board.id as string, board);
  }

  return {
    ok: true,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignedTo: task.assigned_to,
      assigneeName: task.assigned_to
        ? profileDisplayName(profilesById.get(task.assigned_to as string))
        : null,
      boardId: task.client_id,
      boardName: task.client_id
        ? boardsById.get(task.client_id as string)?.name ?? null
        : null,
      dueDate: task.due_date,
      completedAt: task.completed_at,
      blockedReason: task.blocked_reason,
      trackedSeconds: task.tracked_seconds_cache,
      taskUrl: buildTaskLink(task.client_id, task.id),
      updatedAt: task.updated_at,
    })),
    count: tasks.length,
    message: `${tasks.length} task(s) found.`,
  };
}

async function toolUpdateTask(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
  dryRun: boolean,
) {
  const taskId = normalizeUuid(
    payload.task_id ?? payload.taskId ?? payload.id,
  );
  if (!taskId) return { ok: false, error: "task_id is required." };

  const { data: task, error: taskError } = await adminClient
    .from("tasks")
    .select(
      "id, client_id, title, status, priority, assigned_to, created_by, due_date, description",
    )
    .eq("organization_id", ctx.organizationId)
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) throw taskError;
  if (!task) return { ok: false, error: "Task not found." };
  if (
    !isManagerRole(ctx.role) &&
    task.assigned_to !== ctx.userId &&
    task.created_by !== ctx.userId
  ) {
    return {
      ok: false,
      error: "You can only update tasks assigned to you or created by you.",
    };
  }

  const update: DbRow = {};
  const title = readString(payload, "title");
  const description =
    typeof payload.description === "string" ? payload.description : undefined;
  const status = readString(payload, "status");
  const priority = readString(payload, "priority");
  const dueDate =
    readString(payload, "due_date") ?? readString(payload, "dueDate");
  const assignedTo = normalizeUuid(
    payload.assigned_to ?? payload.assignedTo,
  );

  if (title) update.title = title;
  if (description !== undefined) update.description = description;
  if (status) {
    update.status = status;
    update.completed_at = CLOSED_STATUSES.has(status)
      ? new Date().toISOString()
      : null;
  }
  if (priority) update.priority = priority;
  if (dueDate) update.due_date = dueDate;
  if (assignedTo && isManagerRole(ctx.role)) update.assigned_to = assignedTo;
  update.updated_at = new Date().toISOString();

  if (Object.keys(update).length <= 1) {
    return { ok: false, error: "No supported task fields were provided." };
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      taskId,
      current: task,
      proposedChanges: update,
      message: `Would update "${task.title}".`,
    };
  }

  const { data: updated, error } = await adminClient
    .from("tasks")
    .update(update)
    .eq("organization_id", ctx.organizationId)
    .eq("id", taskId)
    .select(
      "id, client_id, title, status, priority, assigned_to, due_date, completed_at, updated_at",
    )
    .single();

  if (error) throw error;

  return {
    ok: true,
    task: updated,
    actionUrl: buildTaskLink(updated.client_id, updated.id),
    message: `Updated task "${updated.title}".`,
  };
}

async function toolSearchTimeEntries(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const { from, to } = readDateRange(payload, 14);
  const queryText =
    readString(payload, "query") ?? readString(payload, "search") ?? "";
  const targetProfile = await resolveTargetProfile(adminClient, ctx, payload);
  const limit = Math.min(
    typeof payload.limit === "number" ? payload.limit : 100,
    250,
  );

  let query = adminClient
    .from("time_entries")
    .select(
      "id, user_id, task_id, client_id, project_id, description, started_at, ended_at, duration_seconds, is_running, is_billable, approval_status, source",
    )
    .eq("organization_id", ctx.organizationId)
    .gte("started_at", from)
    .lte("started_at", to)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (targetProfile?.id) query = query.eq("user_id", targetProfile.id);
  if (queryText) query = query.ilike("description", `%${queryText}%`);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as DbRow[];
  const profilesById = await fetchProfilesByIds(
    adminClient,
    ctx.organizationId,
    rows
      .map((row) => row.user_id as string | null)
      .filter(Boolean) as string[],
  );
  const taskIds = [
    ...new Set(
      rows
        .map((row) => row.task_id as string | null)
        .filter(Boolean) as string[],
    ),
  ];
  const tasksById = new Map<string, DbRow>();
  if (taskIds.length > 0) {
    const { data: tasks, error: taskError } = await adminClient
      .from("tasks")
      .select("id, title, client_id")
      .eq("organization_id", ctx.organizationId)
      .in("id", taskIds);
    if (taskError) throw taskError;
    for (const task of tasks ?? []) tasksById.set(task.id as string, task);
  }

  const entries = rows.map((entry) => {
    const seconds =
      entry.is_running && entry.started_at
        ? secondsBetween(entry.started_at as string)
        : Number(entry.duration_seconds ?? 0);
    const profile = profilesById.get(entry.user_id as string);
    const task = entry.task_id
      ? tasksById.get(entry.task_id as string)
      : null;
    return {
      id: entry.id,
      userId: entry.user_id,
      userName: profileDisplayName(profile),
      taskId: entry.task_id,
      taskTitle: task?.title ?? null,
      boardId: entry.client_id ?? task?.client_id ?? null,
      description: entry.description,
      startedAt: entry.started_at,
      endedAt: entry.ended_at,
      durationSeconds: seconds,
      isRunning: entry.is_running,
      isBillable: entry.is_billable,
      approvalStatus: entry.approval_status,
      source: entry.source,
    };
  });

  const totalSeconds = entries.reduce(
    (sum, entry) => sum + Number(entry.durationSeconds ?? 0),
    0,
  );

  return {
    ok: true,
    range: { from, to },
    entries,
    count: entries.length,
    totalSeconds,
    totalHours: Number((totalSeconds / 3600).toFixed(2)),
    message: `${entries.length} time entr${
      entries.length === 1 ? "y" : "ies"
    } found.`,
  };
}

async function toolStartTimeTracker(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
  dryRun: boolean,
) {
  const originalMessage = readString(payload, "originalMessage") ?? "";
  const inferredEmail = originalMessage
    ? extractEmailFromText(originalMessage)
    : null;
  const inferredName = originalMessage
    ? extractNamedUserFromText(originalMessage)
    : null;
  const inferredTaskTitle = originalMessage
    ? extractTaskTitleFromText(originalMessage)
    : null;

  const explicitTarget = Boolean(
    inferredEmail ||
      inferredName ||
      readNestedString(payload, [
        "userId",
        "user_id",
        "targetUserId",
        "target_user_id",
        "employeeId",
        "employee_id",
        "userEmail",
        "user_email",
        "email",
        "employeeEmail",
        "employee_email",
        "assigneeEmail",
        "assignee_email",
        "userName",
        "user_name",
        "name",
        "employeeName",
        "employee_name",
        "assigneeName",
        "assignee_name",
      ]),
  );

  if (
    /\b(his|her|their)\s+time\b/i.test(originalMessage) &&
    !explicitTarget
  ) {
    return {
      ok: false,
      error:
        "Please include the user's name or email so I know whose timer to start.",
    };
  }

  const normalizedPayload = {
    ...payload,
    userEmail:
      readNestedString(payload, [
        "userEmail",
        "user_email",
        "email",
      ]) ?? inferredEmail,
    userName:
      readNestedString(payload, ["userName", "user_name", "name"]) ??
      inferredName,
    assigneeEmail:
      readNestedString(payload, [
        "assigneeEmail",
        "assignee_email",
      ]) ?? inferredEmail,
    assigneeName:
      readNestedString(payload, [
        "assigneeName",
        "assignee_name",
      ]) ?? inferredName,
    taskTitle:
      readNestedString(payload, [
        "taskTitle",
        "task_title",
        "cardTitle",
        "card_title",
        "query",
      ]) ?? inferredTaskTitle,
  };

  const targetProfile = await resolveTargetProfile(
    adminClient,
    ctx,
    normalizedPayload,
  );
  if (!targetProfile?.id) {
    return {
      ok: false,
      error: "I could not find that user in this organization.",
    };
  }
  if (targetProfile.id !== ctx.userId && !isManagerRole(ctx.role)) {
    return {
      ok: false,
      error: "Only a manager or admin can start a timer for another user.",
    };
  }

  const taskId = normalizeUuid(payload.task_id ?? payload.taskId);
  const payloadBoardId = normalizeUuid(
    payload.board_id ??
      payload.boardId ??
      payload.client_id ??
      payload.clientId,
  );
  const description =
    readString(payload, "description") ??
    readString(payload, "note") ??
    "Started from Codex assistant";
  const now = new Date().toISOString();
  const scheduledForText =
    readString(normalizedPayload, "scheduledFor") ??
    readString(normalizedPayload, "scheduled_for");

  const taskContext = await resolveTimerTaskContext(
    adminClient,
    ctx,
    normalizedPayload,
    taskId,
    targetProfile.id as string,
  );
  if (taskContext.error) {
    return {
      ok: false,
      error: taskContext.error,
      matches: taskContext.matches ?? undefined,
    };
  }
  const task = taskContext.task;
  const resolvedTaskId = task?.id ?? taskId;
  const resolvedBoardId = payloadBoardId ?? task?.client_id ?? null;

  if (scheduledForText) {
    const scheduledDate = new Date(scheduledForText);
    if (Number.isNaN(scheduledDate.getTime())) {
      return {
        ok: false,
        error: "I could not understand the scheduled time.",
      };
    }

    if (scheduledDate.getTime() > Date.now() + 30_000) {
      if (dryRun) {
        return {
          ok: true,
          dryRun: true,
          scheduledFor: scheduledDate.toISOString(),
          message: `Would schedule ${profileDisplayName(
            targetProfile,
          )}'s timer for ${scheduledDate.toISOString()}.`,
        };
      }

      const scheduledPayload = {
        ...normalizedPayload,
        scheduledFor: null,
        scheduled_for: null,
        taskId: resolvedTaskId,
        task_id: resolvedTaskId,
        boardId: resolvedBoardId,
        board_id: resolvedBoardId,
        clientId: resolvedBoardId,
        client_id: resolvedBoardId,
        description,
      };

      const { data: scheduledAction, error: scheduleError } = await adminClient
        .from("ai_scheduled_actions")
        .insert({
          organization_id: ctx.organizationId,
          office_id: ctx.officeId ?? null,
          user_id: targetProfile.id,
          created_by: ctx.userId,
          requested_by: ctx.userId,
          target_user_id: targetProfile.id,
          tool_id: "start_time_tracker",
          run_at: scheduledDate.toISOString(),
          scheduled_for: scheduledDate.toISOString(),
          payload: scheduledPayload,
          status: "pending",
          result: {},
        })
        .select("id, scheduled_for, run_at")
        .single();

      if (scheduleError) throw scheduleError;

      return {
        ok: true,
        scheduled: true,
        scheduledAction,
        user: {
          id: targetProfile.id,
          name: profileDisplayName(targetProfile),
          email: targetProfile.email ?? null,
        },
        actionUrl: buildTaskLink(resolvedBoardId, resolvedTaskId),
        message: `Scheduled ${profileDisplayName(
          targetProfile,
        )}'s timer for ${scheduledDate.toLocaleString("en-ZA", {
          timeZone: "Africa/Harare",
          dateStyle: "medium",
          timeStyle: "short",
        })}.`,
      };
    }
  }

  let officeId = task?.office_id ?? null;
  if (!officeId) {
    const { data: profileRow, error: profileError } = await adminClient
      .from("profiles")
      .select("office_id")
      .eq("organization_id", ctx.organizationId)
      .eq("id", targetProfile.id)
      .maybeSingle();
    if (profileError) throw profileError;
    officeId = profileRow?.office_id ?? null;
  }

  const { data: running, error: runningError } = await adminClient
    .from("time_entries")
    .select("id, started_at, description")
    .eq("organization_id", ctx.organizationId)
    .eq("user_id", targetProfile.id)
    .eq("is_running", true)
    .is("ended_at", null)
    .limit(1);

  if (runningError) throw runningError;
  if ((running ?? []).length > 0) {
    return {
      ok: false,
      error:
        "A time tracker is already running. Stop it before starting a new one.",
      runningEntry: running?.[0] ?? null,
    };
  }

  const insertRow: DbRow = {
    organization_id: ctx.organizationId,
    office_id: officeId,
    user_id: targetProfile.id,
    task_id: resolvedTaskId,
    client_id: resolvedBoardId,
    project_id: task?.project_id ?? null,
    campaign_id: task?.campaign_id ?? null,
    description,
    started_at: now,
    ended_at: null,
    is_running: true,
    duration_seconds: 0,
    source: "codex_ai",
    entry_type: "timer",
    is_billable:
      payload.is_billable === true || payload.isBillable === true,
    metadata: {
      source: "codex_execute_tool",
      task_resolved_from: taskId ? "task_id" : task ? "task_title" : "none",
      started_by_user_id: ctx.userId,
    },
  };

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      entry: insertRow,
      message: "Would start a time tracker.",
    };
  }

  const { data, error } = await adminClient
    .from("time_entries")
    .insert(insertRow)
    .select(
      "id, task_id, client_id, project_id, campaign_id, office_id, description, started_at, is_running",
    )
    .single();

  if (error) throw error;

  if (task?.id) {
    const { error: assigneeError } = await adminClient
      .from("task_assignees")
      .upsert(
        {
          organization_id: ctx.organizationId,
          task_id: task.id,
          user_id: targetProfile.id,
        },
        {
          onConflict: "organization_id,task_id,user_id",
          ignoreDuplicates: true,
        },
      );
    if (assigneeError) throw assigneeError;

    if (!task.assigned_to) {
      await adminClient
        .from("tasks")
        .update({
          assigned_to: targetProfile.id,
          assigned_by: ctx.userId,
          updated_at: now,
        })
        .eq("organization_id", ctx.organizationId)
        .eq("id", task.id);
    }
  }

  if (
    task?.id &&
    ["backlog", "todo", "blocked"].includes(String(task.status))
  ) {
    await adminClient
      .from("tasks")
      .update({ status: "in_progress", updated_at: now })
      .eq("organization_id", ctx.organizationId)
      .eq("id", task.id);
  }

  return {
    ok: true,
    entry: data,
    user: {
      id: targetProfile.id,
      name: profileDisplayName(targetProfile),
      email: targetProfile.email ?? null,
    },
    actionUrl: buildTaskLink(data.client_id, data.task_id),
    message: task?.title
      ? `Started ${profileDisplayName(targetProfile)}'s time tracker on "${
          task.title
        }".`
      : `Started ${profileDisplayName(targetProfile)}'s time tracker.`,
  };
}

async function toolStopTimeTracker(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
  dryRun: boolean,
) {
  const originalMessage = readString(payload, "originalMessage") ?? "";
  const inferredEmail = originalMessage
    ? extractEmailFromText(originalMessage)
    : null;
  const inferredName = originalMessage
    ? extractNamedUserFromText(originalMessage)
    : null;

  const normalizedPayload = {
    ...payload,
    userEmail:
      readNestedString(payload, [
        "userEmail",
        "user_email",
        "email",
      ]) ?? inferredEmail,
    userName:
      readNestedString(payload, ["userName", "user_name", "name"]) ??
      inferredName,
  };

  const targetProfile = await resolveTargetProfile(
    adminClient,
    ctx,
    normalizedPayload,
  );
  if (!targetProfile?.id) {
    return {
      ok: false,
      error: "I could not find that user in this organization.",
    };
  }
  if (targetProfile.id !== ctx.userId && !isManagerRole(ctx.role)) {
    return {
      ok: false,
      error: "Only a manager or admin can stop another user's timer.",
    };
  }

  const entryId = normalizeUuid(
    payload.entry_id ?? payload.entryId ?? payload.id,
  );
  const now = new Date().toISOString();

  let query = adminClient
    .from("time_entries")
    .select("id, user_id, task_id, started_at, description")
    .eq("organization_id", ctx.organizationId)
    .eq("is_running", true)
    .is("ended_at", null)
    .limit(1);

  if (entryId) {
    query = query.eq("id", entryId);
  } else {
    query = query.eq("user_id", targetProfile.id);
  }

  const { data: rows, error: findError } = await query;
  if (findError) throw findError;
  const entry = rows?.[0] as DbRow | undefined;
  if (!entry) return { ok: false, error: "No running time tracker found." };

  const durationSeconds = secondsBetween(entry.started_at as string, now);
  const update = {
    ended_at: now,
    is_running: false,
    duration_seconds: durationSeconds,
    duration_minutes: Math.round(durationSeconds / 60),
    updated_at: now,
  };

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      entryId: entry.id,
      proposedChanges: update,
      message: "Would stop the time tracker.",
    };
  }

  const { data, error } = await adminClient
    .from("time_entries")
    .update(update)
    .eq("organization_id", ctx.organizationId)
    .eq("id", entry.id)
    .select(
      "id, description, started_at, ended_at, duration_seconds, is_running",
    )
    .single();

  if (error) throw error;

  if (entry.task_id) {
    const { data: totalRows, error: totalError } = await adminClient
      .from("time_entries")
      .select("duration_seconds")
      .eq("organization_id", ctx.organizationId)
      .eq("task_id", entry.task_id)
      .is("deleted_at", null)
      .not("duration_seconds", "is", null);

    if (totalError) throw totalError;

    const totalSeconds = ((totalRows ?? []) as DbRow[]).reduce(
      (sum, row) => sum + Number(row.duration_seconds ?? 0),
      0,
    );

    const { error: taskUpdateError } = await adminClient
      .from("tasks")
      .update({ tracked_seconds_cache: totalSeconds, updated_at: now })
      .eq("organization_id", ctx.organizationId)
      .eq("id", entry.task_id);

    if (taskUpdateError) throw taskUpdateError;
  }

  let notificationSent = false;
  if (payload.notifyUser === true) {
    const notificationMessage =
      readString(payload, "notificationMessage") ??
      "Please start tracking time again on the correct task.";

    const { error: notificationError } = await adminClient
      .from("notifications")
      .insert({
        organization_id: ctx.organizationId,
        user_id: targetProfile.id,
        type: "system_alert",
        title: "Time tracking reminder",
        message: notificationMessage,
        entity_type: "time_entry",
        entity_id: data.id,
        action_url: "/dashboard",
        priority: "medium",
        category: "time_tracking",
        actor_user_id: ctx.userId,
        metadata: {
          source: "codex_execute_tool",
          stopped_entry_id: data.id,
        },
        delivery_state: "pending",
        is_read: false,
      });

    if (notificationError) throw notificationError;
    notificationSent = true;
  }

  return {
    ok: true,
    entry: data,
    user: {
      id: targetProfile.id,
      name: profileDisplayName(targetProfile),
      email: targetProfile.email ?? null,
    },
    durationSeconds,
    durationHours: Number((durationSeconds / 3600).toFixed(2)),
    notificationSent,
    message: `Stopped ${profileDisplayName(targetProfile)}'s time tracker${
      notificationSent ? " and sent a reminder." : "."
    }`,
  };
}

function toolPreviewWorkspaceAction(
  toolId: string,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const adminOnly = new Set([
    "approve_leave_request",
    "reject_leave_request",
    "create_board",
    "create_asset",
    "update_asset",
    "assign_asset",
    "send_organization_notification",
  ]);
  const actionLabels: Record<string, string> = {
    create_task: "Create task",
    create_board: "Create board",
    create_asset: "Create asset",
    update_asset: "Update asset",
    assign_asset: "Assign asset",
    approve_leave_request: "Approve leave request",
    reject_leave_request: "Reject leave request",
    send_notification: "Send notification",
    create_deadline_notification: "Create deadline reminder",
    schedule_meeting: "Schedule meeting",
  };

  if (adminOnly.has(toolId) && !isManagerRole(ctx.role)) {
    return {
      ok: false,
      requiresPermission: true,
      error: `${
        actionLabels[toolId] ?? toolId
      } requires a manager or admin role.`,
    };
  }

  return {
    ok: true,
    dryRun: true,
    requiresConfirmation: true,
    toolId,
    action: actionLabels[toolId] ?? toolId,
    preview: payload,
    permissions: {
      role: ctx.role,
      adminOnly: adminOnly.has(toolId),
      organizationId: ctx.organizationId,
    },
    message: `${
      actionLabels[toolId] ?? toolId
    } is ready for review. Confirm in the relevant module before it is applied.`,
  };
}

async function toolSearchUsersClockedIn(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const date = (
    readString(payload, "date") ?? new Date().toISOString()
  ).slice(0, 10);
  const limit = Math.min(
    typeof payload.limit === "number" ? payload.limit : 100,
    250,
  );

  let query = adminClient
    .from("attendance_daily_status")
    .select(
      "id, user_id, attendance_date, status, expected_clock_in_at, actual_clock_in_at, notes",
    )
    .eq("organization_id", ctx.organizationId)
    .eq("attendance_date", date)
    .not("actual_clock_in_at", "is", null)
    .order("actual_clock_in_at", { ascending: true })
    .limit(limit);

  if (!isManagerRole(ctx.role)) query = query.eq("user_id", ctx.userId);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as DbRow[];
  const profilesById = await fetchProfilesByIds(
    adminClient,
    ctx.organizationId,
    rows.map((row) => row.user_id as string),
  );

  return {
    ok: true,
    date,
    users: rows.map((row) => {
      const profile = profilesById.get(row.user_id as string);
      return {
        id: row.user_id,
        name: profileDisplayName(profile),
        email: profile?.email ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        status: row.status,
        actualClockInAt: row.actual_clock_in_at,
        expectedClockInAt: row.expected_clock_in_at,
        notes: row.notes,
      };
    }),
    count: rows.length,
    message: `${rows.length} user(s) clocked in on ${date}.`,
  };
}

async function toolCalculateAssetTotalCost(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const status = readString(payload, "status");
  const brand = readString(payload, "brand");
  const model = readString(payload, "model");
  const queryText =
    readString(payload, "query") ?? readString(payload, "search") ?? "";

  let query = adminClient
    .from("assets")
    .select(
      "id, asset_name, asset_tag, status, brand, model, purchase_price, currency",
    )
    .eq("organization_id", ctx.organizationId)
    .limit(1000);

  if (status) query = query.eq("status", status);
  if (brand) query = query.ilike("brand", `%${brand}%`);
  if (model) query = query.ilike("model", `%${model}%`);
  if (queryText) {
    query = query.or(
      `asset_name.ilike.%${queryText}%,asset_tag.ilike.%${queryText}%,brand.ilike.%${queryText}%,model.ilike.%${queryText}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const totalsByCurrency = ((data ?? []) as DbRow[]).reduce<
    Record<string, number>
  >((acc, asset) => {
    const currency = String(asset.currency ?? "USD");
    acc[currency] = Number(
      (acc[currency] ?? 0) + Number(asset.purchase_price ?? 0),
    );
    return acc;
  }, {});

  return {
    ok: true,
    assetCount: data?.length ?? 0,
    totalsByCurrency,
    filters: {
      status: status ?? null,
      brand: brand ?? null,
      model: model ?? null,
      query: queryText || null,
    },
    message: `Calculated asset purchase totals for ${
      data?.length ?? 0
    } asset(s).`,
  };
}

async function toolFindAssetsByAssignee(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const profile = await resolveTargetProfile(adminClient, ctx, payload);
  if (!profile?.id) return { ok: false, error: "Assignee not found." };

  const { data, error } = await adminClient
    .from("assets")
    .select(
      "id, asset_name, asset_tag, serial_number, status, condition, brand, model, purchase_price, currency, updated_at",
    )
    .eq("organization_id", ctx.organizationId)
    .eq("assigned_to", profile.id)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return {
    ok: true,
    assignee: {
      id: profile.id,
      name: profileDisplayName(profile),
      email: profile.email ?? null,
      avatarUrl: profile.avatar_url ?? null,
    },
    assets: ((data ?? []) as DbRow[]).map((asset) => ({
      id: asset.id,
      name: asset.asset_name,
      assetTag: asset.asset_tag,
      serialNumber: asset.serial_number,
      status: asset.status,
      condition: asset.condition,
      brand: asset.brand,
      model: asset.model,
      purchasePrice: asset.purchase_price,
      currency: asset.currency,
      assetUrl:
        typeof asset.id === "string" ? `/assets/${asset.id}` : null,
    })),
    count: data?.length ?? 0,
    message: `${profileDisplayName(profile)} has ${
      data?.length ?? 0
    } assigned asset(s).`,
  };
}

async function toolSearchLeaveRequests(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const { from, to } = readDateRange(payload, 120);
  const status = readString(payload, "status");
  const profile = await resolveTargetProfile(adminClient, ctx, payload);
  const office = await resolveOfficeForPayload(
    adminClient,
    ctx.organizationId,
    payload,
  );
  const limit = Math.min(
    typeof payload.limit === "number" ? payload.limit : 50,
    150,
  );

  let query = adminClient
    .from("leave_requests")
    .select(
      "id, user_id, leave_type_id, start_date, end_date, requested_days, reason, status, approved_by, approved_at, rejection_reason, created_at, office, admin_notes",
    )
    .eq("organization_id", ctx.organizationId)
    .lte("start_date", to.slice(0, 10))
    .gte("end_date", from.slice(0, 10))
    .order("start_date", { ascending: false })
    .limit(limit);

  if (profile?.id) query = query.eq("user_id", profile.id);
  if (status) query = query.eq("status", status);
  if (office?.name) query = query.ilike("office", `%${office.name}%`);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as DbRow[];
  const profilesById = await fetchProfilesByIds(
    adminClient,
    ctx.organizationId,
    rows
      .map((row) => row.user_id as string | null)
      .filter(Boolean) as string[],
  );
  const profileOfficeIds = [
    ...new Set(
      [...profilesById.values()]
        .map((p) => p.office_id as string | null)
        .filter(Boolean) as string[],
    ),
  ];
  const officesById = new Map<string, DbRow>();
  if (profileOfficeIds.length > 0) {
    const { data: offices, error: officeError } = await adminClient
      .from("company_offices")
      .select("id, name, slug")
      .eq("organization_id", ctx.organizationId)
      .in("id", profileOfficeIds);
    if (officeError) throw officeError;
    for (const officeRow of offices ?? []) {
      officesById.set(officeRow.id as string, officeRow);
    }
  }

  const typeIds = [
    ...new Set(
      rows
        .map((row) => row.leave_type_id as string | null)
        .filter(Boolean) as string[],
    ),
  ];
  const leaveTypesById = new Map<string, DbRow>();
  if (typeIds.length > 0) {
    const { data: leaveTypes, error: typeError } = await adminClient
      .from("leave_types")
      .select("id, name, is_paid")
      .eq("organization_id", ctx.organizationId)
      .in("id", typeIds);
    if (typeError) throw typeError;
    for (const leaveType of leaveTypes ?? []) {
      leaveTypesById.set(leaveType.id as string, leaveType);
    }
  }

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    const key = String(row.status ?? "unknown");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return {
    ok: true,
    range: { from: from.slice(0, 10), to: to.slice(0, 10) },
    counts,
    requests: rows.map((row) => {
      const person = profilesById.get(row.user_id as string);
      const profileOffice = person?.office_id
        ? officesById.get(person.office_id as string)
        : null;
      const leaveType = row.leave_type_id
        ? leaveTypesById.get(row.leave_type_id as string)
        : null;
      return {
        id: row.id,
        userId: row.user_id,
        name: profileDisplayName(person),
        leaveType: leaveType?.name ?? null,
        startDate: row.start_date,
        endDate: row.end_date,
        requestedDays: row.requested_days,
        status: row.status,
        reason: row.reason,
        office: row.office ?? profileOffice?.name ?? null,
        profileOffice: profileOffice?.name ?? null,
        profileOfficeSlug: profileOffice?.slug ?? null,
        approvedAt: row.approved_at,
        rejectionReason: isManagerRole(ctx.role)
          ? row.rejection_reason
          : null,
        adminNotes: isManagerRole(ctx.role) ? row.admin_notes : null,
        createdAt: row.created_at,
      };
    }),
    count: rows.length,
    officeFilter: office
      ? { id: office.id, name: office.name, slug: office.slug }
      : null,
    message: `${rows.length} leave request(s) found.`,
  };
}

async function toolSearchMeetings(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const { from, to } = readDateRange(payload, 30);
  const queryText =
    readString(payload, "query") ?? readString(payload, "search") ?? "";
  const status = readString(payload, "status");
  const limit = Math.min(
    typeof payload.limit === "number" ? payload.limit : 30,
    100,
  );

  const participantMeetingIds = new Set<string>();
  if (!isManagerRole(ctx.role)) {
    const [attendeesResult, participantsResult] = await Promise.all([
      adminClient
        .from("meeting_attendees")
        .select("meeting_id")
        .eq("user_id", ctx.userId)
        .limit(250),
      adminClient
        .from("meeting_participants")
        .select("meeting_id")
        .eq("user_id", ctx.userId)
        .limit(250),
    ]);
    if (attendeesResult.error) throw attendeesResult.error;
    if (participantsResult.error) throw participantsResult.error;
    for (const row of attendeesResult.data ?? []) {
      participantMeetingIds.add(row.meeting_id as string);
    }
    for (const row of participantsResult.data ?? []) {
      participantMeetingIds.add(row.meeting_id as string);
    }
  }

  let query = adminClient
    .from("meetings")
    .select(
      "id, title, description, host_id, scheduled_start, scheduled_end, scheduled_for, status, meeting_type, room_code, allow_guest_access, created_at",
    )
    .eq("organization_id", ctx.organizationId)
    .gte("scheduled_start", from)
    .lte("scheduled_start", to)
    .order("scheduled_start", { ascending: true })
    .limit(limit);

  if (!isManagerRole(ctx.role)) {
    const ids = [...participantMeetingIds];
    query =
      ids.length > 0
        ? query.or(`host_id.eq.${ctx.userId},id.in.(${ids.join(",")})`)
        : query.eq("host_id", ctx.userId);
  }
  if (queryText) {
    query = query.or(
      `title.ilike.%${queryText}%,description.ilike.%${queryText}%`,
    );
  }
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;

  const meetings = (data ?? []) as DbRow[];
  const hostsById = await fetchProfilesByIds(
    adminClient,
    ctx.organizationId,
    meetings
      .map((m) => m.host_id as string | null)
      .filter(Boolean) as string[],
  );

  return {
    ok: true,
    range: { from, to },
    meetings: meetings.map((meeting) => {
      const host = hostsById.get(meeting.host_id as string);
      return {
        id: meeting.id,
        title: meeting.title,
        description: meeting.description,
        hostId: meeting.host_id,
        hostName: profileDisplayName(host),
        scheduledStart: meeting.scheduled_start,
        scheduledEnd: meeting.scheduled_end,
        status: meeting.status,
        meetingType: meeting.meeting_type,
        allowGuestAccess: meeting.allow_guest_access,
        meetingUrl:
          typeof meeting.id === "string" ? `/meetings/${meeting.id}` : null,
      };
    }),
    count: meetings.length,
    message: `${meetings.length} meeting(s) found.`,
  };
}

async function toolSearchReports(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  if (!isManagerRole(ctx.role)) {
    return {
      ok: false,
      error: "Reports are available to managers and admins only.",
    };
  }

  const { from, to } = readDateRange(payload, 90);
  const queryText =
    readString(payload, "query") ?? readString(payload, "search") ?? "";
  const status = readString(payload, "status");
  const limit = Math.min(
    typeof payload.limit === "number" ? payload.limit : 30,
    100,
  );

  let query = adminClient
    .from("reports")
    .select(
      "id, client_id, campaign_id, title, period_start, period_end, status, summary, file_url, generated_by, approved_by, sent_at, created_at, updated_at",
    )
    .eq("organization_id", ctx.organizationId)
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (queryText) {
    query = query.or(
      `title.ilike.%${queryText}%,summary.ilike.%${queryText}%`,
    );
  }
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as DbRow[];
  const clientIds = [
    ...new Set(
      rows
        .map((row) => row.client_id as string | null)
        .filter(Boolean) as string[],
    ),
  ];
  const clientsById = new Map<string, DbRow>();
  if (clientIds.length > 0) {
    const { data: clients, error: clientError } = await adminClient
      .from("clients")
      .select("id, name")
      .eq("organization_id", ctx.organizationId)
      .in("id", clientIds);
    if (clientError) throw clientError;
    for (const client of clients ?? []) {
      clientsById.set(client.id as string, client);
    }
  }

  return {
    ok: true,
    range: { from, to },
    reports: rows.map((report) => ({
      id: report.id,
      title: report.title,
      clientId: report.client_id,
      clientName: report.client_id
        ? clientsById.get(report.client_id as string)?.name ?? null
        : null,
      periodStart: report.period_start,
      periodEnd: report.period_end,
      status: report.status,
      summary: report.summary,
      hasFile: Boolean(report.file_url),
      sentAt: report.sent_at,
      createdAt: report.created_at,
      reportUrl:
        typeof report.id === "string" ? `/reports/${report.id}` : null,
    })),
    count: rows.length,
    message: `${rows.length} report(s) found.`,
  };
}

async function toolSearchEmployeeDocuments(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const queryText =
    readString(payload, "query") ?? readString(payload, "search") ?? "";
  const documentType =
    readString(payload, "document_type") ??
    readString(payload, "documentType");
  const limit = Math.min(
    typeof payload.limit === "number" ? payload.limit : 30,
    100,
  );

  if (!isManagerRole(ctx.role)) {
    const { data: recipients, error: recipientError } = await adminClient
      .from("employee_document_recipients")
      .select(
        "document_id, status, delivered_at, read_at, acknowledged_at",
      )
      .eq("organization_id", ctx.organizationId)
      .eq("user_id", ctx.userId)
      .order("delivered_at", { ascending: false })
      .limit(limit);

    if (recipientError) throw recipientError;

    const recipientRows = (recipients ?? []) as DbRow[];
    const docIds = recipientRows
      .map((row) => row.document_id as string | null)
      .filter(Boolean) as string[];

    if (docIds.length === 0) {
      return {
        ok: true,
        documents: [],
        count: 0,
        message: "No employee documents found.",
      };
    }

    let query = adminClient
      .from("employee_documents")
      .select(
        "id, title, message, document_type, file_name, mime_type, requires_acknowledgement, is_confidential, created_at, expires_at",
      )
      .eq("organization_id", ctx.organizationId)
      .in("id", docIds)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (queryText) {
      query = query.or(
        `title.ilike.%${queryText}%,message.ilike.%${queryText}%,file_name.ilike.%${queryText}%`,
      );
    }
    if (documentType) query = query.eq("document_type", documentType);

    const { data, error } = await query;
    if (error) throw error;

    const recipientByDocId = new Map(
      recipientRows.map((row) => [row.document_id as string, row]),
    );

    return {
      ok: true,
      documents: ((data ?? []) as DbRow[]).map((doc) => {
        const recipient = recipientByDocId.get(doc.id as string);
        return {
          id: doc.id,
          title: doc.title,
          message: doc.message,
          documentType: doc.document_type,
          fileName: doc.file_name,
          mimeType: doc.mime_type,
          requiresAcknowledgement: doc.requires_acknowledgement,
          isConfidential: doc.is_confidential,
          recipientStatus: recipient?.status ?? null,
          deliveredAt: recipient?.delivered_at ?? null,
          readAt: recipient?.read_at ?? null,
          acknowledgedAt: recipient?.acknowledged_at ?? null,
          createdAt: doc.created_at,
          expiresAt: doc.expires_at,
        };
      }),
      count: data?.length ?? 0,
      message: `${data?.length ?? 0} employee document(s) found.`,
    };
  }

  let query = adminClient
    .from("employee_documents")
    .select(
      "id, title, message, document_type, file_name, mime_type, requires_acknowledgement, is_confidential, created_by, created_at, expires_at",
    )
    .eq("organization_id", ctx.organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (queryText) {
    query = query.or(
      `title.ilike.%${queryText}%,message.ilike.%${queryText}%,file_name.ilike.%${queryText}%`,
    );
  }
  if (documentType) query = query.eq("document_type", documentType);

  const { data, error } = await query;
  if (error) throw error;

  return {
    ok: true,
    documents: ((data ?? []) as DbRow[]).map((doc) => ({
      id: doc.id,
      title: doc.title,
      message: doc.message,
      documentType: doc.document_type,
      fileName: doc.file_name,
      mimeType: doc.mime_type,
      requiresAcknowledgement: doc.requires_acknowledgement,
      isConfidential: doc.is_confidential,
      createdBy: doc.created_by,
      createdAt: doc.created_at,
      expiresAt: doc.expires_at,
    })),
    count: data?.length ?? 0,
    message: `${data?.length ?? 0} employee document(s) found.`,
  };
}

async function toolSearchSocialPosts(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  if (!canViewContentWorkspace(ctx.role)) {
    return {
      ok: false,
      error:
        "Social post search is available to media, managers, and admins.",
    };
  }

  const queryText =
    readString(payload, "query") ?? readString(payload, "search") ?? "";
  const status = readString(payload, "status");
  const platform = readString(payload, "platform");
  const limit = Math.min(
    typeof payload.limit === "number" ? payload.limit : 30,
    100,
  );

  let query = adminClient
    .from("social_posts")
    .select(
      "id, client_id, campaign_id, title, body, platform, status, priority, scheduled_for, estimated_hours, spent_hours, ai_angle, owner_id, created_by, created_at, updated_at",
    )
    .eq("organization_id", ctx.organizationId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!isManagerRole(ctx.role)) {
    query = query.or(
      `owner_id.eq.${ctx.userId},created_by.eq.${ctx.userId}`,
    );
  }
  if (queryText) {
    query = query.or(
      `title.ilike.%${queryText}%,body.ilike.%${queryText}%,ai_angle.ilike.%${queryText}%`,
    );
  }
  if (status) query = query.eq("status", status);
  if (platform) query = query.eq("platform", platform);

  const { data, error } = await query;
  if (error) throw error;

  const posts = (data ?? []) as DbRow[];
  const clientIds = [
    ...new Set(
      posts
        .map((post) => post.client_id as string | null)
        .filter(Boolean) as string[],
    ),
  ];
  const clientsById = new Map<string, DbRow>();
  if (clientIds.length > 0) {
    const { data: clients, error: clientError } = await adminClient
      .from("clients")
      .select("id, name")
      .eq("organization_id", ctx.organizationId)
      .in("id", clientIds);
    if (clientError) throw clientError;
    for (const client of clients ?? []) {
      clientsById.set(client.id as string, client);
    }
  }

  return {
    ok: true,
    posts: posts.map((post) => ({
      id: post.id,
      title: post.title,
      body: post.body,
      platform: post.platform,
      status: post.status,
      priority: post.priority,
      scheduledFor: post.scheduled_for,
      aiAngle: post.ai_angle,
      clientId: post.client_id,
      clientName: post.client_id
        ? clientsById.get(post.client_id as string)?.name ?? null
        : null,
      ownerId: post.owner_id,
      createdBy: post.created_by,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      postUrl:
        typeof post.id === "string" ? `/social-posts/${post.id}` : null,
    })),
    count: posts.length,
    message: `${posts.length} social post(s) found.`,
  };
}

async function toolSearchFleetServiceNeeds(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  if (!isManagerRole(ctx.role)) {
    return {
      ok: false,
      error: "Fleet service needs are available to managers and admins only.",
    };
  }

  const horizonDays = Math.min(
    typeof payload.horizon_days === "number" ? payload.horizon_days : 30,
    180,
  );
  const until = new Date();
  until.setUTCDate(until.getUTCDate() + horizonDays);
  const untilDate = until.toISOString().slice(0, 10);
  const status = readString(payload, "status") ?? "active";
  const limit = Math.min(
    typeof payload.limit === "number" ? payload.limit : 50,
    150,
  );

  let query = adminClient
    .from("fleet_service_schedules")
    .select(
      "id, vehicle_id, schedule_name, service_type, interval_km, interval_months, last_service_date, last_service_odometer_km, next_service_date, next_service_odometer_km, status, updated_at",
    )
    .eq("organization_id", ctx.organizationId)
    .lte("next_service_date", untilDate)
    .order("next_service_date", { ascending: true })
    .limit(limit);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;

  const schedules = (data ?? []) as DbRow[];
  const vehicleIds = [
    ...new Set(
      schedules
        .map((row) => row.vehicle_id as string | null)
        .filter(Boolean) as string[],
    ),
  ];
  const vehiclesById = new Map<string, DbRow>();
  if (vehicleIds.length > 0) {
    const { data: vehicles, error: vehicleError } = await adminClient
      .from("fleet_vehicles")
      .select(
        "id, vehicle_name, registration_number, make, model, current_odometer_km, status",
      )
      .eq("organization_id", ctx.organizationId)
      .in("id", vehicleIds);
    if (vehicleError) throw vehicleError;
    for (const vehicle of vehicles ?? []) {
      vehiclesById.set(vehicle.id as string, vehicle);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    horizonDays,
    untilDate,
    serviceNeeds: schedules.map((schedule) => {
      const vehicle = vehiclesById.get(schedule.vehicle_id as string);
      const dueByDate =
        typeof schedule.next_service_date === "string" &&
        schedule.next_service_date <= today;
      const dueByOdometer =
        Number(vehicle?.current_odometer_km ?? 0) >=
        Number(
          schedule.next_service_odometer_km ?? Number.POSITIVE_INFINITY,
        );
      return {
        id: schedule.id,
        vehicleId: schedule.vehicle_id,
        vehicleName: vehicle?.vehicle_name ?? null,
        registrationNumber: vehicle?.registration_number ?? null,
        make: vehicle?.make ?? null,
        model: vehicle?.model ?? null,
        currentOdometerKm: vehicle?.current_odometer_km ?? null,
        scheduleName: schedule.schedule_name,
        serviceType: schedule.service_type,
        nextServiceDate: schedule.next_service_date,
        nextServiceOdometerKm: schedule.next_service_odometer_km,
        status: schedule.status,
        dueNow: dueByDate || dueByOdometer,
        dueReasons: [
          dueByDate ? "date_due" : null,
          dueByOdometer ? "odometer_due" : null,
        ].filter(Boolean),
      };
    }),
    count: schedules.length,
    message: `${schedules.length} fleet service schedule(s) due within ${horizonDays} day(s).`,
  };
}

async function toolListAvailableDocuments(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const limit = Math.min(
    typeof payload.limit === "number" ? payload.limit : 100,
    250,
  );
  const { data, error } = await adminClient
    .from("ai_documents")
    .select(
      "id, document_name, file_type, source_url, department, access_level, uploaded_by, status, created_at, updated_at, summary_short",
    )
    .eq("organization_id", ctx.organizationId)
    .eq("status", "trained")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows = ((data ?? []) as DbRow[]).filter(
    (row) =>
      canAccessDocument(ctx, row) &&
      !/infranodus/i.test(String(row.source_url ?? "")),
  );

  return {
    ok: true,
    documents: rows.map((doc) => ({
      id: doc.id,
      name: doc.document_name,
      type: doc.file_type,
      url: cleanDocumentUrl(doc.source_url),
      uploaded_at: doc.created_at,
      status: doc.status,
      summary: snippet(doc.summary_short, 240),
    })),
    count: rows.length,
    message: rows.length
      ? `I know about ${rows.length} document(s): ${rows
          .map((doc) => doc.document_name)
          .slice(0, 12)
          .join(", ")}.`
      : "No indexed internal documents were found.",
  };
}

async function fallbackSearchDocuments(
  adminClient: any,
  ctx: Required<ToolContext>,
  queryText: string,
  limit: number,
) {
  const safeQuery = queryText.replace(/[%_,]/g, " ").trim();
  let docQuery = adminClient
    .from("ai_documents")
    .select(
      "id, document_name, file_type, source_url, department, access_level, uploaded_by, status, summary_short, summary_detailed, created_at",
    )
    .eq("organization_id", ctx.organizationId)
    .eq("status", "trained")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (safeQuery) {
    docQuery = docQuery.or(
      `document_name.ilike.%${safeQuery}%,summary_short.ilike.%${safeQuery}%,summary_detailed.ilike.%${safeQuery}%`,
    );
  }

  const { data: docs, error } = await docQuery;
  if (error) throw error;

  const docRows = ((docs ?? []) as DbRow[]).filter(
    (doc) =>
      canAccessDocument(ctx, doc) &&
      !looksLikeHtml(doc.summary_detailed) &&
      !/infranodus/i.test(String(doc.source_url ?? "")),
  );

  const results = docRows.map((doc) => ({
    id: doc.id,
    name: doc.document_name,
    type: doc.file_type,
    url: cleanDocumentUrl(doc.source_url),
    snippet: snippet(doc.summary_short || doc.summary_detailed, 700),
    score:
      safeQuery &&
      String(doc.document_name ?? "")
        .toLowerCase()
        .includes(safeQuery.toLowerCase())
        ? 0.75
        : 0.5,
  }));

  if (results.length > 0 || !safeQuery) return results.slice(0, limit);

  const { data: chunks, error: chunkError } = await adminClient
    .from("ai_document_chunks")
    .select(
      "id, document_id, chunk_text, chunk_summary, ai_documents!inner(id, document_name, file_type, source_url, department, access_level, uploaded_by, status)",
    )
    .eq("organization_id", ctx.organizationId)
    .eq("ai_documents.status", "trained")
    .ilike("chunk_text", `%${safeQuery}%`)
    .limit(limit);

  if (chunkError) throw chunkError;

  return ((chunks ?? []) as DbRow[])
    .filter((chunk) => {
      const doc = chunk.ai_documents as DbRow | undefined;
      return (
        doc &&
        canAccessDocument(ctx, doc) &&
        !looksLikeHtml(chunk.chunk_text) &&
        !/infranodus/i.test(String(doc.source_url ?? ""))
      );
    })
    .map((chunk) => {
      const doc = chunk.ai_documents as DbRow;
      return {
        id: String(chunk.document_id ?? doc.id),
        name: String(doc.document_name ?? "Document"),
        type: String(doc.file_type ?? "document"),
        url: cleanDocumentUrl(doc.source_url),
        snippet: snippet(chunk.chunk_summary || chunk.chunk_text, 700),
        score: 0.6,
      };
    });
}

async function toolSearchDocuments(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const queryText =
    readString(payload, "query") ??
    readString(payload, "search") ??
    readString(payload, "document_query") ??
    "";
  const limit = Math.min(
    typeof payload.limit === "number" ? payload.limit : 8,
    25,
  );

  if (!queryText) {
    const list = await toolListAvailableDocuments(adminClient, ctx, { limit });
    return {
      ok: true,
      results: (list.documents as DbRow[]).map((doc) => ({
        id: doc.id,
        name: doc.name,
        type: doc.type,
        url: doc.url ?? "",
        snippet: doc.summary ?? "",
        score: 1,
      })),
      count: list.count,
      message: list.message,
    };
  }

  const embedding = await createDocumentQueryEmbedding(queryText);
  if (embedding) {
    try {
      const { data, error } = await adminClient.rpc(
        "search_ai_document_chunks",
        {
          p_organization_id: ctx.organizationId,
          p_query_embedding: embedding,
          p_match_threshold:
            typeof payload.threshold === "number" ? payload.threshold : 0.2,
          p_match_count: limit,
        },
      );
      if (error) throw error;

      const vectorResults = ((data ?? []) as DbRow[])
        .filter(
          (row) =>
            !looksLikeHtml(row.snippet) &&
            !/infranodus/i.test(String(row.url ?? "")),
        )
        .map((row) => ({
          id: String(row.document_id ?? row.id ?? ""),
          name: String(row.name ?? ""),
          type: String(row.type ?? "document"),
          url: cleanDocumentUrl(row.url),
          snippet: snippet(row.snippet, 700),
          score: Number(row.score ?? 0),
        }))
        .filter((row) => row.id && row.name && row.snippet);

      if (vectorResults.length > 0) {
        return {
          ok: true,
          results: vectorResults,
          count: vectorResults.length,
          message: `Found ${vectorResults.length} internal document result(s) for "${queryText}".`,
        };
      }
    } catch (err) {
      console.warn(
        "Vector document search failed; falling back to text search:",
        err,
      );
    }
  }

  const results = await fallbackSearchDocuments(
    adminClient,
    ctx,
    queryText,
    limit,
  );
  return {
    ok: true,
    results,
    count: results.length,
    message: results.length
      ? `Found ${results.length} internal document result(s) for "${queryText}".`
      : `No internal documents matched "${queryText}".`,
  };
}

async function toolGetDocument(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const documentId = normalizeUuid(
    payload.document_id ?? payload.documentId ?? payload.id,
  );
  const name =
    readString(payload, "name") ??
    readString(payload, "filename") ??
    readString(payload, "file_name");

  let query = adminClient
    .from("ai_documents")
    .select(
      "id, organization_id, document_name, file_type, source, source_url, uploaded_by, department, module, access_level, status, summary_short, summary_detailed, tags, metadata, created_at, updated_at",
    )
    .eq("organization_id", ctx.organizationId)
    .eq("status", "trained")
    .limit(1);

  if (documentId) query = query.eq("id", documentId);
  else if (name) query = query.ilike("document_name", `%${name}%`);
  else return { ok: false, error: "document_id or name is required." };

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, error: "Document not found." };
  if (!canAccessDocument(ctx, data)) {
    return {
      ok: false,
      error: "You do not have access to this document.",
    };
  }
  if (/infranodus/i.test(String(data.source_url ?? ""))) {
    return {
      ok: false,
      error:
        "This document source is not an internal document index entry.",
    };
  }

  const { data: chunks, error: chunkError } = await adminClient
    .from("ai_document_chunks")
    .select("id, chunk_index, chunk_text, chunk_summary, metadata")
    .eq("organization_id", ctx.organizationId)
    .eq("document_id", data.id)
    .order("chunk_index", { ascending: true })
    .limit(80);

  if (chunkError) throw chunkError;

  const content = ((chunks ?? []) as DbRow[])
    .map((chunk) =>
      looksLikeHtml(chunk.chunk_text)
        ? stripHtml(chunk.chunk_text)
        : String(chunk.chunk_text ?? ""),
    )
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 24000);

  return {
    ok: true,
    document: {
      id: data.id,
      name: data.document_name,
      type: data.file_type,
      url: cleanDocumentUrl(data.source_url),
      uploaded_at: data.created_at,
      updated_at: data.updated_at,
      metadata: data.metadata ?? {},
      tags: data.tags ?? [],
      accessLevel: data.access_level,
      department: data.department,
      module: data.module,
    },
    metadata: data.metadata ?? {},
    summary: {
      short: snippet(data.summary_short, 500),
      detailed: snippet(data.summary_detailed, 1800),
    },
    content,
    chunkCount: chunks?.length ?? 0,
    message: `Loaded "${data.document_name}".`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Request handler
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse(
        { error: "codex-execute-tool is not configured." },
        500,
      );
    }

    const body = (await req.json().catch(() => ({}))) as ExecuteToolBody;
    const toolId =
      typeof body.toolId === "string" ? body.toolId.trim() : "";
    const payload = isRecord(body.payload) ? body.payload : {};
    const dryRun = body.dryRun === true;

    if (!toolId) {
      return jsonResponse({ error: "toolId is required." }, 400);
    }

    const token = getBearerToken(req);
    const internalCall = hasInternalSecret(req);

    if (!internalCall && !token) {
      return jsonResponse(
        { error: "Missing Authorization bearer token." },
        401,
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let userId = "";
    let organizationId = "";
    let role: string | null = null;
    let department: string | null = null;
    let fullName: string | null = null;
    let officeId: string | null = null;

    if (internalCall) {
      userId = body.context?.userId ?? "";
      organizationId = body.context?.organizationId ?? "";
      role = body.context?.role ?? null;
      department = body.context?.department ?? null;
      fullName = body.context?.fullName ?? null;
      officeId = body.context?.officeId ?? null;

      if (!userId || !organizationId) {
        return jsonResponse(
          {
            error:
              "context.userId and context.organizationId are required for internal tool calls.",
          },
          400,
        );
      }

      // Fill any missing context fields from the profile
      if (!role || !department || !fullName || !officeId) {
        const { data: profile, error: profileError } = await adminClient
          .from("profiles")
          .select(
            "primary_role, department, full_name, office_id, account_status, is_suspended",
          )
          .eq("id", userId)
          .eq("organization_id", organizationId)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile) {
          return jsonResponse(
            { error: "Scheduled action user profile not found." },
            404,
          );
        }
        if (
          profile.account_status !== "active" ||
          profile.is_suspended
        ) {
          return jsonResponse(
            { error: "Inactive users cannot run scheduled tools." },
            403,
          );
        }

        role = role ?? profile.primary_role ?? null;
        department = department ?? profile.department ?? null;
        fullName = fullName ?? profile.full_name ?? null;
        officeId = officeId ?? profile.office_id ?? null;
      }
    } else {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      });

      const { data: authData, error: authError } =
        await userClient.auth.getUser(token!); 

      if (authError || !authData.user) {
        return jsonResponse({ error: "Invalid or expired session." }, 401);
      }

      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .select(
          "id, organization_id, primary_role, department, full_name, office_id, account_status, is_suspended",
        )
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile?.organization_id) {
        return jsonResponse(
          { error: "Missing organization context." },
          403,
        );
      }
      if (
        profile.account_status !== "active" ||
        profile.is_suspended
      ) {
        return jsonResponse(
          { error: "Inactive users cannot run Codex tools." },
          403,
        );
      }

      userId = authData.user.id;
      organizationId = profile.organization_id as string;
      role = profile.primary_role as string | null;
      department = profile.department as string | null;
      fullName = profile.full_name as string | null;
      officeId = profile.office_id as string | null;
    }

    const ctx: Required<ToolContext> = {
      userId,
      organizationId,
      officeId,
      role,
      department,
      fullName,
    };

    let result: Record<string, unknown>;

    switch (toolId) {
      case "summarize_my_tasks":
        result = await toolSummarizeMyTasks(adminClient, ctx);
        break;

      case "list_boards":
        result = await toolListBoards(adminClient, ctx.organizationId, payload);
        break;

      case "get_active_time_trackers":
        result = await toolGetActiveTimeTrackers(adminClient, ctx, payload);
        break;

      case "get_user_timesheet":
        result = await toolGetUserTimesheet(adminClient, ctx, payload);
        break;

      case "get_attendance_summary":
        result = await toolGetAttendanceSummary(adminClient, ctx, payload);
        break;

      case "get_leave_balance":
        result = await toolGetLeaveBalance(adminClient, ctx, payload);
        break;

      case "get_board_task_summary":
        result = await toolGetBoardTaskSummary(adminClient, ctx, payload);
        break;

      case "create_board_card":
        result = await toolCreateBoardCard(adminClient, ctx, payload, dryRun);
        break;

      case "create_task":
      case "create_board":
      case "create_asset":
      case "update_asset":
      case "assign_asset":
      case "approve_leave_request":
      case "reject_leave_request":
      case "send_notification":
      case "create_deadline_notification":
      case "schedule_meeting":
        result = toolPreviewWorkspaceAction(toolId, ctx, payload);
        break;

      case "notify_content_review":
        result = await toolNotifyContentReview(
          adminClient,
          ctx,
          payload,
          dryRun,
        );
        break;

      case "search_notifications":
        result = await toolSearchNotifications(adminClient, ctx, payload);
        break;

      case "search_assets":
        result = await toolSearchAssets(adminClient, ctx, payload);
        break;

      case "search_people":
      case "people_directory":
        result = await toolSearchPeople(adminClient, ctx, payload);
        break;

      case "search_tasks":
        result = await toolSearchTasks(adminClient, ctx, payload);
        break;

      case "update_task":
        result = await toolUpdateTask(adminClient, ctx, payload, dryRun);
        break;

      case "search_time_entries":
        result = await toolSearchTimeEntries(adminClient, ctx, payload);
        break;

      case "start_time_tracker":
        result = await toolStartTimeTracker(adminClient, ctx, payload, dryRun);
        break;

      case "stop_time_tracker":
        result = await toolStopTimeTracker(adminClient, ctx, payload, dryRun);
        break;

      case "search_users_clocked_in":
      case "get_clocked_in_users":
        result = await toolSearchUsersClockedIn(adminClient, ctx, payload);
        break;

      case "calculate_asset_total_cost":
        result = await toolCalculateAssetTotalCost(adminClient, ctx, payload);
        break;

      case "find_assets_by_assignee":
        result = await toolFindAssetsByAssignee(adminClient, ctx, payload);
        break;

      case "search_leave_requests":
        result = await toolSearchLeaveRequests(adminClient, ctx, payload);
        break;

      case "search_meetings":
        result = await toolSearchMeetings(adminClient, ctx, payload);
        break;

      case "search_reports":
        result = await toolSearchReports(adminClient, ctx, payload);
        break;

      case "search_employee_documents":
        result = await toolSearchEmployeeDocuments(adminClient, ctx, payload);
        break;

      case "search_social_posts":
        result = await toolSearchSocialPosts(adminClient, ctx, payload);
        break;

      case "search_fleet_service_needs":
        result = await toolSearchFleetServiceNeeds(adminClient, ctx, payload);
        break;

      case "list_available_documents":
        result = await toolListAvailableDocuments(adminClient, ctx, payload);
        break;

      case "search_documents":
        result = await toolSearchDocuments(adminClient, ctx, payload);
        break;

      case "get_document":
        result = await toolGetDocument(adminClient, ctx, payload);
        break;

      default:
        return jsonResponse({ error: `Unsupported toolId: ${toolId}` }, 400);
    }

    return jsonResponse({
      ok: true,
      toolId,
      internalCall,
      context: { userId, organizationId, role, department },
      result,
    });
  } catch (error) {
    console.error("codex-execute-tool error:", error);

    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : JSON.stringify(error, null, 2);

    return jsonResponse({ ok: false, error: message, rawError: error }, 500);
  }
});