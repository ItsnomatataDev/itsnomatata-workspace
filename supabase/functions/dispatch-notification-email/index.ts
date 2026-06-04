import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildN8nNotificationEmailPayload,
  postNotificationEmailToN8n,
} from "../_shared/n8nNotificationEmail.ts";

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

function hasServiceAccess(req: Request, serviceRoleKey: string) {
  const authorization = req.headers.get("authorization") ?? "";
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  const apikey = req.headers.get("apikey") ?? "";
  return bearer === serviceRoleKey || apikey === serviceRoleKey;
}

type DispatchBody = {
  notificationId?: string;
  deliveryId?: string;
  limit?: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase environment configuration" }, 500);
  }

  if (!hasServiceAccess(req, serviceRoleKey)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const body = (await req.json().catch(() => ({}))) as DispatchBody;
  const limit = Math.min(Math.max(body.limit ?? 25, 1), 50);

  let query = supabase
    .from("notification_deliveries")
    .select(
      `
      id,
      notification_id,
      status,
      notifications!inner(
        id,
        title,
        message,
        type,
        priority,
        action_url,
        metadata,
        user_id,
        profiles:user_id(full_name, email)
      )
    `,
    )
    .eq("channel", "email")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (body.deliveryId) {
    query = query.eq("id", body.deliveryId);
  }
  if (body.notificationId) {
    query = query.eq("notification_id", body.notificationId);
  }

  const { data: rows, error } = await query;

  if (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  const results: Array<{
    deliveryId: string;
    notificationId: string;
    ok: boolean;
    error?: string;
  }> = [];

  for (const row of rows ?? []) {
    const notification = Array.isArray(row.notifications)
      ? row.notifications[0]
      : row.notifications;
    const profile = Array.isArray(notification?.profiles)
      ? notification.profiles[0]
      : notification?.profiles;
    const email = typeof profile?.email === "string" ? profile.email.trim() : "";

    if (!notification || !email) {
      await supabase
        .from("notification_deliveries")
        .update({
          status: "failed",
          error_message: "Missing notification or recipient email",
          attempted_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      results.push({
        deliveryId: row.id,
        notificationId: row.notification_id,
        ok: false,
        error: "Missing notification or recipient email",
      });
      continue;
    }

    const payload = buildN8nNotificationEmailPayload({
      to: email,
      fullName: profile?.full_name,
      title: notification.title,
      message: notification.message ?? notification.title,
      type: notification.type,
      priority: notification.priority,
      actionUrl: notification.action_url,
      metadata: (notification.metadata ?? {}) as Record<string, unknown>,
      deliveryId: row.id,
      notificationId: notification.id,
    });

    const sent = await postNotificationEmailToN8n(payload);

    await supabase
      .from("notification_deliveries")
      .update({
        status: sent.ok ? "sent" : "failed",
        destination: email,
        provider: "n8n",
        error_message: sent.ok ? null : sent.error ?? "n8n dispatch failed",
        attempted_at: new Date().toISOString(),
        delivered_at: sent.ok ? new Date().toISOString() : null,
      })
      .eq("id", row.id);

    results.push({
      deliveryId: row.id,
      notificationId: row.notification_id,
      ok: sent.ok,
      error: sent.error,
    });
  }

  return jsonResponse({
    ok: true,
    processed: results.length,
    succeeded: results.filter((entry) => entry.ok).length,
    failed: results.filter((entry) => !entry.ok).length,
    results,
  });
});
