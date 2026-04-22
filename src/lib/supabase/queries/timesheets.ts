import { supabase } from "../client";

export type TimesheetStatus = "draft" | "submitted" | "approved" | "rejected";

export interface TimesheetSubmissionRow {
    id: string;
    organization_id: string;
    user_id: string;
    week_start: string;
    week_end: string;
    status: TimesheetStatus;
    submitted_at: string | null;
    approved_at: string | null;
    rejected_at: string | null;
    approver_id: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface TimesheetSubmissionEntryRow {
    id: string;
    organization_id: string;
    timesheet_submission_id: string;
    time_entry_id: string;
    created_at: string;
    updated_at: string;
}

export interface TimesheetWeeklySummaryRow {
    organization_id: string;
    user_id: string;
    user_name: string | null;
    week_start: string;
    week_end: string;
    entry_date: string;
    project_id: string | null;
    project_name: string | null;
    task_id: string | null;
    task_title: string | null;
    total_seconds: number;
    has_billable: boolean;
    entry_count: number;
}

export interface GetTimesheetSubmissionsParams {
    organizationId: string;
    userId?: string;
    status?: TimesheetStatus;
    limit?: number;
    offset?: number;
}

export async function getTimesheetSubmissions(
    params: GetTimesheetSubmissionsParams,
): Promise<TimesheetSubmissionRow[]> {
    const {
        organizationId,
        userId,
        status,
        limit = 50,
        offset = 0,
    } = params;

    if (!organizationId) throw new Error("organizationId is required");

    let query = supabase
        .from("timesheet_submissions")
        .select("*")
        .eq("organization_id", organizationId)
        .order("week_start", { ascending: false });

    if (userId) query = query.eq("user_id", userId);
    if (status) query = query.eq("status", status);

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as TimesheetSubmissionRow[];
}

export async function getWeeklyTimesheetSummary(
    organizationId: string,
    weekStart: string,
    weekEnd: string,
    userId?: string,
): Promise<TimesheetWeeklySummaryRow[]> {
    if (!organizationId) throw new Error("organizationId is required");
    if (!weekStart || !weekEnd) {
        throw new Error("weekStart and weekEnd are required");
    }

    let query = supabase
        .from("timesheet_weekly_summary")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("week_start", weekStart)
        .eq("week_end", weekEnd)
        .order("entry_date", { ascending: true });

    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as TimesheetWeeklySummaryRow[];
}
