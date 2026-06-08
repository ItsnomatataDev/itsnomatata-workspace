import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (!["GET", "POST"].includes(req.method)) {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: "System health function is not configured." }, 500);
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
      .select("id, organization_id, primary_role, account_status, is_suspended")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (
      !profile ||
      !["admin", "it", "superadmin", "it-superadmin"].includes(profile.primary_role ?? "") ||
      profile.account_status !== "active" ||
      profile.is_suspended
    ) {
      return jsonResponse({ error: "Only active admin or IT users can read system health." }, 403);
    }

    const organizationId = profile.organization_id;
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const organizationNotificationIds = await getOrganizationNotificationIds(
      adminClient,
      organizationId,
      since24h,
    );
    const importantTables = [
      "profiles",
      "tasks",
      "time_entries",
      "attendance_sessions",
      "notifications",
      "notification_deliveries",
      "account_access_requests",
      "admin_audit_logs",
      "incidents",
      "ai_workspace_logs",
    ];

    const tableChecks = await Promise.all(
      importantTables.map(async (table) => {
        const { error } = await adminClient.from(table).select("*", { head: true, count: "exact" }).limit(1);
        return { table, ok: !error, error: error?.message ?? null };
      }),
    );

    const [
      activeUsers,
      suspendedUsers,
      pendingRequests,
      activeTimers,
      activeAttendance,
      pushSubscriptions,
      failedDeliveries,
      incidents,
    ] = await Promise.all([
      adminClient.from("profiles").select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId).eq("account_status", "active"),
      adminClient.from("profiles").select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId).eq("account_status", "suspended"),
      adminClient.from("account_access_requests").select("id", { head: true, count: "exact" })
        .or(`organization_id.eq.${organizationId},organization_id.is.null`).eq("status", "pending"),
      adminClient.from("time_entries").select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId).is("ended_at", null).is("deleted_at", null),
      adminClient.from("attendance_sessions").select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId).eq("status", "active").is("clock_out_at", null),
      adminClient.from("push_subscriptions").select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId),
      organizationNotificationIds.length > 0
        ? adminClient.from("notification_deliveries").select("id", { head: true, count: "exact" })
          .gte("created_at", since24h)
          .in("status", ["failed", "error"])
          .in("notification_id", organizationNotificationIds)
        : Promise.resolve({ count: 0 }),
      adminClient.from("incidents").select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId).in("status", ["open", "investigating"]),
    ]);

    const counts = {
      activeUsers: activeUsers.count ?? 0,
      suspendedUsers: suspendedUsers.count ?? 0,
      pendingAccountRequests: pendingRequests.count ?? 0,
      activeTimers: activeTimers.count ?? 0,
      activeAttendanceSessions: activeAttendance.count ?? 0,
      activePushSubscriptions: pushSubscriptions.count ?? 0,
      failedNotificationDeliveries24h: failedDeliveries.count ?? 0,
      openIncidents: incidents.count ?? 0,
    };

    const warnings = [
      ...tableChecks.filter((item) => !item.ok).map((item) => `Table check failed: ${item.table}`),
      ...(counts.failedNotificationDeliveries24h > 0 ? ["Notification delivery failures detected in the last 24 hours."] : []),
      ...(counts.pendingAccountRequests > 0 ? ["Pending account access requests require review."] : []),
      ...(counts.suspendedUsers > 0 ? ["There are suspended users in this organization."] : []),
    ];

    return jsonResponse({
      ok: warnings.length === 0,
      checkedAt: new Date().toISOString(),
      organizationId,
      counts,
      tableChecks,
      warnings,
      environment: {
        n8nAiWorkspaceConfigured: Boolean(Deno.env.get("N8N_AI_WORKSPACE_WEBHOOK_URL")),
        n8nNotificationConfigured: Boolean(Deno.env.get("N8N_NOTIFICATION_WEBHOOK_URL")),
        n8nSystemHealthConfigured: Boolean(Deno.env.get("N8N_SYSTEM_HEALTH_WEBHOOK_URL")),
      },
    });
  } catch (error) {
    console.error("SYSTEM HEALTH ERROR:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown system health error." },
      500,
    );
  }
});

async function getOrganizationNotificationIds(
  adminClient: any,
  organizationId: string,
  since: string,
) {
  const { data, error } = await adminClient
    .from("notifications")
    .select("id")
    .eq("organization_id", organizationId)
    .gte("created_at", since)
    .limit(1000);

  if (error) throw error;
  return ((data ?? []) as Array<{ id: string }>).map((item) => item.id);
}
