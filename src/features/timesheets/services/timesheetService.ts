import { supabase } from "../../../lib/supabase/client";

export interface TimesheetSubmission {
  id: string;
  organization_id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  approver_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

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
  return data as TimesheetSubmission;
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
  return data as TimesheetSubmission;
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
  return data as TimesheetSubmission;
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
  return data as TimesheetSubmission;
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