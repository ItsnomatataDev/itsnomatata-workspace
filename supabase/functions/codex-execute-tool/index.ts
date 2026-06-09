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
  return value.length <= 10 ? `${value.slice(0, 10)}T00:00:00.000Z` : date.toISOString();
}

function readEndDateString(payload: Record<string, unknown>, key: string) {
  const value = readString(payload, key);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return value.length <= 10 ? `${value.slice(0, 10)}T23:59:59.999Z` : date.toISOString();
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

function profileDisplayName(profile: Record<string, unknown> | null | undefined) {
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
    .select("id, email, full_name, username, avatar_url, primary_role, department, office_id")
    .eq("organization_id", organizationId)
    .in("id", ids);

  if (error) throw error;
  for (const profile of data ?? []) profilesById.set(profile.id as string, profile);
  return profilesById;
}

async function resolveTargetProfile(
  adminClient: any,
  ctx: Required<ToolContext>,
  payload: Record<string, unknown>,
) {
  const requestedId = normalizeUuid(
    payload.user_id ?? payload.userId ?? payload.employee_id ?? payload.employeeId,
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
      .select("id, email, full_name, username, avatar_url, primary_role, department, leave_days_total, leave_days_remaining")
      .eq("organization_id", ctx.organizationId)
      .eq("id", ctx.userId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  let query = adminClient
    .from("profiles")
    .select("id, email, full_name, username, avatar_url, primary_role, department, leave_days_total, leave_days_remaining")
    .eq("organization_id", ctx.organizationId)
    .limit(5);

  if (requestedId) query = query.eq("id", requestedId);
  else if (requestedEmail) query = query.ilike("email", requestedEmail);
  else if (requestedName) query = query.or(`full_name.ilike.%${requestedName}%,username.ilike.%${requestedName}%,email.ilike.%${requestedName}%`);
  else query = query.eq("id", ctx.userId);

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
  const [{ data: primaryTasks, error: primaryError }, { data: assigneeRows, error: assigneeError }] =
    await Promise.all([
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

  const assignedTaskIds = ((assigneeRows ?? []) as DbRow[]).map((row) => row.task_id as string);
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

  let query = adminClient
    .from("time_entries")
    .select("id, user_id, task_id, client_id, project_id, description, started_at, duration_seconds, is_running")
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

  const taskIds = [...new Set(rows.map((row) => row.task_id as string | null).filter(Boolean) as string[])];
  const boardIds = [...new Set(rows.map((row) => row.client_id as string | null).filter(Boolean) as string[])];
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
      boardUrl: typeof row.client_id === "string" ? `/boards/${row.client_id}` : null,
      description: row.description,
      startedAt: row.started_at,
      elapsedSeconds,
    };
  });

  return {
    ok: true,
    count: trackers.length,
    trackers,
    message: trackers.length === 0
      ? "No one is currently tracking time."
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
    .select("id, task_id, client_id, project_id, description, started_at, ended_at, duration_seconds, is_running, is_billable, approval_status, source")
    .eq("organization_id", ctx.organizationId)
    .eq("user_id", profile.id)
    .gte("started_at", from)
    .lte("started_at", to)
    .order("started_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  const entries = (data ?? []) as DbRow[];
  const taskIds = [...new Set(entries.map((row) => row.task_id as string | null).filter(Boolean) as string[])];
  const boardIds = [...new Set(entries.map((row) => row.client_id as string | null).filter(Boolean) as string[])];
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
      taskTitle: entry.task_id ? tasksById.get(entry.task_id as string)?.title ?? null : null,
      boardId: entry.client_id,
      boardName: entry.client_id ? boardsById.get(entry.client_id as string)?.name ?? null : null,
      taskUrl: buildTaskLink(entry.client_id, entry.task_id),
      boardUrl: typeof entry.client_id === "string" ? `/boards/${entry.client_id}` : null,
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
    message: `${profileDisplayName(profile)} tracked ${(totalSeconds / 3600).toFixed(2)} hour(s) in this period.`,
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
    normalizeUuid(payload.user_id ?? payload.userId ?? payload.employee_id ?? payload.employeeId) ||
      readString(payload, "user_name") ||
      readString(payload, "userName") ||
      readString(payload, "employee_name") ||
      readString(payload, "employeeName") ||
      readString(payload, "email") ||
      readString(payload, "user_email") ||
      readString(payload, "userEmail"),
  );
  const teamView = isManagerRole(ctx.role) && !hasTargetUser;
  const targetProfile = teamView ? null : await resolveTargetProfile(adminClient, ctx, payload);

  let query = adminClient
    .from("attendance_daily_status")
    .select("id, user_id, attendance_date, status, expected_clock_in_at, actual_clock_in_at, notes")
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
    .select("id, start_date, end_date, requested_days, status, reason, created_at")
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
    return { ok: false, error: "board_id or board_name is required and must match an existing board." };
  }

  const { data, error } = await adminClient
    .from("tasks")
    .select("id, title, status, priority, due_date, assigned_to, created_at, updated_at")
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
  const openTasks = tasks.filter((task) => !CLOSED_STATUSES.has(String(task.status ?? "")));
  const overdueTasks = openTasks.filter((task) =>
    task.due_date && new Date(task.due_date as string).getTime() < Date.now()
  );

  const profilesById = await fetchProfilesByIds(
    adminClient,
    ctx.organizationId,
    tasks.map((task) => task.assigned_to as string | null).filter(Boolean) as string[],
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
  if (!title) {
    return { ok: false, error: "title is required." };
  }

  const board = await resolveBoardId(adminClient, ctx.organizationId, payload);
  if (!board?.id) {
    return {
      ok: false,
      error: "board_id or board_name is required and must match an existing board.",
    };
  }

  const assigneeIds = await resolveAssigneeIds(
    adminClient,
    ctx.organizationId,
    payload,
  );
  const primaryAssignee = assigneeIds[0] ?? null;
  const priority = normalizePriority(payload.priority);
  const dueDateRaw = readString(payload, "due_date") ?? readString(payload, "dueDate");
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
    return { ok: true, dryRun: true, draftId, message: "Would notify content review team." };
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
      if (admin.office_id && itsNoMatataOfficeIds.has(admin.office_id as string)) {
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
    const { error } = await adminClient.from("notifications").insert(notifications);
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
    .select("id, type, title, message, is_read, created_at, action_url, priority, category")
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
  const assetTag = readString(payload, "assetTag") ?? readString(payload, "asset_tag");
  const serialNumber = readString(payload, "serialNumber") ?? readString(payload, "serial_number");
  const brand = readString(payload, "brand");
  const model = readString(payload, "model");
  const status = readString(payload, "status");
  const limit = typeof payload.limit === "number" ? payload.limit : 15;

  let query = adminClient
    .from("assets")
    .select("id, asset_name, asset_tag, serial_number, status, brand, model, condition, assigned_to, updated_at")
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
      return jsonResponse({ error: "codex-execute-tool is not configured." }, 500);
    }

    const body = (await req.json().catch(() => ({}))) as ExecuteToolBody;
    const toolId = typeof body.toolId === "string" ? body.toolId.trim() : "";
    const payload = isRecord(body.payload) ? body.payload : {};
    const dryRun = body.dryRun === true;

    if (!toolId) {
      return jsonResponse({ error: "toolId is required." }, 400);
    }

    const token = getBearerToken(req);
    if (!token) {
      return jsonResponse({ error: "Missing Authorization bearer token." }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let userId: string;
    let organizationId: string;
    let role: string | null = null;
    let department: string | null = null;
    let fullName: string | null = null;

    const internalCall = token === serviceRoleKey && hasInternalSecret(req);

    if (internalCall) {
      userId = body.context?.userId ?? "";
      organizationId = body.context?.organizationId ?? "";
      role = body.context?.role ?? null;
      department = body.context?.department ?? null;
      fullName = body.context?.fullName ?? null;

      if (!userId || !organizationId) {
        return jsonResponse({
          error: "context.userId and context.organizationId are required for n8n tool calls.",
        }, 400);
      }
    } else {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      });

      const { data: authData, error: authError } = await userClient.auth.getUser(token);
      if (authError || !authData.user) {
        return jsonResponse({ error: "Invalid or expired session." }, 401);
      }

      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .select("id, organization_id, primary_role, department, full_name, account_status, is_suspended")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile?.organization_id) {
        return jsonResponse({ error: "Missing organization context." }, 403);
      }
      if (profile.account_status !== "active" || profile.is_suspended) {
        return jsonResponse({ error: "Inactive users cannot run Codex tools." }, 403);
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
      case "notify_content_review":
        result = await toolNotifyContentReview(adminClient, ctx, payload, dryRun);
        break;
      case "search_notifications":
        result = await toolSearchNotifications(adminClient, ctx, payload);
        break;
      case "search_assets":
        result = await toolSearchAssets(adminClient, ctx, payload);
        break;
      default:
        return jsonResponse({
          error: `Unknown toolId: ${toolId}`,
          allowedTools: [
            "summarize_my_tasks",
            "list_boards",
            "get_active_time_trackers",
            "get_user_timesheet",
            "get_attendance_summary",
            "get_leave_balance",
            "get_board_task_summary",
            "create_board_card",
            "notify_content_review",
            "search_notifications",
            "search_assets",
          ],
        }, 400);
    }

    return jsonResponse({
      toolId,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("codex-execute-tool error:", message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
