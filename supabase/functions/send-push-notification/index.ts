import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function markDelivery(
  supabase: ReturnType<typeof createClient>,
  deliveryId: string | null,
  values: Record<string, unknown>,
) {
  if (!deliveryId) return;
  await supabase.from("notification_deliveries").update(values).eq("id", deliveryId);
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

    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@itsnomatata.com";
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      return Response.json(
        { ok: false, error: "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required" },
        { status: 500, headers: corsHeaders },
      );
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notificationId)
      .single();

    if (notificationError) throw notificationError;

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

    const payload = JSON.stringify({
      notificationId: notification.id,
      title: notification.title,
      message: notification.message ?? "",
      actionUrl: notification.action_url ?? "/notifications",
      type: notification.type,
      priority: notification.priority,
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
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await markDelivery(supabase, deliveryId, {
        status: "failed",
        error_message: error,
      });
    } catch {
      // Ignore secondary logging failures; the response still carries the error.
    }

    return Response.json(
      { ok: false, sent: 0, failed: 1, disabledSubscriptions: 0, error },
      { status: 500, headers: corsHeaders },
    );
  }
});
