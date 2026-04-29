import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type RequestBody = {
  organizationId?: string;
  userId?: string;
  reason?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Missing Supabase Edge Function environment variables.");
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user: actor },
      error: actorError,
    } = await userClient.auth.getUser();

    if (actorError || !actor) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: corsHeaders },
      );
    }

    const body = (await req.json()) as RequestBody;
    const organizationId = body.organizationId;
    const targetUserId = body.userId;

    if (!organizationId || !targetUserId) {
      return Response.json(
        { ok: false, error: "organizationId and userId are required" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (actor.id === targetUserId) {
      return Response.json(
        { ok: false, error: "Admins cannot hard-delete themselves." },
        { status: 400, headers: corsHeaders },
      );
    }

    const { data: actorProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, organization_id, primary_role, account_status")
      .eq("id", actor.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (profileError) throw profileError;

    if (
      !actorProfile ||
      actorProfile.primary_role !== "admin" ||
      actorProfile.account_status !== "active"
    ) {
      return Response.json(
        { ok: false, error: "Only active admins can hard-delete users." },
        { status: 403, headers: corsHeaders },
      );
    }

    const { data: targetProfile, error: targetError } = await adminClient
      .from("profiles")
      .select("id, primary_role")
      .eq("id", targetUserId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!targetProfile) {
      return Response.json(
        { ok: false, error: "Target user was not found." },
        { status: 404, headers: corsHeaders },
      );
    }

    if (targetProfile.primary_role === "admin") {
      const { count, error: adminCountError } = await adminClient
        .from("profiles")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId)
        .eq("primary_role", "admin")
        .eq("account_status", "active");

      if (adminCountError) throw adminCountError;
      if ((count ?? 0) <= 1) {
        return Response.json(
          { ok: false, error: "Cannot delete the last active admin." },
          { status: 400, headers: corsHeaders },
        );
      }
    }

    await adminClient.from("admin_audit_logs").insert({
      organization_id: organizationId,
      actor_user_id: actor.id,
      target_user_id: targetUserId,
      action: "user_hard_deleted",
      reason: body.reason ?? null,
      metadata: {},
    });

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(
      targetUserId,
    );

    if (deleteError) throw deleteError;

    return Response.json(
      { ok: true, userId: targetUserId },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("ADMIN DELETE USER ERROR:", error);
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders },
    );
  }
});
