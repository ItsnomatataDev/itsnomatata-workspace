import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type AttendanceSession = {
  id: string;
  organization_id: string;
  user_id: string;
  clock_in_at: string;
  notes: string | null;
};

type RunningTimeEntry = {
  id: string;
  organization_id: string;
  user_id: string;
  task_id: string | null;
  started_at: string;
  metadata: Record<string, unknown> | null;
};

type SupabaseAdminClient = any;

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
  supabase: SupabaseAdminClient,
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

async function createTimerNotification(
  supabase: SupabaseAdminClient,
  entry: RunningTimeEntry,
  stoppedAt: Date,
) {
  await supabase.from("notifications").insert({
    organization_id: entry.organization_id,
    user_id: entry.user_id,
    type: "time_tracking_timer_left_running",
    title: "Timer stopped for end of day",
    message: "Your running time tracker was automatically stopped at 6:00 PM Harare time.",
    entity_type: "time_entry",
    entity_id: entry.id,
    priority: "medium",
    metadata: {
      time_entry_id: entry.id,
      task_id: entry.task_id,
      stopped_at: stoppedAt.toISOString(),
      timezone: "Africa/Harare",
    },
    category: "time_tracking",
    dedupe_key: `time-entry-auto-stop-${entry.id}`,
  });
}

async function writeAuditLog(
  supabase: SupabaseAdminClient,
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

async function writeTimerAuditLog(
  supabase: SupabaseAdminClient,
  entry: RunningTimeEntry,
  stoppedAt: Date,
  durationSeconds: number,
) {
  await supabase.from("time_entry_audit_logs").insert({
    organization_id: entry.organization_id,
    time_entry_id: entry.id,
    task_id: entry.task_id,
    actor_user_id: null,
    target_user_id: entry.user_id,
    action: "updated",
    previous_data: null,
    new_data: {
      ended_at: stoppedAt.toISOString(),
      is_running: false,
      duration_seconds: durationSeconds,
    },
    reason: "Daily 18:00 Africa/Harare automatic timer stop",
  });
}

async function syncTaskTrackedSecondsCache(
  supabase: SupabaseAdminClient,
  organizationId: string,
  taskId: string | null,
) {
  if (!taskId) return;

  const { data: rows, error: timeError } = await supabase
    .from("time_entries")
    .select("duration_seconds")
    .eq("organization_id", organizationId)
    .eq("task_id", taskId)
    .is("deleted_at", null)
    .not("duration_seconds", "is", null);

  if (timeError) throw timeError;

  const totalSeconds = ((rows ?? []) as Array<{ duration_seconds?: number | null }>).reduce(
    (sum, row) => sum + Number(row.duration_seconds ?? 0),
    0,
  );

  const { error: taskError } = await supabase
    .from("tasks")
    .update({
      tracked_seconds_cache: totalSeconds,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("id", taskId);

  if (taskError) throw taskError;
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

    if (!hasServiceBearer || !hasInternalKey) {
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

    const { data: timeEntryData, error: timeEntryError } = await supabase
      .from("time_entries")
      .select("id, organization_id, user_id, task_id, started_at, metadata")
      .eq("is_running", true)
      .is("ended_at", null)
      .is("deleted_at", null)
      .lte("started_at", todayCutoff.toISOString())
      .order("started_at", { ascending: true });

    if (timeEntryError) throw timeEntryError;

    const timeEntries = (timeEntryData ?? []) as RunningTimeEntry[];
    const stoppedTimers: string[] = [];
    const skippedTimers: Array<{ id: string; reason: string }> = [];

    for (const entry of timeEntries) {
      const stoppedAt = harareSixPmUtcForDate(new Date(entry.started_at));
      const durationSeconds = secondsBetween(entry.started_at, stoppedAt);

      if (durationSeconds <= 0) {
        skippedTimers.push({ id: entry.id, reason: "started_at is after 18:00 local time" });
        continue;
      }

      const { error: updateError } = await supabase
        .from("time_entries")
        .update({
          ended_at: stoppedAt.toISOString(),
          is_running: false,
          duration_seconds: durationSeconds,
          metadata: {
            ...(entry.metadata ?? {}),
            auto_stopped: true,
            auto_stop_reason: "harare_6pm_end_of_day",
            auto_stopped_at: new Date().toISOString(),
            timezone: "Africa/Harare",
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", entry.id)
        .eq("is_running", true)
        .is("ended_at", null);

      if (updateError) {
        skippedTimers.push({ id: entry.id, reason: updateError.message });
        continue;
      }

      await Promise.allSettled([
        writeTimerAuditLog(supabase, entry, stoppedAt, durationSeconds),
        createTimerNotification(supabase, entry, stoppedAt),
        syncTaskTrackedSecondsCache(supabase, entry.organization_id, entry.task_id),
      ]);

      stoppedTimers.push(entry.id);
    }

    return jsonResponse({
      completed_count: completed.length,
      completed,
      skipped,
      stopped_timer_count: stoppedTimers.length,
      stopped_timers: stoppedTimers,
      skipped_timers: skippedTimers,
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
