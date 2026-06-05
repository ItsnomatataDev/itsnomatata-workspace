import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import {
  getBearerToken,
  getSupabaseEnv,
  isServiceRoleRequest,
} from "../_shared/edgeAuth.ts";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function markDelivery(
  supabase: ReturnType<typeof createClient>,
  deliveryId: string | null,
  values: Record<string, unknown>,
) {
  if (!deliveryId) return;
  await supabase.from("notification_deliveries").update(values).eq("id", deliveryId);
}

async function authorizePushRequest(
  req: Request,
  notificationUserId: string,
): Promise<Response | null> {
  const { supabaseUrl, anonKey, serviceRoleKey } = getSupabaseEnv();
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return Response.json(
      { ok: false, error: "Server configuration error." },
      { status: 500, headers: corsHeaders },
    );
  }

  if (isServiceRoleRequest(req, serviceRoleKey)) {
    return null;
  }

  const token = getBearerToken(req);
  if (!token) {
    return Response.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) {
    return Response.json(
      { ok: false, error: "Invalid or expired session." },
      { status: 401, headers: corsHeaders },
    );
  }

  if (authData.user.id !== notificationUserId) {
    return Response.json(
      { ok: false, error: "Forbidden" },
      { status: 403, headers: corsHeaders },
    );
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let deliveryId: string | null = null;

  try {
    const body = await req.json();
    const notificationId = body.notificationId as string | undefined;
    deliveryId = (body.deliveryId as string | undefined) ?? null;

    if (!notificationId) {
      return Response.json(
        { ok: false, error: "notificationId is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const { serviceRoleKey } = getSupabaseEnv();
    if (!serviceRoleKey) {
      return Response.json(
        { ok: false, error: "Server configuration error." },
        { status: 500, headers: corsHeaders },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey,
    );

    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notificationId)
      .single();

    if (notificationError) throw notificationError;

    const authError = await authorizePushRequest(req, notification.user_id);
    if (authError) return authError;

    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:codex@itsnomatata.com";
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      return Response.json(
        { ok: false, error: "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required" },
        { status: 500, headers: corsHeaders },
      );
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", notification.user_id)
      .eq("is_active", true);

    if (subscriptionsError) throw subscriptionsError;

    const activeSubscriptions = (subscriptions ?? []) as PushSubscriptionRow[];

    if (activeSubscriptions.length === 0) {
      await markDelivery(supabase, deliveryId, {
        status: "skipped",
        error_message: "No active push subscriptions found.",
      });
      return Response.json(
        { ok: true, sent: 0, failed: 0, disabledSubscriptions: 0 },
        { headers: corsHeaders },
      );
    }

    const metadata =
      notification.metadata && typeof notification.metadata === "object"
        ? notification.metadata as Record<string, unknown>
        : null;

    const draftId =
      (typeof metadata?.draftId === "string" && metadata.draftId.trim()) ||
      (typeof metadata?.draft_id === "string" && metadata.draft_id.trim()) ||
      (notification.entity_type === "content_review_draft"
        ? notification.entity_id
        : null);

    const isContentReview =
      notification.category === "content_review" ||
      notification.entity_type === "content_review_draft";

    const actionUrl =
      draftId && isContentReview
        ? `/admin/content-studio/editor/${draftId}`
        : notification.action_url ?? "/notifications";

    const payload = JSON.stringify({
      notificationId: notification.id,
      title: notification.title,
      message: notification.message ?? "",
      actionUrl,
      type: notification.type,
      priority: notification.priority,
      category: notification.category,
      entityType: notification.entity_type,
      entityId: notification.entity_id,
      metadata,
    });

    let sent = 0;
    let failed = 0;
    let disabledSubscriptions = 0;
    const errors: string[] = [];

    for (const subscription of activeSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
        );
        sent += 1;
      } catch (err) {
        failed += 1;
        const statusCode = (err as { statusCode?: number }).statusCode;
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${subscription.id}: ${message}`);

        if (statusCode === 404 || statusCode === 410) {
          disabledSubscriptions += 1;
          await supabase
            .from("push_subscriptions")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("id", subscription.id);
        }
      }
    }

    await markDelivery(supabase, deliveryId, {
      status: sent > 0 ? "sent" : "failed",
      delivered_at: sent > 0 ? new Date().toISOString() : null,
      error_message: errors.length ? errors.join("\n").slice(0, 2000) : null,
    });

    return Response.json(
      {
        ok: sent > 0,
        sent,
        failed,
        disabledSubscriptions,
      },
      { headers: corsHeaders },
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    try {
      const { serviceRoleKey } = getSupabaseEnv();
      if (serviceRoleKey) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          serviceRoleKey,
        );
        await markDelivery(supabase, deliveryId, {
          status: "failed",
          error_message: error,
        });
      }
    } catch {
      // Ignore secondary logging failures.
    }

    return Response.json(
      { ok: false, sent: 0, failed: 1, disabledSubscriptions: 0, error },
      { status: 500, headers: corsHeaders },
    );
  }
});
