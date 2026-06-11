import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ToolContext = {
  userId?: string;
  organizationId?: string;
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
  "it-superadmin",
  "it",
  "org_admin",
]);

const CLOSED_STATUSES = new Set(["done", "cancelled", "approved"]);

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
  const secret = Deno.env.get("INTERNAL_API_KEY") ??
    Deno.env.get("CODEX_TOOL_SECRET");
  if (!secret) return false;
  const inbound = req.headers.get("x-codex-internal-key") ??
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

function normalizePriority(value: unknown) {
  const normalized = String(value ?? "medium").toLowerCase();
  return ["low", "medium", "high", "urgent"].includes(normalized)
    ? normalized
    : "medium";
}

function normalizeUuid(value: unknown) {
  if (typeof value !== "string") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value)
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
  return isManagerRole(role) ||
    ["media_team", "social_media", "seo_specialist"].includes(
      String(role ?? "").toLowerCase(),
    );
}

function isPrivilegedDocumentRole(role: string | null | undefined) {
  return isManagerRole(role) ||
    ["hr", "it", "it-superadmin"].includes(String(role ?? "").toLowerCase());
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
    return !row.department || row.department === ctx.department ||
      isPrivilegedDocumentRole(ctx.role);
  }
  if (accessLevel === "private") {
    return row.uploaded_by === ctx.userId || isPrivilegedDocumentRole(ctx.role);
  }
  return true;
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

  const payload = await response.json();
  if (!response.ok) return null;
  const embedding = payload.data?.[0]?.embedding;
  return Array.isArray(embedding) ? embedding : null;
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

function readDateRange(payload: Record<string, unknown>, defaultDaysBack = 7) {
  const from = readDateString(payload, "from") ??
    readDateString(payload, "start_date") ??
    readDateString(payload, "startDate") ??
    defaultFromDate(defaultDaysBack);
  const to = readEndDateString(payload, "to") ??
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

async function resolveTargetProfile(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const requestedId = normalizeUuid(
    payload.user_id ?? payload.userId ?? payload.employee_id ??
      payload.employeeId,
  );
  const requestedEmail = readString(payload, "email") ??
    readString(payload, "user_email") ??
    readString(payload, "userEmail");
  const requestedName = readString(payload, "name") ??
    readString(payload, "user_name") ??
    readString(payload, "userName") ??
    readString(payload, "employee_name") ??
    readString(payload, "employeeName");

  if (!isManagerRole(ctx.role)) {
    const { data, error } = await adminClient
      .from("profiles")
      .select(
        "id, email, full_name, username, avatar_url, primary_role, department, leave_days_total, leave_days_remaining",
      )
      .eq("organization_id", ctx.organizationId)
      .eq("id", ctx.userId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  let query = adminClient
    .from("profiles")
    .select(
      "id, email, full_name, username, avatar_url, primary_role, department, leave_days_total, leave_days_remaining",
    )
    .eq("organization_id", ctx.organizationId)
    .limit(5);

  if (requestedId) query = query.eq("id", requestedId);
  else if (requestedEmail) query = query.ilike("email", requestedEmail);
  else if (requestedName) {
    query = query.or(
      `full_name.ilike.%${requestedName}%,username.ilike.%${requestedName}%,email.ilike.%${requestedName}%`,
    );
  } else query = query.eq("id", ctx.userId);

  const { data, error } = await query;
  if (error) throw error;
  return data?.[0] ?? null;
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

  const boardName = readString(payload, "board_name") ??
    readString(payload, "boardName");
  if (!boardName) return null;

  const { data } = await adminClient
    .from("clients")
    .select("id, name")
    .eq("organization_id", organizationId)
    .ilike("name", `%${boardName}%`)
    .order("name", { ascending: true })
    .limit(5);

  const exact = ((data ?? []) as DbRow[]).find(
    (row) => String(row.name ?? "").toLowerCase() === boardName.toLowerCase(),
  );
  return exact ?? data?.[0] ?? null;
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
    payload.assignee_user_id ?? payload.assigneeUserId ?? payload.assigned_to,
  );
  if (singleId) ids.add(singleId);

  const email = readString(payload, "assignee_email") ??
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

  const name = readString(payload, "assignee_name") ??
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

  const assignedTaskIds = ((assigneeRows ?? []) as DbRow[]).map((row) =>
    row.task_id as string
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

  const openTasks = (tasks ?? []).filter(
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
    message: openTasks.length === 0
      ? "You have no open assigned tasks."
      : `You have ${openTasks.length} open task(s), ${overdue.length} overdue.`,
  };
}

async function toolListBoards(
  adminClient: any,
  organizationId: string,
  payload: Record<string, unknown>,
) {
  const search = readString(payload, "search") ?? readString(payload, "query");
  let query = adminClient
    .from("clients")
    .select("id, name, status, office_id")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })
    .limit(25);

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

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
  const personalScope = readString(payload, "scope") === "me" ||
    payload.userOnly === true ||
    payload.currentUserOnly === true;
  const includeNotTracking = payload.include_not_tracking === true ||
    payload.includeNotTracking === true ||
    readString(payload, "mode") === "not_tracking";

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

  if (personalScope || !isManagerRole(ctx.role)) {
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
    ...new Set(
      rows.map((row) => row.task_id as string | null).filter(
        Boolean,
      ) as string[],
    ),
  ];
  const boardIds = [
    ...new Set(
      rows.map((row) => row.client_id as string | null).filter(
        Boolean,
      ) as string[],
    ),
  ];
  const tasksById = new Map<string, Record<string, unknown>>();
  const boardsById = new Map<string, Record<string, unknown>>();

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
    const board = row.client_id
      ? boardsById.get(row.client_id as string)
      : null;
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
      boardUrl: typeof row.client_id === "string"
        ? `/boards/${row.client_id}`
        : null,
      description: row.description,
      startedAt: row.started_at,
      elapsedSeconds,
    };
  });

  const activeUserIds = new Set(
    trackers.map((tracker) => String(tracker.userId)).filter(Boolean),
  );
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

    if (personalScope || !isManagerRole(ctx.role)) {
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
      if (profile.account_status && profile.account_status !== "active") {
        return false;
      }
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
    count: trackers.length,
    activeCount: trackers.length,
    peopleCount,
    notTrackingCount: notTracking.length,
    trackers,
    notTracking,
    message: trackers.length === 0
      ? includeNotTracking
        ? `${notTracking.length} user(s) are not tracking time.`
        : "No one is currently tracking time."
      : includeNotTracking
      ? `${trackers.length} user(s) are tracking time and ${notTracking.length} are not tracking.`
      : `${trackers.length} user(s) are currently tracking time.`,
  };
}

async function toolGetUserTimesheet(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const profile = await resolveTargetProfile(adminClient, ctx, payload);
  if (!profile?.id) return { ok: false, error: "User not found." };

  const { from, to } = readDateRange(payload, 7);

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
    .limit(200);

  if (error) throw error;

  const entries = (data ?? []) as DbRow[];
  const taskIds = [
    ...new Set(
      entries.map((row) => row.task_id as string | null).filter(
        Boolean,
      ) as string[],
    ),
  ];
  const boardIds = [
    ...new Set(
      entries.map((row) => row.client_id as string | null).filter(
        Boolean,
      ) as string[],
    ),
  ];
  const tasksById = new Map<string, Record<string, unknown>>();
  const boardsById = new Map<string, Record<string, unknown>>();

  if (taskIds.length > 0) {
    const { data: tasks, error: taskError } = await adminClient
      .from("tasks")
      .select("id, title")
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

  const normalizedEntries = entries.map((entry) => {
    const seconds = entry.is_running && entry.started_at
      ? secondsBetween(entry.started_at as string)
      : Number(entry.duration_seconds ?? 0);
    return {
      id: entry.id,
      taskId: entry.task_id,
      taskTitle: entry.task_id
        ? tasksById.get(entry.task_id as string)?.title ?? null
        : null,
      boardId: entry.client_id,
      boardName: entry.client_id
        ? boardsById.get(entry.client_id as string)?.name ?? null
        : null,
      taskUrl: buildTaskLink(entry.client_id, entry.task_id),
      boardUrl: typeof entry.client_id === "string"
        ? `/boards/${entry.client_id}`
        : null,
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
    range: { from, to },
    totalSeconds,
    totalHours: Number((totalSeconds / 3600).toFixed(2)),
    entryCount: normalizedEntries.length,
    entries: normalizedEntries,
    message: `${profileDisplayName(profile)} tracked ${
      (totalSeconds / 3600).toFixed(2)
    } hour(s) in this period.`,
  };
}

async function toolGetAttendanceSummary(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const from = readString(payload, "date") ?? readString(payload, "from") ??
    new Date().toISOString().slice(0, 10);
  const to = readString(payload, "to") ?? from;
  const hasTargetUser = Boolean(
    normalizeUuid(
      payload.user_id ?? payload.userId ?? payload.employee_id ??
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
    .gte("attendance_date", from.slice(0, 10))
    .lte("attendance_date", to.slice(0, 10))
    .order("attendance_date", { ascending: false })
    .limit(300);

  if (!teamView) query = query.eq("user_id", targetProfile?.id ?? ctx.userId);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as DbRow[];
  const profilesById = await fetchProfilesByIds(
    adminClient,
    ctx.organizationId,
    rows.map((row) => row.user_id as string),
  );

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    const status = String(row.status ?? "unknown");
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    ok: true,
    range: { from: from.slice(0, 10), to: to.slice(0, 10) },
    counts,
    records: rows.map((row) => {
      const profile = profilesById.get(row.user_id as string);
      return {
        id: row.id,
        userId: row.user_id,
        name: profileDisplayName(profile),
        avatarUrl: profile?.avatar_url ?? null,
        date: row.attendance_date,
        status: row.status,
        expectedClockInAt: row.expected_clock_in_at,
        actualClockInAt: row.actual_clock_in_at,
        notes: row.notes,
      };
    }),
    message: `${rows.length} attendance record(s) found.`,
  };
}

async function toolGetLeaveBalance(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const profile = await resolveTargetProfile(adminClient, ctx, payload);
  if (!profile?.id) return { ok: false, error: "User not found." };

  const totalDays = Number(profile.leave_days_total ?? 22);
  const remainingDays = Number(profile.leave_days_remaining ?? totalDays);
  const usedDays = Math.max(totalDays - remainingDays, 0);

  const { data: requests, error } = await adminClient
    .from("leave_requests")
    .select(
      "id, start_date, end_date, requested_days, status, reason, created_at",
    )
    .eq("organization_id", ctx.organizationId)
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;

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
    message: `${
      profileDisplayName(profile)
    } has ${remainingDays} leave day(s) remaining.`,
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
  const openTasks = tasks.filter((task) =>
    !CLOSED_STATUSES.has(String(task.status ?? ""))
  );
  const overdueTasks = openTasks.filter((task) =>
    task.due_date && new Date(task.due_date as string).getTime() < Date.now()
  );

  const profilesById = await fetchProfilesByIds(
    adminClient,
    ctx.organizationId,
    tasks.map((task) => task.assigned_to as string | null).filter(
      Boolean,
    ) as string[],
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
    message:
      `${board.name} has ${tasks.length} task(s), ${overdueTasks.length} overdue.`,
  };
}

async function toolCreateBoardCard(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
  dryRun: boolean,
) {
  const title = readString(payload, "title");
  if (!title) {
    return { ok: false, error: "title is required." };
  }

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
  const dueDateRaw = readString(payload, "due_date") ??
    readString(payload, "dueDate");
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
      message:
        `Task suggestion "${suggestion.suggested_title}" was sent for approval.`,
    };
  }

  const { data: boardRow } = await adminClient
    .from("clients")
    .select("office_id")
    .eq("id", board.id)
    .maybeSingle();

  let officeId = boardRow?.office_id ?? null;
  if (!officeId) {
    const { data: profile } = await adminClient
      .from("profiles")
      .select("office_id")
      .eq("id", ctx.userId)
      .maybeSingle();
    officeId = profile?.office_id ?? null;
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

  return {
    ok: true,
    taskId: card.id,
    boardId: board.id,
    actionUrl,
    preview,
    message: `Created card "${card.title}" on board "${board.name}".`,
  };
}

async function toolNotifyContentReview(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
  dryRun: boolean,
) {
  const draftId = normalizeUuid(payload.draft_id ?? payload.draftId);
  if (!draftId) {
    return { ok: false, error: "draft_id is required." };
  }

  const title = readString(payload, "title") ?? "Content review update";
  const message = readString(payload, "message") ??
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
        admin.office_id && itsNoMatataOfficeIds.has(admin.office_id as string)
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
    const { error } = await adminClient.from("notifications").insert(
      notifications,
    );
    if (error) throw error;
  }

  return {
    ok: true,
    draftId,
    actionUrl,
    recipientCount: notifications.length,
    message:
      `Notified ${notifications.length} team member(s) about the content draft.`,
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
  const queryText = readString(payload, "query") ??
    readString(payload, "search") ?? "";
  const assetTag = readString(payload, "assetTag") ??
    readString(payload, "asset_tag");
  const serialNumber = readString(payload, "serialNumber") ??
    readString(payload, "serial_number");
  const brand = readString(payload, "brand");
  const model = readString(payload, "model");
  const status = readString(payload, "status");
  const limit = typeof payload.limit === "number" ? payload.limit : 15;

  let query = adminClient
    .from("assets")
    .select(
      "id, asset_name, asset_tag, serial_number, status, brand, model, condition, assigned_to, updated_at",
    )
    .eq("organization_id", ctx.organizationId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (queryText) {
    query = query.or(
      `asset_name.ilike.%${queryText}%,asset_tag.ilike.%${queryText}%,serial_number.ilike.%${queryText}%,brand.ilike.%${queryText}%,model.ilike.%${queryText}%`,
    );
  }
  if (assetTag) query = query.ilike("asset_tag", `%${assetTag}%`);
  if (serialNumber) query = query.ilike("serial_number", `%${serialNumber}%`);
  if (brand) query = query.ilike("brand", `%${brand}%`);
  if (model) query = query.ilike("model", `%${model}%`);
  if (status) query = query.ilike("status", `%${status}%`);

  const { data, error } = await query;
  if (error) throw error;

  return {
    ok: true,
    assets: ((data ?? []) as DbRow[]).map((asset) => ({
      id: asset.id,
      name: asset.asset_name,
      assetName: asset.asset_name,
      assetTag: asset.asset_tag,
      serialNumber: asset.serial_number,
      status: asset.status,
      brand: asset.brand,
      model: asset.model,
      condition: asset.condition,
      assetUrl: typeof asset.id === "string" ? `/assets/${asset.id}` : null,
    })),
    count: data?.length ?? 0,
    filters: {
      query: queryText || null,
      assetTag: assetTag || null,
      serialNumber: serialNumber || null,
      brand: brand || null,
      model: model || null,
      status: status || null,
    },
  };
}

async function toolSearchPeople(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const queryText = readString(payload, "query") ??
    readString(payload, "search") ?? "";
  const department = readString(payload, "department");
  const role = readString(payload, "role");
  const status = readString(payload, "status") ??
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
      phone: isManagerRole(ctx.role) || profile.id === ctx.userId
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
  const queryText = readString(payload, "query") ??
    readString(payload, "search") ?? "";
  const status = readString(payload, "status");
  const priority = readString(payload, "priority");
  const boardId = normalizeUuid(
    payload.board_id ?? payload.boardId ?? payload.client_id ??
      payload.clientId,
  );
  const assignedTo = normalizeUuid(
    payload.assigned_to ?? payload.assignedTo ?? payload.user_id ??
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
    tasks.map((task) => task.assigned_to as string | null).filter(
      Boolean,
    ) as string[],
  );

  const boardIds = [
    ...new Set(
      tasks.map((task) => task.client_id as string | null).filter(
        Boolean,
      ) as string[],
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
    for (const board of boards ?? []) boardsById.set(board.id as string, board);
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
  const taskId = normalizeUuid(payload.task_id ?? payload.taskId ?? payload.id);
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
    !isManagerRole(ctx.role) && task.assigned_to !== ctx.userId &&
    task.created_by !== ctx.userId
  ) {
    return {
      ok: false,
      error: "You can only update tasks assigned to you or created by you.",
    };
  }

  const update: DbRow = {};
  const title = readString(payload, "title");
  const description = typeof payload.description === "string"
    ? payload.description
    : undefined;
  const status = readString(payload, "status");
  const priority = readString(payload, "priority");
  const dueDate = readString(payload, "due_date") ??
    readString(payload, "dueDate");
  const assignedTo = normalizeUuid(payload.assigned_to ?? payload.assignedTo);

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
  const queryText = readString(payload, "query") ??
    readString(payload, "search") ?? "";
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
    rows.map((row) => row.user_id as string | null).filter(Boolean) as string[],
  );
  const taskIds = [
    ...new Set(
      rows.map((row) => row.task_id as string | null).filter(
        Boolean,
      ) as string[],
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
    const seconds = entry.is_running && entry.started_at
      ? secondsBetween(entry.started_at as string)
      : Number(entry.duration_seconds ?? 0);
    const profile = profilesById.get(entry.user_id as string);
    const task = entry.task_id ? tasksById.get(entry.task_id as string) : null;
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
  const taskId = normalizeUuid(payload.task_id ?? payload.taskId);
  const boardId = normalizeUuid(
    payload.board_id ?? payload.boardId ?? payload.client_id ??
      payload.clientId,
  );
  const description = readString(payload, "description") ??
    readString(payload, "note") ?? "Started from Codex assistant";
  const now = new Date().toISOString();

  const { data: running, error: runningError } = await adminClient
    .from("time_entries")
    .select("id, started_at, description")
    .eq("organization_id", ctx.organizationId)
    .eq("user_id", ctx.userId)
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
    user_id: ctx.userId,
    task_id: taskId,
    client_id: boardId,
    description,
    started_at: now,
    is_running: true,
    source: "codex_ai",
    entry_type: "timer",
    is_billable: payload.is_billable === true || payload.isBillable === true,
    metadata: { source: "codex_execute_tool" },
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
    .select("id, task_id, client_id, description, started_at, is_running")
    .single();

  if (error) throw error;

  return {
    ok: true,
    entry: data,
    message: "Started your time tracker.",
  };
}

async function toolStopTimeTracker(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
  dryRun: boolean,
) {
  const entryId = normalizeUuid(
    payload.entry_id ?? payload.entryId ?? payload.id,
  );
  const now = new Date().toISOString();

  let query = adminClient
    .from("time_entries")
    .select("id, user_id, started_at, description")
    .eq("organization_id", ctx.organizationId)
    .eq("is_running", true)
    .is("ended_at", null)
    .limit(1);

  if (entryId) query = query.eq("id", entryId);
  else query = query.eq("user_id", ctx.userId);
  if (!entryId || !isManagerRole(ctx.role)) {
    query = query.eq("user_id", ctx.userId);
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

  return {
    ok: true,
    entry: data,
    durationSeconds,
    durationHours: Number((durationSeconds / 3600).toFixed(2)),
    message: "Stopped the time tracker.",
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
      error: `${actionLabels[toolId] ?? toolId} requires a manager or admin role.`,
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
    message:
      `${actionLabels[toolId] ?? toolId} is ready for review. Confirm in the relevant module before it is applied.`,
  };
}

async function toolSearchUsersClockedIn(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const date = (readString(payload, "date") ?? new Date().toISOString()).slice(
    0,
    10,
  );
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
  const queryText = readString(payload, "query") ??
    readString(payload, "search") ?? "";

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
      assetUrl: typeof asset.id === "string" ? `/assets/${asset.id}` : null,
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
  const { from, to } = readDateRange(payload, 30);
  const status = readString(payload, "status");
  const profile = await resolveTargetProfile(adminClient, ctx, payload);
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
    .gte("start_date", from.slice(0, 10))
    .lte("start_date", to.slice(0, 10))
    .order("start_date", { ascending: false })
    .limit(limit);

  if (profile?.id) query = query.eq("user_id", profile.id);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as DbRow[];
  const profilesById = await fetchProfilesByIds(
    adminClient,
    ctx.organizationId,
    rows.map((row) => row.user_id as string | null).filter(Boolean) as string[],
  );
  const typeIds = [
    ...new Set(
      rows.map((row) => row.leave_type_id as string | null).filter(
        Boolean,
      ) as string[],
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
        approvedAt: row.approved_at,
        rejectionReason: isManagerRole(ctx.role) ? row.rejection_reason : null,
        adminNotes: isManagerRole(ctx.role) ? row.admin_notes : null,
        createdAt: row.created_at,
      };
    }),
    count: rows.length,
    message: `${rows.length} leave request(s) found.`,
  };
}

async function toolSearchMeetings(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const { from, to } = readDateRange(payload, 30);
  const queryText = readString(payload, "query") ??
    readString(payload, "search") ?? "";
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
    query = ids.length > 0
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
    meetings.map((meeting) => meeting.host_id as string | null).filter(
      Boolean,
    ) as string[],
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
        meetingUrl: typeof meeting.id === "string"
          ? `/meetings/${meeting.id}`
          : null,
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
  const queryText = readString(payload, "query") ??
    readString(payload, "search") ?? "";
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
    query = query.or(`title.ilike.%${queryText}%,summary.ilike.%${queryText}%`);
  }
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as DbRow[];
  const clientIds = [
    ...new Set(
      rows.map((row) => row.client_id as string | null).filter(
        Boolean,
      ) as string[],
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
      reportUrl: typeof report.id === "string" ? `/reports/${report.id}` : null,
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
  const queryText = readString(payload, "query") ??
    readString(payload, "search") ?? "";
  const documentType = readString(payload, "document_type") ??
    readString(payload, "documentType");
  const limit = Math.min(
    typeof payload.limit === "number" ? payload.limit : 30,
    100,
  );

  if (!isManagerRole(ctx.role)) {
    const { data: recipients, error: recipientError } = await adminClient
      .from("employee_document_recipients")
      .select("document_id, status, delivered_at, read_at, acknowledged_at")
      .eq("organization_id", ctx.organizationId)
      .eq("user_id", ctx.userId)
      .order("delivered_at", { ascending: false })
      .limit(limit);
    if (recipientError) throw recipientError;

    const recipientRows = (recipients ?? []) as DbRow[];
    const docIds = recipientRows.map((row) => row.document_id as string | null)
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
      error: "Social post search is available to media, managers, and admins.",
    };
  }

  const queryText = readString(payload, "query") ??
    readString(payload, "search") ?? "";
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
    query = query.or(`owner_id.eq.${ctx.userId},created_by.eq.${ctx.userId}`);
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
      posts.map((post) => post.client_id as string | null).filter(
        Boolean,
      ) as string[],
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
      postUrl: typeof post.id === "string" ? `/social-posts/${post.id}` : null,
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
      schedules.map((row) => row.vehicle_id as string | null).filter(
        Boolean,
      ) as string[],
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
      const dueByDate = typeof schedule.next_service_date === "string" &&
        schedule.next_service_date <= today;
      const dueByOdometer =
        Number(vehicle?.current_odometer_km ?? 0) >=
          Number(schedule.next_service_odometer_km ?? Number.POSITIVE_INFINITY);
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
    message:
      `${schedules.length} fleet service schedule(s) due within ${horizonDays} day(s).`,
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

  const rows = ((data ?? []) as DbRow[]).filter((row) =>
    canAccessDocument(ctx, row) &&
    !/infranodus/i.test(String(row.source_url ?? ""))
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
      ? `I know about ${rows.length} document(s): ${
        rows.map((doc) => doc.document_name).slice(0, 12).join(", ")
      }.`
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

  const docRows = ((docs ?? []) as DbRow[]).filter((doc) =>
    canAccessDocument(ctx, doc) && !looksLikeHtml(doc.summary_detailed) &&
    !/infranodus/i.test(String(doc.source_url ?? ""))
  );

  const results = docRows.map((doc) => ({
    id: doc.id,
    name: doc.document_name,
    type: doc.file_type,
    url: cleanDocumentUrl(doc.source_url),
    snippet: snippet(doc.summary_short || doc.summary_detailed, 700),
    score:
      safeQuery &&
        String(doc.document_name ?? "").toLowerCase().includes(
          safeQuery.toLowerCase(),
        )
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
      return doc && canAccessDocument(ctx, doc) &&
        !looksLikeHtml(chunk.chunk_text) &&
        !/infranodus/i.test(String(doc.source_url ?? ""));
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
  const queryText = readString(payload, "query") ??
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
          p_match_threshold: typeof payload.threshold === "number"
            ? payload.threshold
            : 0.2,
          p_match_count: limit,
        },
      );
      if (error) throw error;

      const vectorResults = ((data ?? []) as DbRow[])
        .filter((row) =>
          !looksLikeHtml(row.snippet) &&
          !/infranodus/i.test(String(row.url ?? ""))
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
          message:
            `Found ${vectorResults.length} internal document result(s) for "${queryText}".`,
        };
      }
    } catch (error) {
      console.warn(
        "Vector document search failed; falling back to text search:",
        error,
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
  const name = readString(payload, "name") ?? readString(payload, "filename") ??
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
    return { ok: false, error: "You do not have access to this document." };
  }
  if (/infranodus/i.test(String(data.source_url ?? ""))) {
    return {
      ok: false,
      error: "This document source is not an internal document index entry.",
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
        : String(chunk.chunk_text ?? "")
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
    const toolId = typeof body.toolId === "string" ? body.toolId.trim() : "";
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

    if (internalCall) {
      userId = body.context?.userId ?? "";
      organizationId = body.context?.organizationId ?? "";
      role = body.context?.role ?? null;
      department = body.context?.department ?? null;
      fullName = body.context?.fullName ?? null;

      if (!userId || !organizationId) {
        return jsonResponse({
          error:
            "context.userId and context.organizationId are required for n8n tool calls.",
        }, 400);
      }
    } else {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      });

      const { data: authData, error: authError } = await userClient.auth
        .getUser(token!);

      if (authError || !authData.user) {
        return jsonResponse({ error: "Invalid or expired session." }, 401);
      }

      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .select(
          "id, organization_id, primary_role, department, full_name, account_status, is_suspended",
        )
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.organization_id) {
        return jsonResponse({ error: "Missing organization context." }, 403);
      }

      if (profile.account_status !== "active" || profile.is_suspended) {
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
    }

    const ctx: Required<ToolContext> = {
      userId,
      organizationId,
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

      default:
        return jsonResponse({ error: `Unsupported toolId: ${toolId}` }, 400);
    }

    return jsonResponse({
      ok: true,
      toolId,
      internalCall,
      context: {
        userId,
        organizationId,
        role,
        department,
      },
      result,
    });
  } catch (error) {
    console.error("codex-execute-tool error:", error);

    const message = error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : JSON.stringify(error, null, 2);

    return jsonResponse(
      {
        ok: false,
        error: message,
        rawError: error,
      },
      500,
    );
  }
});
