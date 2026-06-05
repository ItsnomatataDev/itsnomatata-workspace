import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildN8nNotificationEmailPayload,
  postNotificationEmailToN8n,
} from "../_shared/n8nNotificationEmail.ts";

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
  actorUserId?: string | null;
  category?: string | null;
  dedupeKey?: string | null;
  channels?: Array<"in_app" | "email" | "push">;
  sendEmail?: boolean;
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
  const secret = Deno.env.get("INTERNAL_API_KEY")?.trim();
  if (!secret) return false;

  const inbound = req.headers.get("x-internal-api-key") ??
    req.headers.get("x-notification-secret");

  return Boolean(inbound) && inbound === secret;
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

function normalizeChannels(body: CreateNotificationBody) {
  const requested = body.channels?.length
    ? body.channels
    : body.sendEmail === false
    ? ["in_app", "push"]
    : ["in_app", "email", "push"];

  return [...new Set(requested)].filter((channel) =>
    ["in_app", "email", "push"].includes(channel)
  ) as Array<"in_app" | "email" | "push">;
}

const PRIVILEGED_NOTIFICATION_ROLES = new Set([
  "admin",
  "org_admin",
  "super_admin",
  "superadmin",
  "manager",
  "hr",
  "it",
  "it-superadmin",
]);

function isPrivilegedNotificationRole(role: string | null | undefined) {
  return PRIVILEGED_NOTIFICATION_ROLES.has(String(role ?? ""));
}

async function createDelivery(
  supabase: ReturnType<typeof createClient>,
  params: {
    notificationId: string;
    channel: "email" | "push";
    status?: string;
    provider?: string | null;
    errorMessage?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("notification_deliveries")
    .insert({
      notification_id: params.notificationId,
      channel: params.channel,
      status: params.status ?? "queued",
      provider: params.provider ?? null,
      error_message: params.errorMessage ?? null,
      attempted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function sendPush(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  notificationId: string;
  deliveryId: string;
}) {
  const response = await fetch(
    `${params.supabaseUrl}/functions/v1/send-push-notification`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.serviceRoleKey}`,
        apikey: params.serviceRoleKey,
      },
      body: JSON.stringify({
        notificationId: params.notificationId,
        deliveryId: params.deliveryId,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Push function returned ${response.status}: ${text}`);
  }
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
    let authUserId: string | null = null;
    let authProfileRole: string | null = null;

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
      authUserId = authData.user.id;

      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("user_id", authData.user.id)
        .eq("status", "active")
        .maybeSingle();

      const { data: profileMembership, error: profileMembershipError } =
        await supabase
          .from("profiles")
          .select("id, primary_role, account_status, is_suspended")
          .eq("id", authData.user.id)
          .eq("organization_id", organizationId)
          .maybeSingle();

      if (
        membershipError ||
        profileMembershipError ||
        (!membership && !profileMembership)
      ) {
        return jsonResponse(
          {
            error:
              "Forbidden: user is not a member of this organization",
          },
          403,
        );
      }

      if (
        profileMembership?.account_status &&
        profileMembership.account_status !== "active"
      ) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }

      if (profileMembership?.is_suspended) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }

      authProfileRole = typeof profileMembership?.primary_role === "string"
        ? profileMembership.primary_role
        : null;
    }

    const directUserIds = normalizeIds([
      ...(body.userId ? [body.userId] : []),
      ...(body.userIds ?? []),
    ]);

    const targetRoles = normalizeIds(body.targetRoles);
    let roleUserIds: string[] = [];
    const isPrivilegedActor = hasInternalAccess ||
      isPrivilegedNotificationRole(authProfileRole);

    if (!isPrivilegedActor && targetRoles.length > 0) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

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

    if (!isPrivilegedActor && recipientIds.length > 25) {
      return jsonResponse({ error: "Too many recipients." }, 400);
    }

    const { data: validRecipients, error: recipientsError } = await supabase
      .from("profiles")
      .select("id, account_status, is_suspended")
      .eq("organization_id", organizationId)
      .in("id", recipientIds);

    if (recipientsError) {
      return jsonResponse({ error: "Failed to validate recipients." }, 400);
    }

    const validRecipientIds = new Set(
      (validRecipients ?? [])
        .filter((row: {
          id: string;
          account_status?: string | null;
          is_suspended?: boolean | null;
        }) =>
          (row.account_status ?? "active") === "active" &&
          row.is_suspended !== true
        )
        .map((row: { id: string }) => row.id),
    );

    if (recipientIds.some((id) => !validRecipientIds.has(id))) {
      return jsonResponse({ error: "One or more recipients are invalid." }, 400);
    }

    const dedupeKey = body.dedupeKey?.trim() || null;
    const channels = normalizeChannels(body);

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
      actor_user_id: hasInternalAccess
        ? (body.actorUserId?.trim() ||
          (typeof body.metadata?.senderId === "string"
            ? body.metadata.senderId
            : null))
        : authUserId,
      category:
        body.category?.trim() ||
        (typeof body.metadata?.category === "string"
          ? body.metadata.category
          : null),
      dedupe_key: dedupeKey,
      delivery_state: "delivered",
      is_read: false,
    }));

    const { data, error } = await supabase
      .from("notifications")
      .insert(payload)
      .select("id, user_id, type, title, created_at");

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    const deliveryResults: Array<{
      notificationId: string;
      channel: string;
      status: string;
      error?: string;
    }> = [];

    for (const notification of data ?? []) {
      if (channels.includes("push")) {
        try {
          const deliveryId = await createDelivery(supabase, {
            notificationId: notification.id,
            channel: "push",
            provider: "supabase-edge:web-push",
          });

          await sendPush({
            supabaseUrl,
            serviceRoleKey: supabaseServiceRoleKey,
            notificationId: notification.id,
            deliveryId,
          });

          deliveryResults.push({
            notificationId: notification.id,
            channel: "push",
            status: "queued",
          });
        } catch (pushError) {
          deliveryResults.push({
            notificationId: notification.id,
            channel: "push",
            status: "failed",
            error: pushError instanceof Error
              ? pushError.message
              : String(pushError),
          });
        }
      }

      if (channels.includes("email") && body.sendEmail !== false) {
        try {
          const deliveryId = await createDelivery(supabase, {
            notificationId: notification.id,
            channel: "email",
            status: "queued",
            provider: "n8n",
          });

          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", notification.user_id)
            .maybeSingle();

          const email = typeof profile?.email === "string"
            ? profile.email.trim()
            : "";

          if (!email) {
            await supabase
              .from("notification_deliveries")
              .update({
                status: "failed",
                error_message: "Recipient profile has no email",
                attempted_at: new Date().toISOString(),
              })
              .eq("id", deliveryId);

            deliveryResults.push({
              notificationId: notification.id,
              channel: "email",
              status: "failed",
              error: "Recipient profile has no email",
            });
            continue;
          }

          const payload = buildN8nNotificationEmailPayload({
            to: email,
            fullName: profile?.full_name,
            title,
            message: body.message?.trim() || title,
            type,
            priority,
            actionUrl: body.actionUrl?.trim() || null,
            metadata: body.metadata ?? {},
            deliveryId,
            notificationId: notification.id,
          });

          const sent = await postNotificationEmailToN8n(payload);

          await supabase
            .from("notification_deliveries")
            .update({
              status: sent.ok ? "sent" : "failed",
              destination: email,
              error_message: sent.ok ? null : sent.error ?? "n8n dispatch failed",
              attempted_at: new Date().toISOString(),
              delivered_at: sent.ok ? new Date().toISOString() : null,
            })
            .eq("id", deliveryId);

          deliveryResults.push({
            notificationId: notification.id,
            channel: "email",
            status: sent.ok ? "sent" : "failed",
            error: sent.ok ? undefined : sent.error,
          });
        } catch (emailError) {
          deliveryResults.push({
            notificationId: notification.id,
            channel: "email",
            status: "failed",
            error: emailError instanceof Error
              ? emailError.message
              : String(emailError),
          });
        }
      }
    }

    return jsonResponse({
      success: true,
      createdCount: data?.length ?? 0,
      notifications: data ?? [],
      deliveries: deliveryResults,
    });
  } catch (error) {
    console.error("CREATE NOTIFICATION ERROR", error);
    return jsonResponse(
      { error: "Notification creation failed." },
      500,
    );
  }
});
