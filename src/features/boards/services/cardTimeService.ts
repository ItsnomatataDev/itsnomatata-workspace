import { supabase } from "../../../lib/supabase/client";
import {
  createManualTimeEntry,
  getTimeEntryAuditLogs,
  syncTaskTrackedSecondsCache,
  restoreTimeEntry,
  softDeleteTimeEntry,
  updateTimeEntry,
  type ManualTimeEntryInput,
  type TimeEntryAuditLogItem,
  type TimeEntryItem,
  type UpdateTimeEntryInput,
} from "../../../lib/supabase/mutations/timeEntries";

export type CardTimeSummary = {
  totalSeconds: number;
  byUser: Record<string, number>;
  bySource: Record<string, number>;
  byDay: Record<string, number>;
};

export async function getCardTimeEntries(params: {
  organizationId: string;
  cardId: string;
  includeDeleted?: boolean;
}): Promise<TimeEntryItem[]> {
  let query = supabase
    .from("time_entries")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("task_id", params.cardId)
    .order("started_at", { ascending: false });

  if (!params.includeDeleted) query = query.is("deleted_at", null);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as TimeEntryItem[];
}

export function getCardTimeSummary(entries: TimeEntryItem[]): CardTimeSummary {
  return entries
    .filter((entry) => !entry.deleted_at)
    .reduce<CardTimeSummary>(
      (summary, entry) => {
        const seconds = Number(entry.duration_seconds ?? 0);
        const userKey =
          entry.user_id ||
          entry.source_user_email ||
          entry.source_user_name ||
          "unmatched";
        const sourceKey =
          entry.source === "everhour" || entry.source === "everhour_import"
            ? "Everhour Import"
            : entry.source === "trello_import"
              ? "Trello Import"
              : entry.entry_type === "manual" || entry.source?.includes("manual")
                ? "Manual"
                : "Timer";
        const dayKey = entry.started_at.slice(0, 10);

        summary.totalSeconds += seconds;
        summary.byUser[userKey] = (summary.byUser[userKey] ?? 0) + seconds;
        summary.bySource[sourceKey] = (summary.bySource[sourceKey] ?? 0) + seconds;
        summary.byDay[dayKey] = (summary.byDay[dayKey] ?? 0) + seconds;
        return summary;
      },
      { totalSeconds: 0, byUser: {}, bySource: {}, byDay: {} },
    );
}

export async function addManualTimeEntry(
  input: ManualTimeEntryInput,
): Promise<TimeEntryItem> {
  return createManualTimeEntry(input);
}

export async function updateCardTimeEntry(params: {
  entryId: string;
  payload: UpdateTimeEntryInput;
  actorUserId?: string | null;
  reason?: string | null;
}): Promise<TimeEntryItem> {
  return updateTimeEntry(params);
}

export async function softDeleteCardTimeEntry(params: {
  entryId: string;
  actorUserId?: string | null;
  reason?: string | null;
}): Promise<void> {
  return softDeleteTimeEntry(params);
}

export async function restoreCardTimeEntry(params: {
  entryId: string;
  actorUserId?: string | null;
  reason?: string | null;
}): Promise<TimeEntryItem> {
  return restoreTimeEntry(params);
}

export async function getCardTimeAuditLogs(params: {
  organizationId: string;
  cardId: string;
  limit?: number;
}): Promise<TimeEntryAuditLogItem[]> {
  return getTimeEntryAuditLogs({
    organizationId: params.organizationId,
    taskId: params.cardId,
    limit: params.limit,
  });
}

export const recalculateCardTotalTime = syncTaskTrackedSecondsCache;
