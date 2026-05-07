import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type AdminUserAction =
  | "suspend"
  | "reactivate"
  | "soft_delete"
  | "hard_delete_auth_user";

type RequestBody = {
  action?: AdminUserAction;
  targetUserId?: string;
  reason?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function isPrivilegedRole(role: string | null | undefined) {
  return ["admin", "it", "superadmin", "it-superadmin"].includes(role ?? "");
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Admin function is not configured." }, 500);
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

    const body = (await req.json()) as RequestBody;
    const action = body.action;
    const targetUserId = body.targetUserId?.trim();
    const reason = body.reason?.trim() || null;

    if (!action || !["suspend", "reactivate", "soft_delete", "hard_delete_auth_user"].includes(action)) {
      return jsonResponse({ error: "Invalid action." }, 400);
    }
    if (!targetUserId) return jsonResponse({ error: "targetUserId is required." }, 400);

    const actorUserId = authData.user.id;
    if (actorUserId === targetUserId) {
      return jsonResponse({ error: "You cannot perform this action on your own account." }, 400);
    }

    const { data: actor, error: actorError } = await adminClient
      .from("profiles")
      .select("id, email, organization_id, primary_role, account_status, is_suspended")
      .eq("id", actorUserId)
      .maybeSingle();

    if (actorError) throw actorError;
    if (!actor || !isPrivilegedRole(actor.primary_role)) {
      return jsonResponse({ error: "Only admin or IT users can perform this action." }, 403);
    }
    if (actor.account_status && actor.account_status !== "active") {
      return jsonResponse({ error: "Your account is not active." }, 403);
    }
    if (actor.is_suspended) {
      return jsonResponse({ error: "Suspended users cannot perform admin actions." }, 403);
    }

    const { data: target, error: targetError } = await adminClient
      .from("profiles")
      .select("id, email, organization_id, primary_role, account_status")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!target) return jsonResponse({ error: "Target user was not found." }, 404);

    const sameOrg = actor.organization_id && actor.organization_id === target.organization_id;
    const globalSuperadmin = ["superadmin", "it-superadmin"].includes(actor.primary_role ?? "");
    if (!sameOrg && !globalSuperadmin) {
      return jsonResponse({ error: "You can only manage users in your organization." }, 403);
    }

    if (target.primary_role === "admin" && action !== "reactivate") {
      const { count, error: adminCountError } = await adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", target.organization_id)
        .eq("primary_role", "admin")
        .eq("account_status", "active")
        .eq("is_active", true);

      if (adminCountError) throw adminCountError;
      if ((count ?? 0) <= 1) {
        return jsonResponse({ error: "You cannot suspend or delete the last active admin." }, 400);
      }
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> =
      action === "reactivate"
        ? {
          account_status: "active",
          is_active: true,
          is_suspended: false,
          suspended_at: null,
          suspended_by: null,
          suspension_reason: null,
          deleted_at: null,
          deleted_by: null,
          deletion_reason: null,
          approved_at: now,
          approved_by: actorUserId,
        }
        : action === "suspend"
        ? {
          account_status: "suspended",
          is_active: false,
          is_suspended: true,
          suspended_at: now,
          suspended_by: actorUserId,
          suspension_reason: reason,
        }
        : {
          account_status: "deleted",
          is_active: false,
          is_suspended: false,
          deleted_at: now,
          deleted_by: actorUserId,
          deletion_reason: reason,
        };

    const { error: updateError } = await adminClient
      .from("profiles")
      .update(update)
      .eq("id", targetUserId);

    if (updateError) throw updateError;

    if (target.organization_id) {
      const memberStatus = action === "reactivate"
        ? "active"
        : action === "suspend"
        ? "suspended"
        : "removed";

      await adminClient
        .from("organization_members")
        .update({
          status: memberStatus,
          removed_at: memberStatus === "removed" ? now : null,
          removed_by: memberStatus === "removed" ? actorUserId : null,
        })
        .eq("organization_id", target.organization_id)
        .eq("user_id", targetUserId);
    }

    let hardDeleted = false;
    if (action === "hard_delete_auth_user") {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (deleteError) throw deleteError;
      hardDeleted = true;
    }

    await adminClient.from("admin_audit_logs").insert({
      organization_id: target.organization_id ?? actor.organization_id,
      actor_user_id: actorUserId,
      target_user_id: targetUserId,
      action: `admin_user_${action}`,
      reason,
      metadata: {
        actor_role: actor.primary_role,
        target_email: target.email,
        hard_deleted: hardDeleted,
      },
    });

    return jsonResponse({
      ok: true,
      action,
      targetUserId,
      hardDeleted,
    });
  } catch (error) {
    console.error("ADMIN USER ACTION ERROR:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown admin action error." },
      500,
    );
  }
});
