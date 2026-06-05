import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isPrivilegedServiceRequest } from "../_shared/edgeAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-api-key, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ error: "Import function is not configured." }, 500);
  }

  if (!isPrivilegedServiceRequest(req, supabaseServiceKey)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const today = new Date().toISOString().slice(0, 10);

    const { data: timeEntries, error: timeError } = await supabase
      .from("time_entries")
      .select("user_id, duration_seconds, started_at")
      .gte("started_at", `${today}T00:00:00.000Z`)
      .lte("started_at", `${today}T23:59:59.999Z`);

    if (timeError) throw timeError;

    const userHours = new Map<string, number>();

    for (const entry of timeEntries || []) {
      const userId = entry.user_id;
      const hours = (entry.duration_seconds || 0) / 3600;
      userHours.set(userId, (userHours.get(userId) || 0) + hours);
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email, organization_id")
      .eq("account_status", "active")
      .eq("is_suspended", false);

    if (profilesError) throw profilesError;

    const DAILY_TARGET_HOURS = 8;
    const notifications = [];

    for (const profile of profiles || []) {
      const hours = userHours.get(profile.id) || 0;

      if (hours > 0 && hours < DAILY_TARGET_HOURS) {
        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            organization_id: profile.organization_id,
            user_id: profile.id,
            type: "time_tracking",
            title: "Time Tracking Below Target",
            message: `You've tracked ${hours.toFixed(1)}h today. The daily target is ${DAILY_TARGET_HOURS}h. Please log more time to meet your target.`,
            priority: "medium",
            metadata: {
              hours_tracked: hours,
              target_hours: DAILY_TARGET_HOURS,
              date: today,
            },
          });

        if (!notifError) {
          notifications.push({
            userId: profile.id,
            email: profile.email,
            hours: hours.toFixed(1),
          });
        }
      }
    }

    return jsonResponse({
      success: true,
      message: `Checked ${profiles?.length || 0} users, sent ${notifications.length} notifications`,
      notifications,
    });
  } catch (error) {
    console.error("TIME TRACKING CHECK ERROR:", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});
