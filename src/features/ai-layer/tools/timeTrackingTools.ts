import {
  getActiveTimeEntry,
  getTimeEntriesForUser,
} from "../../../lib/supabase/mutations/timeEntries";
import { getActiveAttendanceSession } from "../../attendance/services/attendanceService";
import type { AiRouterContext } from "../types/aiToolTypes";

export async function searchTimeEntriesFallback(
  context: AiRouterContext,
  daysBack = 7,
) {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - daysBack);

  const entries = await getTimeEntriesForUser({
    organizationId: context.organizationId,
    userId: context.userId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });

  return {
    entries: entries.slice(0, 25),
    count: entries.length,
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export async function getActiveTimersFallback(context: AiRouterContext) {
  const activeEntry = await getActiveTimeEntry({
    organizationId: context.organizationId,
    userId: context.userId,
  });

  return {
    activeEntry,
    count: activeEntry ? 1 : 0,
  };
}

export async function getAttendanceFallback(context: AiRouterContext) {
  const session = await getActiveAttendanceSession(
    context.userId,
    context.organizationId,
  );
  return { activeSession: session };
}
