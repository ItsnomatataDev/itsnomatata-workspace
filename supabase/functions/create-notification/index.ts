import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CreateNotificationBody = {
  organizationId?: string;
  userId?: string;
  userIds?: string[];
  targetRoles?: string[];
  type?: string;
  title?: string;
  message?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  priority?: "low" | "medium" | "high" | "urgent";
  metadata?: Record<string, unknown>;
  referenceId?: string | null;
  referenceType?: string | null;
  dedupeKey?: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-api-key, x-notification-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function hasValidInternalSecret(req: Request): boolean {
  const secret = Deno.env.get("INTERNAL_API_KEY") ??
    Deno.env.get("VITE_N8N_NOTIFICATION_WEBHOOK_SECRET");

  const inbound = req.headers.get("x-internal-api-key") ??
    req.headers.get("x-notification-secret") ??
    req.headers.get("apikey");

  return Boolean(secret) && inbound === secret;
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token || null;
}

function normalizeIds(values: string[] | undefined) {
  return [
    ...new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
  ];
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse(
        { error: "Missing Supabase environment configuration" },
        500,
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const body = (await req.json().catch(() => ({}))) as CreateNotificationBody;

    const hasInternalAccess = hasValidInternalSecret(req);
    const bearerToken = getBearerToken(req);

    if (!hasInternalAccess && !bearerToken) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const organizationId = body.organizationId?.trim();
    const title = body.title?.trim();
    const type = (body.type?.trim() || "general") as string;
    const priority = body.priority || "medium";

    if (!organizationId || !title) {
      return jsonResponse(
        { error: "organizationId and title are required" },
        400,
      );
    }

    if (!hasInternalAccess && bearerToken) {
      const { data: authData, error: authError } = await supabase.auth.getUser(
        bearerToken,
      );

      if (authError || !authData.user) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("user_id", authData.user.id)
        .eq("status", "active")
        .maybeSingle();

      if (membershipError || !membership) {
        return jsonResponse(
          {
            error:
              "Forbidden: user is not an active member of this organization",
          },
          403,
        );
      }
    }

    const directUserIds = normalizeIds([
      ...(body.userId ? [body.userId] : []),
      ...(body.userIds ?? []),
    ]);

    const targetRoles = normalizeIds(body.targetRoles);
    let roleUserIds: string[] = [];

    if (targetRoles.length > 0) {
      const { data: roleUsers, error: roleUsersError } = await supabase
        .from("profiles")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .in("primary_role", targetRoles);

      if (roleUsersError) {
        return jsonResponse({ error: roleUsersError.message }, 400);
      }

      roleUserIds = (roleUsers ?? []).map((row: { id: string }) => row.id);
    }

    const recipientIds = normalizeIds([...directUserIds, ...roleUserIds]);

    if (recipientIds.length === 0) {
      return jsonResponse(
        {
          error:
            "No recipients found. Provide userId/userIds or targetRoles with matching active users.",
        },
        400,
      );
    }

    const dedupeKey = body.dedupeKey?.trim() || null;

    // If a dedupeKey is provided, skip users who already have a notification
    // with the same dedupe_key to prevent duplicates on retry.
    let filteredRecipientIds = recipientIds;
    if (dedupeKey) {
      const { data: existing } = await supabase
        .from("notifications")
        .select("user_id")
        .eq("dedupe_key", dedupeKey)
        .in("user_id", recipientIds);

      const alreadyNotified = new Set(
        (existing ?? []).map((row: { user_id: string }) => row.user_id),
      );
      filteredRecipientIds = recipientIds.filter(
        (id) => !alreadyNotified.has(id),
      );

      if (filteredRecipientIds.length === 0) {
        return jsonResponse({
          success: true,
          createdCount: 0,
          notifications: [],
          message: "All recipients already notified (dedupe_key match).",
        });
      }
    }

    const payload = filteredRecipientIds.map((userId) => ({
      organization_id: organizationId,
      user_id: userId,
      type,
      title,
      message: body.message?.trim() || null,
      entity_type: body.entityType?.trim() || null,
      entity_id: body.entityId?.trim() || null,
      action_url: body.actionUrl?.trim() || null,
      priority,
      metadata: {
        ...(body.metadata ?? {}),
        sender: "n8n_or_internal",
        target_roles: targetRoles,
      },
      reference_id: body.referenceId?.trim() || null,
      reference_type: body.referenceType?.trim() || null,
      dedupe_key: dedupeKey,
      is_read: false,
    }));

    const { data, error } = await supabase
      .from("notifications")
      .insert(payload)
      .select("id, user_id, type, title, created_at");

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({
      success: true,
      createdCount: data?.length ?? 0,
      notifications: data ?? [],
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error
          ? error.message
          : "Unexpected function error",
      },
      500,
    );
  }
});
