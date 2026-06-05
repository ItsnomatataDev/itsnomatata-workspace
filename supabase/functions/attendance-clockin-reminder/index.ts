import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TIME_ZONE = "Africa/Harare";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function harareDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function harareIso(dateKey: string, time: string) {
  return new Date(`${dateKey}T${time}+02:00`).toISOString();
}

function isWeekday(dateKey: string) {
  const day = new Date(`${dateKey}T12:00:00+02:00`).getUTCDay();
  return day >= 1 && day <= 5;
}

async function createNotification(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  organizationId: string;
  userId: string;
  dateKey: string;
}) {
  await fetch(`${params.supabaseUrl}/functions/v1/create-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.serviceRoleKey}`,
      apikey: params.serviceRoleKey,
      ...(Deno.env.get("INTERNAL_API_KEY")
        ? { "x-internal-api-key": Deno.env.get("INTERNAL_API_KEY")! }
        : {}),
    },
    body: JSON.stringify({
      organizationId: params.organizationId,
      userIds: [params.userId],
      type: "time_tracking_not_started",
      title: "Start your workday",
      message: "It is 8:00 AM in Harare. Please clock in and start tracking your time.",
      actionUrl: "/time-tracking",
      priority: "medium",
      category: "time_tracking",
      channels: ["in_app", "push"],
      sendEmail: false,
      dedupeKey: `workday-start-reminder:${params.userId}:${params.dateKey}`,
      metadata: {
        attendance_date: params.dateKey,
        reminder_time: "08:00",
        timezone: TIME_ZONE,
        source: "attendance-clockin-reminder",
      },
    }),
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Supabase service role configuration." }, 500);
    }

    const authorization = req.headers.get("authorization") ?? "";
    const internalKey = req.headers.get("x-internal-api-key") ?? "";
    const expectedInternalKey = Deno.env.get("INTERNAL_API_KEY") ?? "";
    if (
      authorization !== `Bearer ${serviceRoleKey}` ||
      !(expectedInternalKey && internalKey === expectedInternalKey)
    ) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({})) as { date?: string; includeWeekends?: boolean };
    const dateKey = body.date ?? harareDateKey();
    if (!body.includeWeekends && !isWeekday(dateKey)) {
      return jsonResponse({ date: dateKey, skipped: true, reason: "weekend" });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const dayStart = harareIso(dateKey, "00:00:00");
    const dayEnd = harareIso(dateKey, "23:59:59");

    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, organization_id, office_id, email")
      .eq("is_active", true)
      .eq("account_status", "active")
      .neq("account_status", "deleted")
      .neq("account_status", "suspended");
    if (usersError) throw usersError;

    const userIds = (users ?? []).map((user) => user.id);
    if (userIds.length === 0) return jsonResponse({ date: dateKey, notified: 0 });

    const [
      { data: sessions, error: sessionsError },
      { data: timeEntries, error: timeEntriesError },
      { data: leaves, error: leavesError },
    ] =
      await Promise.all([
        supabase
          .from("attendance_sessions")
          .select("user_id")
          .in("user_id", userIds)
          .gte("clock_in_at", dayStart)
          .lte("clock_in_at", dayEnd),
        supabase
          .from("time_entries")
          .select("user_id")
          .in("user_id", userIds)
          .is("deleted_at", null)
          .gte("started_at", dayStart)
          .lte("started_at", dayEnd),
        supabase
          .from("leave_requests")
          .select("user_id")
          .eq("status", "approved")
          .lte("start_date", dateKey)
          .gte("end_date", dateKey),
      ]);
    if (sessionsError) throw sessionsError;
    if (timeEntriesError) throw timeEntriesError;
    if (leavesError) throw leavesError;

    const clockedIn = new Set((sessions ?? []).map((row) => row.user_id));
    const startedTracking = new Set((timeEntries ?? []).map((row) => row.user_id));
    const onLeave = new Set((leaves ?? []).map((row) => row.user_id));
    const recipients = (users ?? []).filter((user) =>
      (!clockedIn.has(user.id) || !startedTracking.has(user.id)) &&
      !onLeave.has(user.id)
    );

    await Promise.allSettled(
      recipients.map((user) =>
        createNotification({
          supabaseUrl,
          serviceRoleKey,
          organizationId: user.organization_id,
          userId: user.id,
          dateKey,
        })
      ),
    );

    await supabase.from("admin_audit_logs").insert({
      organization_id: recipients[0]?.organization_id ?? (users ?? [])[0]?.organization_id,
      action: "attendance_clockin_reminder_run",
      metadata: {
        attendance_date: dateKey,
        notified_count: recipients.length,
        excluded_clocked_in: clockedIn.size,
        excluded_started_tracking: startedTracking.size,
        excluded_on_leave: onLeave.size,
        timezone: TIME_ZONE,
      },
    });

    return jsonResponse({
      date: dateKey,
      timezone: TIME_ZONE,
      notified: recipients.length,
      excluded_clocked_in: clockedIn.size,
      excluded_started_tracking: startedTracking.size,
      excluded_on_leave: onLeave.size,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Clock-in reminder failed." }, 500);
  }
});
