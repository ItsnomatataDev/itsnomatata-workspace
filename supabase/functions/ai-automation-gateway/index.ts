import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type AutomationPayload = {
  source?: string;
  organization_id?: string;
  user_id?: string;
  role?: string;
  department?: string;
  instruction?: string;
  context?: Record<string, unknown>;
  allowed_actions?: string[];
};

type RecommendedAction = {
  type?: string;
  title?: string;
  description?: string;
  priority?: string;
  assignee?: string;
  assignee_id?: string;
  due_date?: string;
  department?: string;
  requires_approval?: boolean;
  reason?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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

function isReviewerRole(role: string | null | undefined) {
  return ["admin", "manager", "it", "superadmin", "it-superadmin"].includes(role ?? "");
}

function normalizeAllowedActions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePriority(value: unknown) {
  return ["low", "medium", "high", "urgent"].includes(String(value))
    ? String(value)
    : "medium";
}

function normalizeUuid(value: unknown) {
  if (typeof value !== "string") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value)
    ? value
    : null;
}

function getRecommendedActions(responseJson: Record<string, unknown>): RecommendedAction[] {
  const value = responseJson.recommended_actions;
  if (!Array.isArray(value)) return [];

  return value.filter(isRecord).map((item) => ({
    type: typeof item.type === "string" ? item.type : undefined,
    title: typeof item.title === "string" ? item.title : undefined,
    description: typeof item.description === "string" ? item.description : undefined,
    priority: typeof item.priority === "string" ? item.priority : undefined,
    assignee: typeof item.assignee === "string" ? item.assignee : undefined,
    assignee_id: typeof item.assignee_id === "string" ? item.assignee_id : undefined,
    due_date: typeof item.due_date === "string" ? item.due_date : undefined,
    department: typeof item.department === "string" ? item.department : undefined,
    requires_approval: typeof item.requires_approval === "boolean"
      ? item.requires_approval
      : true,
    reason: typeof item.reason === "string" ? item.reason : undefined,
  }));
}

async function resolveAssigneeId(
  adminClient: any,
  organizationId: string,
  action: RecommendedAction,
) {
  const directId = normalizeUuid(action.assignee_id) ?? normalizeUuid(action.assignee);
  if (directId) return directId;

  const search = action.assignee?.trim();
  if (!search) return null;

  const { data } = await adminClient
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    .limit(1)
    .maybeSingle();

  return typeof data?.id === "string" ? data.id : null;
}

async function persistTaskAutomationActions(
  adminClient: any,
  params: {
    organizationId: string;
    userId: string;
    role: string | null;
    department: string | null;
    source: string;
    runId: string | null;
    allowedActions: string[];
    responseJson: Record<string, unknown>;
  },
) {
  const actions = getRecommendedActions(params.responseJson).filter((action) =>
    action.type === "create_task" && action.title?.trim()
  );

  const results: Array<Record<string, unknown>> = [];
  const canCreateDirectly =
    params.allowedActions.includes("create_task") && isReviewerRole(params.role);

  for (const action of actions) {
    const assigneeId = await resolveAssigneeId(
      adminClient,
      params.organizationId,
      action,
    );
    const requiresApproval = action.requires_approval !== false || !canCreateDirectly;
    const priority = normalizePriority(action.priority);
    const dueDate = action.due_date ? new Date(action.due_date) : null;
    const validDueDate = dueDate && !Number.isNaN(dueDate.getTime())
      ? dueDate.toISOString()
      : null;

    if (!requiresApproval) {
      const { data, error } = await adminClient
        .from("tasks")
        .insert({
          organization_id: params.organizationId,
          title: action.title!.trim(),
          description: action.description ?? null,
          status: "todo",
          priority,
          due_date: validDueDate,
          department: action.department ?? params.department,
          assigned_to: assigneeId,
          created_by: params.userId,
          assigned_by: params.userId,
          position: 0,
          ai_generated: true,
          metadata: {
            source: params.source,
            automation_run_id: params.runId,
            reason: action.reason ?? null,
            created_by_ai_gateway: true,
          },
        })
        .select("id, title")
        .single();

      if (error) {
        results.push({
          type: "task_create_failed",
          title: action.title,
          error: error.message,
        });
        continue;
      }

      results.push({
        type: "task_created",
        task_id: data.id,
        title: data.title,
      });
      continue;
    }

    const { data, error } = await adminClient
      .from("ai_task_suggestions")
      .insert({
        organization_id: params.organizationId,
        automation_run_id: params.runId,
        source: params.source,
        suggested_title: action.title!.trim(),
        suggested_description: action.description ?? null,
        suggested_priority: priority,
        suggested_assignee: assigneeId,
        suggested_due_date: validDueDate,
        suggested_department: action.department ?? params.department,
        requires_approval: true,
        reason: action.reason ?? "AI recommended creating this task from the manual workspace request.",
        status: "pending",
        created_by: params.userId,
        metadata: {
          raw_action: action,
          source_response: "n8n",
        },
      })
      .select("id, suggested_title")
      .single();

    if (error) {
      results.push({
        type: "task_suggestion_failed",
        title: action.title,
        error: error.message,
      });
      continue;
    }

    results.push({
      type: "task_suggestion_created",
      suggestion_id: data.id,
      title: data.suggested_title,
    });

    if (assigneeId) {
      await adminClient.from("notifications").insert({
        organization_id: params.organizationId,
        user_id: assigneeId,
        type: "approval_needed",
        title: "AI task suggestion needs review",
        message: action.title,
        entity_type: "ai_task_suggestion",
        entity_id: data.id,
        action_url: "/ai-automation-review",
        priority: priority === "urgent" ? "urgent" : "medium",
        category: "automation",
        actor_user_id: params.userId,
        metadata: {
          automation_run_id: params.runId,
          reason: action.reason ?? null,
        },
      });
    }
  }

  return results;
}

async function createRunLog(
  adminClient: any,
  params: {
    organizationId: string;
    userId: string;
    role: string | null;
    department: string | null;
    source: string;
    status: string;
    summary?: string | null;
    allowedActions?: string[];
    inputPayload?: Record<string, unknown>;
    outputPayload?: Record<string, unknown>;
    errors?: unknown[];
  },
) {
  const { data, error } = await adminClient
    .from("ai_automation_runs")
    .insert({
      organization_id: params.organizationId,
      requested_by: params.userId,
      role: params.role,
      department: params.department,
      source: params.source,
      status: params.status,
      summary: params.summary ?? null,
      allowed_actions: params.allowedActions ?? [],
      input_payload: params.inputPayload ?? {},
      output_payload: params.outputPayload ?? {},
      errors: params.errors ?? [],
      completed_at: ["success", "failed", "approval_required"].includes(params.status)
        ? new Date().toISOString()
        : null,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("Failed to create AI automation run log:", error.message);
    return null;
  }

  return data?.id ?? null;
}

async function createActivityLog(
  adminClient: any,
  params: {
    organizationId: string;
    userId: string;
    source: string;
    action: string;
    status: string;
    riskLevel?: string;
    requiresApproval?: boolean;
    reason?: string | null;
    requestPayload?: Record<string, unknown>;
    responsePayload?: Record<string, unknown>;
    errorMessage?: string | null;
  },
) {
  const { error } = await adminClient.from("ai_activity_logs").insert({
    organization_id: params.organizationId,
    user_id: params.userId,
    source: params.source,
    action: params.action,
    status: params.status,
    risk_level: params.riskLevel ?? "safe",
    requires_approval: params.requiresApproval ?? false,
    reason: params.reason ?? null,
    request_payload: params.requestPayload ?? {},
    response_payload: params.responsePayload ?? {},
    error_message: params.errorMessage ?? null,
  });

  if (error) {
    console.warn("Failed to create AI activity log:", error.message);
  }
}

async function safeCount(
  adminClient: any,
  table: string,
  organizationId: string,
  statusColumn?: string,
  statusValue?: string,
) {
  let query = adminClient
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (statusColumn && statusValue) {
    query = query.eq(statusColumn, statusValue);
  }

  const { count, error } = await query;

  return {
    table,
    ok: !error,
    count: error ? 0 : count ?? 0,
    error: error?.message ?? null,
  };
}

async function checkTable(
  adminClient: any,
  table: string,
) {
  const { error } = await adminClient
    .from(table)
    .select("id", { count: "exact", head: true })
    .limit(1);

  return {
    table,
    ok: !error,
    error: error?.message ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: "AI automation gateway is not configured." }, 500);
    }

    const token = getBearerToken(req);
    if (!token) return jsonResponse({ error: "Missing Authorization bearer token." }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) {
      return jsonResponse({ error: "Invalid or expired session." }, 401);
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, organization_id, primary_role, department, account_status, is_suspended")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile?.organization_id) {
      return jsonResponse({ error: "Missing organization context." }, 403);
    }
    if (profile.account_status !== "active" || profile.is_suspended) {
      return jsonResponse({ error: "Inactive users cannot use AI automation." }, 403);
    }

    const organizationId = profile.organization_id as string;
    const userId = authData.user.id;
    const role = profile.primary_role as string | null;
    const department = profile.department as string | null;

    if (req.method === "GET") {
      if (!isReviewerRole(role)) {
        return jsonResponse({ error: "Only admins, managers, or IT can review AI automation status." }, 403);
      }

      const requiredTables = [
        "automation_flows",
        "automation_runs",
        "ai_automation_rules",
        "ai_automation_runs",
        "ai_task_suggestions",
        "ai_document_summaries",
        "ai_chat_suggestions",
        "ai_report_summaries",
        "ai_activity_logs",
        "ai_approvals",
        "tasks",
        "chat_messages",
        "notifications",
        "meetings",
        "employee_documents",
        "leave_requests",
        "social_posts",
        "fleet_service_schedules",
        "reports",
        "attendance_daily_status",
      ];

      const [tableChecks, counts] = await Promise.all([
        Promise.all(requiredTables.map((table) => checkTable(adminClient, table))),
        Promise.all([
          safeCount(adminClient, "automation_flows", organizationId),
          safeCount(adminClient, "automation_runs", organizationId),
          safeCount(adminClient, "ai_automation_rules", organizationId),
          safeCount(adminClient, "ai_automation_runs", organizationId),
          safeCount(adminClient, "ai_task_suggestions", organizationId, "status", "pending"),
          safeCount(adminClient, "ai_activity_logs", organizationId),
          safeCount(adminClient, "ai_approvals", organizationId, "status", "pending"),
          safeCount(adminClient, "leave_requests", organizationId, "status", "pending"),
          safeCount(adminClient, "social_posts", organizationId, "status", "scheduled"),
          safeCount(adminClient, "fleet_service_schedules", organizationId, "status", "active"),
          safeCount(adminClient, "reports", organizationId),
        ]),
      ]);

      return jsonResponse({
        ok: true,
        checkedAt: new Date().toISOString(),
        organizationId,
        gateway: {
          status: "healthy",
          n8nWebhookConfigured: Boolean(Deno.env.get("N8N_AI_AUTOMATION_WEBHOOK_URL")),
          n8nApiKeyConfigured: Boolean(Deno.env.get("N8N_AI_AUTOMATION_API_KEY")),
        },
        tableChecks,
        counts,
        recommendations: [
          "Start with chat-to-task suggestions because the task, chat, notification, and approval foundations already exist.",
          "Keep document and report summaries read-only until summaries and source access policies are verified.",
          "Put email-to-task behind manager/admin approval because email content can contain sensitive client or finance data.",
          "Use the Codex execute-tool wrappers for read-only leave, meeting, report, document, social post, and fleet service lookups.",
          "Keep publish, approve, schedule, send, role-change, and delete actions behind explicit confirmation and existing admin screens.",
        ],
      });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const body = (await req.json().catch(() => ({}))) as AutomationPayload;
    const source = typeof body.source === "string" ? body.source : "manual";
    const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
    const allowedActions = normalizeAllowedActions(body.allowed_actions);

    if (!instruction) {
      return jsonResponse({ error: "instruction is required." }, 400);
    }

    if (body.organization_id && body.organization_id !== organizationId) {
      return jsonResponse({ error: "Payload organization does not match the authenticated user." }, 403);
    }

    if (body.user_id && body.user_id !== userId && !isReviewerRole(role)) {
      return jsonResponse({ error: "Users can only request automation for themselves." }, 403);
    }

    const payload = {
      source,
      organization_id: organizationId,
      user_id: userId,
      role: role ?? "employee",
      department,
      instruction,
      context: body.context ?? {},
      allowed_actions: allowedActions,
    };

    const n8nWebhookUrl = Deno.env.get("N8N_AI_AUTOMATION_WEBHOOK_URL");

    await createActivityLog(adminClient, {
      organizationId,
      userId,
      source,
      action: "automation_requested",
      status: n8nWebhookUrl ? "success" : "blocked",
      riskLevel: "needs_approval",
      requiresApproval: true,
      reason: n8nWebhookUrl
        ? "Automation request accepted and forwarded through the server-side gateway."
        : "n8n automation webhook is not configured.",
      requestPayload: payload,
    });

    if (!n8nWebhookUrl) {
      const runId = await createRunLog(adminClient, {
        organizationId,
        userId,
        role,
        department,
        source,
        status: "approval_required",
        summary: "n8n automation webhook is not configured. Request was logged only.",
        allowedActions,
        inputPayload: payload,
        outputPayload: {
          status: "not_configured",
          recommended_actions: [],
        },
      });

      return jsonResponse({
        status: "success",
        run_id: runId,
        summary: "AI automation gateway is ready, but n8n is not configured yet.",
        suggestions: [],
        recommended_actions: [],
        logs: ["Request logged in Supabase. Configure N8N_AI_AUTOMATION_WEBHOOK_URL to forward requests."],
        errors: [],
      });
    }

    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(Deno.env.get("N8N_AI_AUTOMATION_API_KEY")
          ? { "x-api-key": Deno.env.get("N8N_AI_AUTOMATION_API_KEY")! }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let responseJson: Record<string, unknown> = {};
    try {
      responseJson = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseJson = { raw: responseText };
    }

    const ok = response.ok;
    const runId = await createRunLog(adminClient, {
      organizationId,
      userId,
      role,
      department,
      source,
      status: ok ? "success" : "failed",
      summary: typeof responseJson.summary === "string" ? responseJson.summary : null,
      allowedActions,
      inputPayload: payload,
      outputPayload: ok ? responseJson : {},
      errors: ok ? [] : [responseJson],
    });

    await createActivityLog(adminClient, {
      organizationId,
      userId,
      source,
      action: "automation_forwarded_to_n8n",
      status: ok ? "success" : "failed",
      riskLevel: "needs_approval",
      requiresApproval: true,
      reason: ok ? "n8n returned a response." : "n8n returned an error response.",
      requestPayload: payload,
      responsePayload: responseJson,
      errorMessage: ok ? null : `n8n returned ${response.status}`,
    });

    const persistedActions = ok
      ? await persistTaskAutomationActions(adminClient, {
        organizationId,
        userId,
        role,
        department,
        source,
        runId,
        allowedActions,
        responseJson,
      })
      : [];

    return jsonResponse(
      {
        status: ok ? "success" : "error",
        run_id: runId,
        summary: typeof responseJson.summary === "string"
          ? responseJson.summary
          : ok
          ? "AI automation completed."
          : "AI automation failed.",
        suggestions: Array.isArray(responseJson.suggestions) ? responseJson.suggestions : [],
        recommended_actions: Array.isArray(responseJson.recommended_actions)
          ? responseJson.recommended_actions
          : [],
        logs: [
          ...(Array.isArray(responseJson.logs) ? responseJson.logs : []),
          ...persistedActions.map((item) => JSON.stringify(item)),
        ],
        errors: ok ? [] : [responseJson],
        persisted_actions: persistedActions,
        raw: responseJson,
      },
      ok ? 200 : 502,
    );
  } catch (error) {
    console.error("AI AUTOMATION GATEWAY ERROR:", error);
    return jsonResponse(
      {
        status: "error",
        summary: "AI automation gateway failed.",
        suggestions: [],
        recommended_actions: [],
        logs: [],
        errors: [error instanceof Error ? error.message : "Unknown error"],
      },
      500,
    );
  }
});
