import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type AttendanceSession = {
  id: string;
  organization_id: string;
  user_id: string;
  clock_in_at: string;
  notes: string | null;
};

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

function getHarareDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Harare",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to resolve Africa/Harare date.");
  }

  return { year, month, day };
}

function harareSixPmUtcForDate(value: Date) {
  const { year, month, day } = getHarareDateParts(value);
  return new Date(`${year}-${month}-${day}T16:00:00.000Z`);
}

function secondsBetween(start: string, end: Date) {
  const startMs = new Date(start).getTime();
  const endMs = end.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

function appendAutoNote(notes: string | null, clockOutAt: Date) {
  const marker = `Auto clocked out by system at ${clockOutAt.toISOString()} (18:00 Africa/Harare).`;
  if (!notes || !notes.trim()) return marker;
  if (notes.includes("Auto clocked out by system")) return notes;
  return `${notes.trim()}\n${marker}`;
}

async function createNotification(
  supabase: ReturnType<typeof createClient>,
  session: AttendanceSession,
  clockOutAt: Date,
) {
  await supabase.from("notifications").insert({
    organization_id: session.organization_id,
    user_id: session.user_id,
    type: "attendance_auto_clock_out",
    title: "Automatically clocked out",
    message: "You were automatically clocked out at 6:00 PM.",
    entity_type: "attendance_session",
    entity_id: session.id,
    priority: "medium",
    metadata: {
      attendance_session_id: session.id,
      clock_out_at: clockOutAt.toISOString(),
      timezone: "Africa/Harare",
    },
    category: "attendance",
    dedupe_key: `attendance-auto-clock-out-${session.id}`,
  });
}

async function writeAuditLog(
  supabase: ReturnType<typeof createClient>,
  session: AttendanceSession,
  clockOutAt: Date,
  workSeconds: number,
) {
  await supabase.from("admin_audit_logs").insert({
    organization_id: session.organization_id,
    actor_user_id: null,
    target_user_id: session.user_id,
    action: "attendance_auto_clock_out",
    reason: "Daily 18:00 Africa/Harare automatic clock-out",
    metadata: {
      attendance_session_id: session.id,
      clock_out_at: clockOutAt.toISOString(),
      work_seconds: workSeconds,
      source: "auto-clock-out-edge-function",
    },
  });
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { error: "Missing Supabase service role configuration." },
        500,
      );
    }

    const authorization = req.headers.get("authorization") ?? "";
    const internalKey = req.headers.get("x-internal-api-key") ?? "";
    const expectedInternalKey = Deno.env.get("INTERNAL_API_KEY") ?? "";
    const hasServiceBearer = authorization === `Bearer ${serviceRoleKey}`;
    const hasInternalKey = Boolean(expectedInternalKey) &&
      internalKey === expectedInternalKey;

    if (!hasServiceBearer && !hasInternalKey) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const now = new Date();
    const todayCutoff = harareSixPmUtcForDate(now);

    const { data, error } = await supabase
      .from("attendance_sessions")
      .select("id, organization_id, user_id, clock_in_at, notes")
      .eq("status", "active")
      .is("clock_out_at", null)
      .lte("clock_in_at", todayCutoff.toISOString())
      .order("clock_in_at", { ascending: true });

    if (error) throw error;

    const sessions = (data ?? []) as AttendanceSession[];
    const completed: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];

    for (const session of sessions) {
      const clockOutAt = harareSixPmUtcForDate(new Date(session.clock_in_at));
      const workSeconds = secondsBetween(session.clock_in_at, clockOutAt);

      if (workSeconds <= 0) {
        skipped.push({ id: session.id, reason: "clock_in_at is after 18:00 local time" });
        continue;
      }

      const { error: updateError } = await supabase
        .from("attendance_sessions")
        .update({
          clock_out_at: clockOutAt.toISOString(),
          status: "completed",
          work_seconds: workSeconds,
          clock_out_method: "auto",
          notes: appendAutoNote(session.notes, clockOutAt),
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id)
        .eq("status", "active")
        .is("clock_out_at", null);

      if (updateError) {
        skipped.push({ id: session.id, reason: updateError.message });
        continue;
      }

      await Promise.allSettled([
        writeAuditLog(supabase, session, clockOutAt, workSeconds),
        createNotification(supabase, session, clockOutAt),
      ]);

      completed.push(session.id);
    }

    return jsonResponse({
      completed_count: completed.length,
      completed,
      skipped,
      cutoff: todayCutoff.toISOString(),
      timezone: "Africa/Harare",
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Auto clock-out failed." },
      500,
    );
  }
});
