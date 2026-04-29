import { supabase } from "../../../lib/supabase/client";
import type { TimesheetSubmissionRow } from "../../../lib/supabase/queries/timesheets";
import {
  sendBulkNotifications,
  sendNotification,
} from "../../notifications/services/notificationService";

export type TimesheetSubmission = TimesheetSubmissionRow;

export interface CreateTimesheetPayload {
  organizationId: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
  notes?: string | null;
}

export interface UpdateTimesheetPayload {
  timesheetId: string;
  organizationId: string;
  notes?: string | null;
}

export interface SubmitTimesheetPayload {
  timesheetId: string;
  organizationId: string;
}

export interface ApproveTimesheetPayload {
  timesheetId: string;
  organizationId: string;
  approverId: string;
}

export interface RejectTimesheetPayload {
  timesheetId: string;
  organizationId: string;
  approverId: string;
  notes?: string | null;
}

async function getTimesheetApproverIds(organizationId: string, submitterId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .in("primary_role", ["admin", "manager"])
    .neq("id", submitterId);

  if (error) throw error;
  return (data ?? []).map((row) => row.id as string).filter(Boolean);
}

async function notifyTimesheetSubmitted(timesheet: TimesheetSubmission) {
  try {
    const approverIds = await getTimesheetApproverIds(
      timesheet.organization_id,
      timesheet.user_id,
    );

    if (approverIds.length === 0) return;

    await sendBulkNotifications({
      organizationId: timesheet.organization_id,
      userIds: approverIds,
      type: "approval_needed",
      title: "Timesheet submitted",
      message: `A timesheet for ${timesheet.week_start} to ${timesheet.week_end} is ready for review.`,
      entityType: "timesheet_submission",
      entityId: timesheet.id,
      actionUrl: "/timesheets/team",
      priority: "medium",
      referenceId: timesheet.id,
      referenceType: "timesheet_submission",
      actorUserId: timesheet.user_id,
      category: "time_tracking",
      dedupeKey: `timesheet-submitted:${timesheet.id}`,
      metadata: {
        weekStart: timesheet.week_start,
        weekEnd: timesheet.week_end,
        submitterUserId: timesheet.user_id,
      },
      channels: ["in_app", "email", "push"],
    });
  } catch (error) {
    console.error("TIMESHEET SUBMITTED NOTIFICATION ERROR:", error);
  }
}

async function notifyTimesheetDecision(
  timesheet: TimesheetSubmission,
  decision: "approved" | "rejected",
  approverId: string,
) {
  try {
    await sendNotification({
      organizationId: timesheet.organization_id,
      userId: timesheet.user_id,
      type: "approval_decision",
      title:
        decision === "approved" ? "Timesheet approved" : "Timesheet rejected",
      message:
        decision === "approved"
          ? `Your timesheet for ${timesheet.week_start} to ${timesheet.week_end} was approved.`
          : `Your timesheet for ${timesheet.week_start} to ${timesheet.week_end} was rejected.${timesheet.notes ? ` ${timesheet.notes}` : ""}`,
      entityType: "timesheet_submission",
      entityId: timesheet.id,
      actionUrl: "/timesheets",
      priority: decision === "approved" ? "medium" : "high",
      referenceId: timesheet.id,
      referenceType: "timesheet_submission",
      actorUserId: approverId,
      category: "time_tracking",
      dedupeKey: `timesheet-${decision}:${timesheet.id}:${timesheet.updated_at}`,
      metadata: {
        decision,
        weekStart: timesheet.week_start,
        weekEnd: timesheet.week_end,
      },
      channels: ["in_app", "email", "push"],
    });
  } catch (error) {
    console.error("TIMESHEET DECISION NOTIFICATION ERROR:", error);
  }
}

export async function createTimesheet(
  payload: CreateTimesheetPayload,
): Promise<TimesheetSubmission> {
  const { organizationId, userId, weekStart, weekEnd, notes = null } = payload;

  if (!organizationId) throw new Error("organizationId is required");
  if (!userId) throw new Error("userId is required");
  if (!weekStart || !weekEnd) {
    throw new Error("weekStart and weekEnd are required");
  }

  const { data, error } = await supabase
    .from("timesheet_submissions")
    .insert({
      organization_id: organizationId,
      user_id: userId,
      week_start: weekStart,
      week_end: weekEnd,
      status: "draft",
      notes,
    })
    .select("*")
    .single();

  if (error) throw error;
  const timesheet = data as TimesheetSubmission;
  await notifyTimesheetSubmitted(timesheet);
  return timesheet;
}

export async function updateTimesheet(
  payload: UpdateTimesheetPayload,
): Promise<TimesheetSubmission> {
  const { timesheetId, organizationId, notes } = payload;

  if (!timesheetId) throw new Error("timesheetId is required");
  if (!organizationId) throw new Error("organizationId is required");

  const { data, error } = await supabase
    .from("timesheet_submissions")
    .update({
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", timesheetId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw error;
  return data as TimesheetSubmission;
}

export async function submitTimesheet(
  payload: SubmitTimesheetPayload,
): Promise<TimesheetSubmission> {
  const { timesheetId, organizationId } = payload;

  if (!timesheetId) throw new Error("timesheetId is required");
  if (!organizationId) throw new Error("organizationId is required");

  const { data, error } = await supabase
    .from("timesheet_submissions")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", timesheetId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw error;
  const timesheet = data as TimesheetSubmission;
  await notifyTimesheetSubmitted(timesheet);
  return timesheet;
}

export async function approveTimesheet(
  payload: ApproveTimesheetPayload,
): Promise<TimesheetSubmission> {
  const { timesheetId, organizationId, approverId } = payload;

  if (!timesheetId) throw new Error("timesheetId is required");
  if (!organizationId) throw new Error("organizationId is required");
  if (!approverId) throw new Error("approverId is required");

  const { data, error } = await supabase
    .from("timesheet_submissions")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approver_id: approverId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", timesheetId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw error;
  const timesheet = data as TimesheetSubmission;
  await notifyTimesheetDecision(timesheet, "approved", approverId);
  return timesheet;
}

export async function rejectTimesheet(
  payload: RejectTimesheetPayload,
): Promise<TimesheetSubmission> {
  const { timesheetId, organizationId, approverId, notes = null } = payload;

  if (!timesheetId) throw new Error("timesheetId is required");
  if (!organizationId) throw new Error("organizationId is required");
  if (!approverId) throw new Error("approverId is required");

  const { data, error } = await supabase
    .from("timesheet_submissions")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
      approver_id: approverId,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", timesheetId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw error;
  const timesheet = data as TimesheetSubmission;
  await notifyTimesheetDecision(timesheet, "rejected", approverId);
  return timesheet;
}

export async function getTimesheetsForUser(
  organizationId: string,
  userId: string,
): Promise<TimesheetSubmission[]> {
  if (!organizationId) throw new Error("organizationId is required");
  if (!userId) throw new Error("userId is required");

  const { data, error } = await supabase
    .from("timesheet_submissions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("week_start", { ascending: false });

  if (error) throw error;
  return (data ?? []) as TimesheetSubmission[];
}

export async function getTimesheetsForApproval(
  organizationId: string,
): Promise<TimesheetSubmission[]> {
  if (!organizationId) throw new Error("organizationId is required");

  const { data, error } = await supabase
    .from("timesheet_submissions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "submitted")
    .order("week_start", { ascending: false });

  if (error) throw error;
  return (data ?? []) as TimesheetSubmission[];
}

export async function getTimesheetById(
  organizationId: string,
  timesheetId: string,
): Promise<TimesheetSubmission> {
  if (!organizationId) throw new Error("organizationId is required");
  if (!timesheetId) throw new Error("timesheetId is required");

  const { data, error } = await supabase
    .from("timesheet_submissions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", timesheetId)
    .single();

  if (error) throw error;
  return data as TimesheetSubmission;
}
