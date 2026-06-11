import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ScheduledAction = {
  id: string;
  organization_id: string;
  requested_by: string;
  target_user_id: string | null;
  tool_id: string;
  payload: Record<string, unknown>;
  scheduled_for: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-api-key, x-codex-internal-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function hasInternalSecret(req: Request) {
  const secret = Deno.env.get("INTERNAL_API_KEY") ??
    Deno.env.get("CODEX_TOOL_SECRET");
  if (!secret) return false;
  const inbound = req.headers.get("x-codex-internal-key") ??
    req.headers.get("x-internal-api-key");
  return inbound === secret;
}

function secondsBetween(start: string, end = new Date().toISOString()) {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
  if (!hasInternalSecret(req)) return jsonResponse({ error: "Unauthorized." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase service configuration." }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("ai_scheduled_actions")
    .select("id, organization_id, requested_by, target_user_id, tool_id, payload, scheduled_for")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(25);

  if (error) return jsonResponse({ error: error.message }, 500);

  const actions = (data ?? []) as ScheduledAction[];
  let completed = 0;
  let failed = 0;

  for (const action of actions) {
    const { error: claimError } = await admin
      .from("ai_scheduled_actions")
      .update({ status: "running", updated_at: now })
      .eq("id", action.id)
      .eq("status", "pending");

    if (claimError) {
      failed += 1;
      continue;
    }

    try {
      if (action.tool_id !== "start_time_tracker") {
        throw new Error(`Unsupported scheduled action: ${action.tool_id}`);
      }
      if (!action.target_user_id) {
        throw new Error("Scheduled timer has no target user.");
      }

      const { data: running, error: runningError } = await admin
        .from("time_entries")
        .select("id")
        .eq("organization_id", action.organization_id)
        .eq("user_id", action.target_user_id)
        .eq("is_running", true)
        .is("ended_at", null)
        .is("deleted_at", null)
        .limit(1);
      if (runningError) throw runningError;
      if ((running ?? []).length > 0) {
        throw new Error("User already has a running timer.");
      }

      const taskId = typeof action.payload.taskId === "string"
        ? action.payload.taskId
        : typeof action.payload.task_id === "string"
        ? action.payload.task_id
        : null;
      let task: Record<string, unknown> | null = null;
      if (taskId) {
        const { data: taskData, error: taskError } = await admin
          .from("tasks")
          .select("id, organization_id, office_id, project_id, client_id, campaign_id, title")
          .eq("organization_id", action.organization_id)
          .eq("id", taskId)
          .maybeSingle();
        if (taskError) throw taskError;
        task = taskData ?? null;
      }

      const startedAt = new Date().toISOString();
      const { error: insertError } = await admin
        .from("time_entries")
        .insert({
          organization_id: action.organization_id,
          office_id: task?.office_id ?? null,
          user_id: action.target_user_id,
          task_id: task?.id ?? taskId,
          project_id: task?.project_id ?? null,
          client_id: task?.client_id ?? action.payload.boardId ?? null,
          campaign_id: task?.campaign_id ?? null,
          description: typeof action.payload.description === "string"
            ? action.payload.description
            : task?.title
            ? `Working on ${task.title}`
            : "Scheduled timer started by Codex",
          started_at: startedAt,
          ended_at: null,
          is_running: true,
          duration_seconds: 0,
          source: "codex_ai_scheduled",
          entry_type: "timer",
          metadata: {
            scheduled_action_id: action.id,
            requested_by: action.requested_by,
            scheduled_for: action.scheduled_for,
            seconds_late: secondsBetween(action.scheduled_for, startedAt),
          },
        });
      if (insertError) throw insertError;

      await admin
        .from("ai_scheduled_actions")
        .update({
          status: "completed",
          executed_at: startedAt,
          updated_at: startedAt,
          last_error: null,
        })
        .eq("id", action.id);
      completed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await admin
        .from("ai_scheduled_actions")
        .update({
          status: "failed",
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", action.id);
      failed += 1;
    }
  }

  return jsonResponse({ ok: true, checked: actions.length, completed, failed });
});
