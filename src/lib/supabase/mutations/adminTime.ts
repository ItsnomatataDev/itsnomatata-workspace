import { supabase } from "../client";
import type { TimeEntryItem } from "./timeEntries";
import { sendNotification } from "../../../features/notifications/services/notificationService";

function formatHours(seconds?: number | null) {
  const hours = Math.max(0, Number(seconds ?? 0)) / 3600;
  return `${hours.toFixed(hours >= 10 ? 1 : 2)}h`;
}

async function notifyTimeEntryDecision(
  entry: TimeEntryItem,
  status: "approved" | "rejected",
  actorUserId?: string | null,
) {
  if (!entry.organization_id || !entry.user_id) return;

  try {
    await sendNotification({
      organizationId: entry.organization_id,
      userId: entry.user_id,
      type: "approval_decision",
      title:
        status === "approved"
          ? "Time entry approved"
          : "Time entry sent back",
      message:
        status === "approved"
          ? `Your ${formatHours(entry.duration_seconds)} time entry was approved.`
          : `Your ${formatHours(entry.duration_seconds)} time entry was sent back for review.`,
      entityType: "time_entry",
      entityId: entry.id,
      actionUrl: "/time",
      priority: status === "approved" ? "medium" : "high",
      referenceId: entry.id,
      referenceType: "time_entry",
      actorUserId: actorUserId ?? null,
      category: "time_tracking",
      dedupeKey: `time-entry-${status}:${entry.id}:${entry.approved_at ?? ""}`,
      metadata: {
        approvalStatus: status,
        startedAt: entry.started_at,
        endedAt: entry.ended_at,
        durationSeconds: entry.duration_seconds,
        taskId: entry.task_id,
        projectId: entry.project_id,
      },
      channels: ["in_app", "email", "push"],
    });
  } catch (error) {
    console.error("TIME ENTRY NOTIFICATION ERROR:", error);
  }
}

export async function approveTimeEntry({
  entryId,
  approvedBy,
}: {
  entryId: string;
  approvedBy: string;
}) {
  if (!entryId) throw new Error("entryId is required");
  if (!approvedBy) throw new Error("approvedBy is required");

  const { data, error } = await supabase
    .from("time_entries")
    .update({
      approval_status: "approved",
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      locked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .select()
    .single();

  if (error) throw error;
  await notifyTimeEntryDecision(data as TimeEntryItem, "approved", approvedBy);
  return data;
}

export async function rejectTimeEntry({
  entryId,
  approvedBy,
}: {
  entryId: string;
  approvedBy?: string | null;
}) {
  if (!entryId) throw new Error("entryId is required");

  const { data, error } = await supabase
    .from("time_entries")
    .update({
      approval_status: "rejected",
      approved_by: approvedBy ?? null,
      approved_at: new Date().toISOString(),
      locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .select()
    .single();

  if (error) throw error;
  await notifyTimeEntryDecision(
    data as TimeEntryItem,
    "rejected",
    approvedBy ?? null,
  );
  return data;
}

export async function bulkApproveTimeEntries({
  entryIds,
  approvedBy,
}: {
  entryIds: string[];
  approvedBy: string;
}) {
  if (!entryIds?.length) throw new Error("entryIds are required");
  if (!approvedBy) throw new Error("approvedBy is required");

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("time_entries")
    .update({
      approval_status: "approved",
      approved_by: approvedBy,
      approved_at: now,
      locked_at: now,
      updated_at: now,
    })
    .in("id", entryIds)
    .select();

  if (error) throw error;
  await Promise.all(
    (data ?? []).map((entry) =>
      notifyTimeEntryDecision(entry as TimeEntryItem, "approved", approvedBy),
    ),
  );
  return data ?? [];
}
