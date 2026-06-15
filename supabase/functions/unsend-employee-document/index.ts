import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = {
  recipientId?: string;
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

function canManageDocuments(role: string | null | undefined) {
  return ["admin", "manager", "hr", "superadmin", "super_admin", "it", "it-superadmin"].includes(role ?? "");
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Unsend function is not configured." }, 500);
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
    if (!body.recipientId) return jsonResponse({ error: "recipientId is required." }, 400);

    const actorUserId = authData.user.id;
    const { data: actor, error: actorError } = await adminClient
      .from("profiles")
      .select("id, organization_id, primary_role, account_status, is_suspended")
      .eq("id", actorUserId)
      .maybeSingle();

    if (actorError) throw actorError;
    if (!actor || !canManageDocuments(actor.primary_role)) {
      return jsonResponse({ error: "Only document admins can unsend employee inbox documents." }, 403);
    }
    if ((actor.account_status && actor.account_status !== "active") || actor.is_suspended) {
      return jsonResponse({ error: "Your account is not active." }, 403);
    }

    const { data: recipient, error: recipientError } = await adminClient
      .from("employee_document_recipients")
      .select("id, organization_id, document_id, user_id, status")
      .eq("id", body.recipientId)
      .maybeSingle();

    if (recipientError) throw recipientError;
    if (!recipient) return jsonResponse({ error: "Delivery was not found." }, 404);
    if (
      recipient.organization_id !== actor.organization_id &&
      !["superadmin", "super_admin", "it-superadmin"].includes(actor.primary_role ?? "")
    ) {
      return jsonResponse({ error: "You can only unsend documents in your organization." }, 403);
    }

    const { data: notifications, error: notificationLookupError } = await adminClient
      .from("notifications")
      .select("id")
      .eq("organization_id", recipient.organization_id)
      .eq("user_id", recipient.user_id)
      .eq("entity_type", "employee_document")
      .eq("entity_id", recipient.document_id);

    if (notificationLookupError) throw notificationLookupError;
    const notificationIds = (notifications ?? []).map((notification) => notification.id);

    let cancelledEmails = 0;
    if (notificationIds.length > 0) {
      const { data: cancelled, error: emailError } = await adminClient
        .from("email_events")
        .update({ status: "cancelled", last_error: "Delivery was unsent before processing." })
        .in("notification_id", notificationIds)
        .in("status", ["pending", "processing"])
        .select("id");

      if (emailError) {
        console.warn("Failed to cancel pending employee document email events.", emailError);
      } else {
        cancelledEmails = cancelled?.length ?? 0;
      }

      const { error: deleteNotificationError } = await adminClient
        .from("notifications")
        .delete()
        .in("id", notificationIds);

      if (deleteNotificationError) throw deleteNotificationError;
    }

    const { error: auditError } = await adminClient.from("employee_document_audit_logs").insert({
      organization_id: recipient.organization_id,
      document_id: recipient.document_id,
      recipient_id: recipient.id,
      actor_user_id: actorUserId,
      action: "document_unsent",
      metadata: {
        user_id: recipient.user_id,
        previous_status: recipient.status,
        notification_ids: notificationIds,
        cancelled_email_events: cancelledEmails,
      },
    });

    if (auditError) throw auditError;

    const { error: deleteRecipientError } = await adminClient
      .from("employee_document_recipients")
      .delete()
      .eq("id", recipient.id);

    if (deleteRecipientError) throw deleteRecipientError;

    return jsonResponse({
      ok: true,
      recipientId: recipient.id,
      notificationsRemoved: notificationIds.length,
      pendingEmailsCancelled: cancelledEmails,
    });
  } catch (error) {
    console.error("UNSEND EMPLOYEE DOCUMENT ERROR:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown unsend error." },
      500,
    );
  }
});
