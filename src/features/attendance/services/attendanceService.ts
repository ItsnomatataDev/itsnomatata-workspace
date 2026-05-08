import { supabase } from "../../../lib/supabase/client";
import {
  getEntryDurationSeconds,
  getRunningEntryElapsedSeconds,
  getZimbabweTodayRangeIso,
} from "../../../lib/utils/timeMath";
import { getZimbabweDateKey, makeZimbabweLocalIso } from "../../../lib/utils/zimbabweCalendar";
import type {
  AttendanceBreak,
  AttendanceProfile,
  AttendanceReportRow,
  AttendanceSession,
  AttendanceSettings,
  AttendanceToday,
  BreakEndInput,
  BreakStartInput,
  ClockInInput,
  ClockOutInput,
} from "../types/attendance";

const SESSION_SELECT = "*";
const BREAK_SELECT = "*";

export function getAttendanceErrorMessage(
  error: unknown,
  fallback = "Attendance action failed.",
) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === "object") {
    const value = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const parts = [value.message, value.details, value.hint]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0);
    if (parts.length > 0) {
      const code = typeof value.code === "string" ? ` (${value.code})` : "";
      return `${parts.join(" ")}${code}`;
    }
  }
  return fallback;
}

function secondsBetween(start: string, end: string) {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

function completedBreakSeconds(breaks: AttendanceBreak[]) {
  return breaks.reduce((sum, item) => {
    if (item.ended_at) return sum + Math.max(0, Number(item.duration_seconds ?? 0));
    return sum;
  }, 0);
}

export function getAttendanceSessionElapsedSeconds(
  session?: AttendanceSession | null,
) {
  if (!session) return 0;
  if (session.clock_out_at) return Math.max(0, Number(session.work_seconds ?? 0));
  return getRunningEntryElapsedSeconds({
    started_at: session.clock_in_at,
    ended_at: session.clock_out_at,
  });
}

export async function getActiveAttendanceSession(
  userId: string,
  organizationId: string,
): Promise<AttendanceSession | null> {
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select(SESSION_SELECT)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .is("clock_out_at", null)
    .order("clock_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as AttendanceSession | null) ?? null;
}

export async function getActiveBreak(
  userId: string,
  organizationId: string,
): Promise<AttendanceBreak | null> {
  const { data, error } = await supabase
    .from("attendance_breaks")
    .select(BREAK_SELECT)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as AttendanceBreak | null) ?? null;
}

export async function clockIn(input: ClockInInput): Promise<AttendanceSession> {
  try {
    const existing = await getActiveAttendanceSession(
      input.userId,
      input.organizationId,
    );
    if (existing) {
      throw new Error("You are already clocked in. Clock out before starting a new attendance session.");
    }

    const { data, error } = await supabase
      .from("attendance_sessions")
      .insert({
        organization_id: input.organizationId,
        user_id: input.userId,
        clock_in_at: new Date().toISOString(),
        status: "active",
        clock_in_method: input.method ?? "web",
        notes: input.notes ?? null,
        ip_address: input.ipAddress ?? null,
        device_info: input.deviceInfo ?? {},
        location: input.location ?? {},
      })
      .select(SESSION_SELECT)
      .single();

    if (error) throw error;
    return data as AttendanceSession;
  } catch (error) {
    throw new Error(getAttendanceErrorMessage(error, "Failed to clock in."));
  }
}

export async function startBreak(input: BreakStartInput): Promise<AttendanceBreak> {
  // Deprecated: attendance no longer creates new break records from the UI.
  const activeBreak = await getActiveBreak(input.userId, input.organizationId);
  if (activeBreak) {
    throw new Error("You already have an active break. End it before starting another one.");
  }

  const { data, error } = await supabase
    .from("attendance_breaks")
    .insert({
      organization_id: input.organizationId,
      attendance_session_id: input.sessionId,
      user_id: input.userId,
      break_type: input.breakType ?? "break",
      notes: input.notes ?? null,
    })
    .select(BREAK_SELECT)
    .single();

  if (error) throw error;
  return data as AttendanceBreak;
}

export async function endBreak(input: BreakEndInput): Promise<AttendanceBreak> {
  // Deprecated: retained for historical compatibility with older callers.
  const { data: existing, error: existingError } = await supabase
    .from("attendance_breaks")
    .select(BREAK_SELECT)
    .eq("id", input.breakId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing) throw new Error("Active break not found.");

  const endedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("attendance_breaks")
    .update({
      ended_at: endedAt,
      duration_seconds: secondsBetween(existing.started_at, endedAt),
    })
    .eq("id", input.breakId)
    .eq("user_id", input.userId)
    .select(BREAK_SELECT)
    .single();

  if (error) throw error;
  return data as AttendanceBreak;
}

export async function clockOut(input: ClockOutInput): Promise<AttendanceSession> {
  const { data: session, error: sessionError } = await supabase
    .from("attendance_sessions")
    .select(SESSION_SELECT)
    .eq("id", input.sessionId)
    .eq("user_id", input.userId)
    .eq("status", "active")
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!session) throw new Error("Active attendance session not found.");

  const clockOutAt = new Date().toISOString();
  const workSeconds = secondsBetween(session.clock_in_at, clockOutAt);

  const { data, error } = await supabase
    .from("attendance_sessions")
    .update({
      clock_out_at: clockOutAt,
      clock_out_method: input.method ?? "web",
      status: "completed",
      work_seconds: workSeconds,
      notes: input.notes ?? session.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.sessionId)
    .eq("user_id", input.userId)
    .select(SESSION_SELECT)
    .single();

  if (error) throw error;
  return data as AttendanceSession;
}

export async function getMyAttendanceToday(
  userId: string,
  organizationId: string,
): Promise<AttendanceToday> {
  const today = getZimbabweTodayRangeIso();
  const [sessionsResult, activeSession] =
    await Promise.all([
      supabase
        .from("attendance_sessions")
        .select(SESSION_SELECT)
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .gte("clock_in_at", today.start)
        .lt("clock_in_at", today.end)
        .order("clock_in_at", { ascending: false }),
      getActiveAttendanceSession(userId, organizationId),
    ]);

  if (sessionsResult.error) throw sessionsResult.error;

  const sessions = (sessionsResult.data ?? []) as AttendanceSession[];
  const workedSeconds = sessions.reduce(
    (sum, session) => sum + getAttendanceSessionElapsedSeconds(session),
    0,
  );

  return {
    activeSession,
    activeBreak: null,
    sessions,
    breaks: [],
    workedSeconds,
    breakSeconds: 0,
  };
}

async function getAttendanceSettings(
  organizationId: string,
): Promise<AttendanceSettings | null> {
  const { data, error } = await supabase
    .from("attendance_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw error;
  return (data as AttendanceSettings | null) ?? null;
}

async function getApprovedLeavesForRange(organizationId: string, from: string, to: string) {
  const { data, error } = await supabase
    .from("leave_requests")
    .select("id, user_id, start_date, end_date, status, leave_type_id")
    .eq("organization_id", organizationId)
    .eq("status", "approved")
    .lte("start_date", to)
    .gte("end_date", from);

  if (error) throw error;
  return data ?? [];
}

async function getTaskTrackedSecondsByUser(params: {
  organizationId: string;
  from: string;
  to: string;
}) {
  const { data, error } = await supabase
    .from("time_entries")
    .select("user_id, started_at, ended_at, duration_seconds")
    .eq("organization_id", params.organizationId)
    .is("deleted_at", null)
    .gte("started_at", params.from)
    .lt("started_at", params.to);

  if (error) throw error;

  const map = new Map<string, number>();
  for (const entry of data ?? []) {
    if (!entry.user_id) continue;
    const seconds = getEntryDurationSeconds({
      started_at: entry.started_at,
      ended_at: entry.ended_at,
      duration_seconds: entry.duration_seconds,
    });
    map.set(entry.user_id, (map.get(entry.user_id) ?? 0) + seconds);
  }
  return map;
}

function isLate(session: AttendanceSession | null, settings: AttendanceSettings | null) {
  if (!session || !settings?.workday_start) return false;
  const dateKey = getZimbabweDateKey(session.clock_in_at);
  const threshold = new Date(
    makeZimbabweLocalIso(dateKey, String(settings.workday_start)),
  );
  threshold.setMinutes(threshold.getMinutes() + settings.late_after_minutes);
  return new Date(session.clock_in_at).getTime() > threshold.getTime();
}

export async function getAttendanceReport(params: {
  organizationId: string;
  from: string;
  to: string;
  userId?: string;
}): Promise<AttendanceReportRow[]> {
  let profilesQuery = supabase
    .from("profiles")
    .select("id, full_name, email, primary_role, is_active")
    .eq("organization_id", params.organizationId);

  if (params.userId) profilesQuery = profilesQuery.eq("id", params.userId);

  let sessionsQuery = supabase
    .from("attendance_sessions")
    .select(SESSION_SELECT)
    .eq("organization_id", params.organizationId)
    .gte("clock_in_at", params.from)
    .lt("clock_in_at", params.to);

  if (params.userId) sessionsQuery = sessionsQuery.eq("user_id", params.userId);

  const [profilesResult, sessionsResult, taskTrackedMap, settings, leaves] =
    await Promise.all([
      profilesQuery,
      sessionsQuery.order("clock_in_at", { ascending: true }),
      getTaskTrackedSecondsByUser({
        organizationId: params.organizationId,
        from: params.from,
        to: params.to,
      }),
      getAttendanceSettings(params.organizationId),
      getApprovedLeavesForRange(params.organizationId, params.from, params.to),
    ]);

  if (profilesResult.error) throw profilesResult.error;
  if (sessionsResult.error) throw sessionsResult.error;

  const sessions = (sessionsResult.data ?? []) as AttendanceSession[];
  const sessionsByUser = new Map<string, AttendanceSession[]>();
  for (const session of sessions) {
    const list = sessionsByUser.get(session.user_id) ?? [];
    list.push(session);
    sessionsByUser.set(session.user_id, list);
  }

  const todayKey = getZimbabweDateKey(params.from);
  const leaveUserIds = new Set(
    leaves
      .filter((leave) => leave.start_date <= todayKey && leave.end_date >= todayKey)
      .map((leave) => leave.user_id as string),
  );

  return ((profilesResult.data ?? []) as AttendanceProfile[]).map((profile) => {
    const userSessions = sessionsByUser.get(profile.id) ?? [];
    const firstSession = userSessions[0] ?? null;
    const lastSession = userSessions[userSessions.length - 1] ?? null;
    const workSeconds = userSessions.reduce(
      (sum, session) => sum + getAttendanceSessionElapsedSeconds(session),
      0,
    );
    const taskTrackedSeconds = taskTrackedMap.get(profile.id) ?? 0;
    const onLeave = leaveUserIds.has(profile.id);
    const active = userSessions.some(
      (session) => session.status === "active" && !session.clock_out_at,
    );
    const missed = userSessions.some((session) => session.status === "missed_clock_out");
    const hasAutoClockOut = userSessions.some(
      (session) => session.clock_out_method === "auto",
    );

    return {
      user_id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      clock_in_at: firstSession?.clock_in_at ?? null,
      clock_out_at: lastSession?.clock_out_at ?? null,
      work_seconds: workSeconds,
      break_seconds: 0,
      task_tracked_seconds: taskTrackedSeconds,
      untracked_seconds: Math.max(0, workSeconds - taskTrackedSeconds),
      status: onLeave
        ? "on_leave"
        : active
          ? "active"
          : lastSession?.status ?? "offline",
      is_late: !onLeave && isLate(firstSession, settings),
      missed_clock_out: missed,
      clock_out_method: hasAutoClockOut ? "auto" : lastSession?.clock_out_method ?? null,
    };
  });
}

export async function getTeamAttendanceToday(organizationId: string) {
  const today = getZimbabweTodayRangeIso();
  return getAttendanceReport({
    organizationId,
    from: today.start,
    to: today.end,
  });
}
