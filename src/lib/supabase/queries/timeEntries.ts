import { supabase } from "../client";

export interface TimeEntryRow {
    id: string;
    organization_id: string;
    user_id: string;
    project_id: string | null;
    client_id: string | null;
    campaign_id: string | null;
    task_id: string | null;
    description: string | null;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    source: string | null;
    entry_type: "timer" | "manual";
    is_billable: boolean;
    hourly_rate_id: string | null;
    cost_amount: number | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}

export interface GetTimeEntriesParams {
    organizationId: string;
    userId?: string;
    projectId?: string;
    clientId?: string;
    campaignId?: string;
    taskId?: string;
    isBillable?: boolean;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
}

export async function getTimeEntries(
    params: GetTimeEntriesParams,
): Promise<TimeEntryRow[]> {
    const {
        organizationId,
        userId,
        projectId,
        clientId,
        campaignId,
        taskId,
        isBillable,
        fromDate,
        toDate,
        limit = 50,
        offset = 0,
    } = params;

    if (!organizationId) throw new Error("organizationId is required");

    let query = supabase
        .from("time_entries")
        .select("*")
        .eq("organization_id", organizationId);

    if (userId) query = query.eq("user_id", userId);
    if (projectId) query = query.eq("project_id", projectId);
    if (clientId) query = query.eq("client_id", clientId);
    if (campaignId) query = query.eq("campaign_id", campaignId);
    if (taskId) query = query.eq("task_id", taskId);
    if (typeof isBillable === "boolean") {
        query = query.eq("is_billable", isBillable);
    }
    if (fromDate) query = query.gte("started_at", fromDate);
    if (toDate) query = query.lte("started_at", toDate);

    query = query.order("started_at", { ascending: false }).range(
        offset,
        offset + limit - 1,
    );

    const { data, error } = await query;

    if (error) throw error;
    return (data ?? []) as TimeEntryRow[];
}

export async function getTimeEntryById(
    organizationId: string,
    timeEntryId: string,
): Promise<TimeEntryRow | null> {
    if (!organizationId) throw new Error("organizationId is required");
    if (!timeEntryId) throw new Error("timeEntryId is required");

    const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("id", timeEntryId)
        .single();

    if (error && error.code !== "PGRST116") throw error;
    return data as TimeEntryRow | null;
}

// Summaries

export interface TimeSummaryByDay {
    date: string;
    total_seconds: number;
    billable_seconds: number;
    non_billable_seconds: number;
}

export async function getTimeSummaryByDay(
    organizationId: string,
    userId: string,
    fromDate: string,
    toDate: string,
): Promise<TimeSummaryByDay[]> {
    if (!organizationId) throw new Error("organizationId is required");
    if (!userId) throw new Error("userId is required");

    const { data, error } = await supabase.rpc("time_summary_by_day", {
        org_id: organizationId,
        user_id: userId,
        from_date: fromDate,
        to_date: toDate,
    });

    if (error) throw error;
    return data as TimeSummaryByDay[];
}

export interface TimeSummaryByProject {
    project_id: string;
    total_seconds: number;
    billable_seconds: number;
    non_billable_seconds: number;
}

export async function getTimeSummaryByProject(
    organizationId: string,
    fromDate: string,
    toDate: string,
): Promise<TimeSummaryByProject[]> {
    if (!organizationId) throw new Error("organizationId is required");

    const { data, error } = await supabase.rpc("time_summary_by_project", {
        org_id: organizationId,
        from_date: fromDate,
        to_date: toDate,
    });

    if (error) throw error;
    return data as TimeSummaryByProject[];
}

// Add similar summary functions for client, user, invoice-ready, etc. as needed.
