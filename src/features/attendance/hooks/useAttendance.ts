import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase/client";
import { getRunningEntryElapsedSeconds } from "../../../lib/utils/timeMath";
import {
  clockIn,
  clockOut,
  getAttendanceErrorMessage,
  getMyAttendanceToday,
} from "../services/attendanceService";
import type { AttendanceToday } from "../types/attendance";

export function useAttendance(params: {
  organizationId?: string | null;
  userId?: string | null;
}) {
  const { organizationId, userId } = params;
  const [state, setState] = useState<AttendanceToday>({
    activeSession: null,
    activeBreak: null,
    sessions: [],
    breaks: [],
    workedSeconds: 0,
    breakSeconds: 0,
  });
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const refresh = useCallback(async () => {
    if (!organizationId || !userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setState(await getMyAttendanceToday(userId, organizationId));
    } catch (err) {
      setError(getAttendanceErrorMessage(err, "Failed to load attendance."));
    } finally {
      setLoading(false);
    }
  }, [organizationId, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!organizationId || !userId) return;

    const channel = supabase
      .channel(`attendance:${organizationId}:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_sessions",
          filter: `user_id=eq.${userId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_breaks",
          filter: `user_id=eq.${userId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId, refresh, userId]);

  const activeSessionSeconds = useMemo(() => {
    if (!state.activeSession) return 0;
    const gross = getRunningEntryElapsedSeconds(
      {
        started_at: state.activeSession.clock_in_at,
        ended_at: state.activeSession.clock_out_at,
      },
      now,
    );
    return Math.max(0, gross);
  }, [now, state.activeSession]);

  const workedTodaySeconds = useMemo(() => {
    if (!state.activeSession) return state.workedSeconds;
    return state.workedSeconds;
  }, [state.activeSession, state.workedSeconds]);

  const clockInNow = useCallback(
    async (notes?: string | null) => {
      if (!organizationId || !userId) {
        setError("Missing user or organization.");
        throw new Error("Missing user or organization.");
      }
      setMutating(true);
      setError("");
      try {
        await clockIn({
          organizationId,
          userId,
          notes,
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
          },
      });
      await refresh();
    } catch (err) {
        const message = getAttendanceErrorMessage(err, "Failed to clock in.");
        setError(message);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [organizationId, refresh, userId],
  );

  const clockOutNow = useCallback(
    async (notes?: string | null) => {
      if (!state.activeSession || !userId) return;
      setMutating(true);
      setError("");
      try {
        await clockOut({
          sessionId: state.activeSession.id,
          userId,
          notes,
      });
      await refresh();
    } catch (err) {
        const message = getAttendanceErrorMessage(err, "Failed to clock out.");
        setError(message);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [refresh, state.activeSession, userId],
  );

  return {
    ...state,
    loading,
    mutating,
    error,
    activeSessionSeconds,
    workedTodaySeconds,
    refresh,
    clockInNow,
    clockOutNow,
  };
}
