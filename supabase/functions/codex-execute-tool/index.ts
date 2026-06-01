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

async function resolveBoardId(
  adminClient: ReturnType<typeof createClient>,
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

  const exact = (data ?? []).find(
    (row) => String(row.name ?? "").toLowerCase() === boardName.toLowerCase(),
  );
  return exact ?? data?.[0] ?? null;
}

async function resolveAssigneeIds(
  adminClient: ReturnType<typeof createClient>,
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
  adminClient: ReturnType<typeof createClient>,
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
  adminClient: ReturnType<typeof createClient>,
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

  const assignedTaskIds = (assigneeRows ?? []).map((row) => row.task_id as string);
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
  adminClient: ReturnType<typeof createClient>,
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
    boards: (data ?? []).map((board) => ({
      id: board.id,
      name: board.name,
      status: board.status,
    })),
    message: `${data?.length ?? 0} board(s) found.`,
  };
}

async function toolCreateBoardCard(
  adminClient: ReturnType<typeof createClient>,
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
  const canCreateDirectly = MANAGER_ROLES.has(String(ctx.role ?? "").toLowerCase());

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
  adminClient: ReturnType<typeof createClient>,
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
        .map((admin) => admin.office_id as string | null)
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
        .filter((office) => office.slug === "its-no-matata")
        .map((office) => office.id as string),
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
      case "create_board_card":
        result = await toolCreateBoardCard(adminClient, ctx, payload, dryRun);
        break;
      case "notify_content_review":
        result = await toolNotifyContentReview(adminClient, ctx, payload, dryRun);
        break;
      default:
        return jsonResponse({
          error: `Unknown toolId: ${toolId}`,
          allowedTools: [
            "summarize_my_tasks",
            "list_boards",
            "create_board_card",
            "notify_content_review",
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
