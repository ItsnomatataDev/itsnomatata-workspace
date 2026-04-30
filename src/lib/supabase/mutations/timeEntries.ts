import { supabase } from "../client";
import { logTaskTimeTracked } from "./taskUpdates";

export type TimeEntryApprovalStatus = "pending" | "approved" | "rejected";

export interface TimeEntryItem {
  id: string;
  organization_id: string;
  user_id: string;
  task_id: string | null;
  project_id: string | null;
  client_id: string | null;
  campaign_id: string | null;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  is_running: boolean;
  duration_seconds: number;
  source: string | null;
  entry_type?: "timer" | "manual" | "imported";
  source_entry_id?: string | null;
  source_card_id?: string | null;
  source_board_id?: string | null;
  source_user_id?: string | null;
  source_user_name?: string | null;
  is_billable: boolean;
  hourly_rate_snapshot: number | null;
  cost_amount: number | null;
  approval_status: TimeEntryApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  invoice_id: string | null;
  locked_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StartTimeEntryInput {
  organizationId: string;
  userId: string;
  taskId?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  campaignId?: string | null;
  description?: string | null;
  isBillable?: boolean;
  source?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ManualTimeEntryInput {
  organizationId: string;
  userId: string;
  taskId?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  campaignId?: string | null;
  description?: string | null;
  startedAt: string;
  endedAt: string;
  isBillable?: boolean;
  source?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateTimeEntryInput {
  description?: string | null;
  started_at?: string;
  ended_at?: string | null;
  task_id?: string | null;
  project_id?: string | null;
  client_id?: string | null;
  campaign_id?: string | null;
  is_billable?: boolean;
  metadata?: Record<string, unknown>;
}

interface TaskContextRow {
  id: string;
  organization_id: string;
  project_id: string | null;
  client_id: string | null;
  campaign_id: string | null;
  title: string;
}

export interface ProjectRow {
  id: string;
  organization_id: string;
  client_id: string | null;
  campaign_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  budget_id: string | null;
  billing_rate_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface GetProjectsParams {
  organizationId: string;
  clientId?: string;
  campaignId?: string;
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

const TIME_ENTRY_SELECT = `
  id,
  organization_id,
  user_id,
  task_id,
  project_id,
  client_id,
  campaign_id,
  description,
  started_at,
  ended_at,
  is_running,
  duration_seconds,
  source,
  is_billable,
  hourly_rate_snapshot,
  cost_amount,
  approval_status,
  approved_by,
  approved_at,
  invoice_id,
  locked_at,
  metadata,
  created_at,
  updated_at
`;

async function getTaskContext(taskId: string): Promise<TaskContextRow> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, organization_id, project_id, client_id, campaign_id, title")
    .eq("id", taskId)
    .single();

  if (error) {
    throw new Error(`Failed to load task context: ${error.message}`);
  }

  return data as TaskContextRow;
}

function ensureValidRange(startedAt: string, endedAt: string) {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error("Invalid start or end date.");
  }

  if (end < start) {
    throw new Error("End time cannot be earlier than start time.");
  }
}

function calculateDurationSeconds(startedAt: string, endedAt: string) {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  return Math.max(0, Math.floor((end - start) / 1000));
}

export async function syncTaskTrackedSecondsCache(params: {
  organizationId: string;
  taskId: string;
}) {
  const { data: rows, error: timeError } = await supabase
    .from("time_entries")
    .select("duration_seconds")
    .eq("organization_id", params.organizationId)
    .eq("task_id", params.taskId)
    .not("duration_seconds", "is", null);

  if (timeError) {
    throw new Error(timeError.message);
  }

  const totalSeconds = (rows ?? []).reduce(
    (sum, row) => sum + Number(row.duration_seconds ?? 0),
    0,
  );

  const { error: taskError } = await supabase
    .from("tasks")
    .update({
      tracked_seconds_cache: totalSeconds,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", params.organizationId)
    .eq("id", params.taskId);

  if (taskError) {
    throw new Error(taskError.message);
  }

  return totalSeconds;
}

async function ensureNoOtherRunningEntry(params: {
  organizationId: string;
  userId: string;
  ignoreEntryId?: string;
}) {
  let query = supabase
    .from("time_entries")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId)
    .is("ended_at", null)
    .limit(1);

  if (params.ignoreEntryId) {
    query = query.neq("id", params.ignoreEntryId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data?.id) {
    throw new Error(
      "You already have a running timer. Stop it first before starting or resuming another one.",
    );
  }
}

export const getActiveTimeEntry = async ({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId: string;
}): Promise<TimeEntryItem | null> => {
  const { data, error } = await supabase
    .from("time_entries")
    .select(TIME_ENTRY_SELECT)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as TimeEntryItem | null) ?? null;
};

export const getTimeEntriesForUser = async ({
  organizationId,
  userId,
  startDate,
  endDate,
}: {
  organizationId: string;
  userId: string;
  startDate?: string;
  endDate?: string;
}): Promise<TimeEntryItem[]> => {
  let query = supabase
    .from("time_entries")
    .select(TIME_ENTRY_SELECT)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("started_at", { ascending: false });

  if (startDate) {
    query = query.gte("started_at", startDate);
  }

  if (endDate) {
    query = query.lte("started_at", endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as TimeEntryItem[];
};

export const startTimeEntry = async (
  payload: StartTimeEntryInput,
): Promise<TimeEntryItem> => {
  if (!payload.organizationId) {
    throw new Error("organizationId is required");
  }

  if (!payload.userId) {
    throw new Error("userId is required");
  }

  await ensureNoOtherRunningEntry({
    organizationId: payload.organizationId,
    userId: payload.userId,
  });

  let projectId = payload.projectId ?? null;
  let clientId = payload.clientId ?? null;
  let campaignId = payload.campaignId ?? null;

  if (payload.taskId) {
    const task = await getTaskContext(payload.taskId);

    if (task.organization_id !== payload.organizationId) {
      throw new Error("Task does not belong to the provided organization.");
    }

    projectId = projectId ?? task.project_id;
    clientId = clientId ?? task.client_id;
    campaignId = campaignId ?? task.campaign_id;
  }

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      organization_id: payload.organizationId,
      user_id: payload.userId,
      task_id: payload.taskId ?? null,
      project_id: projectId,
      client_id: clientId,
      campaign_id: campaignId,
      description: payload.description ?? null,
      started_at: new Date().toISOString(),
      ended_at: null,
      is_running: true,
      duration_seconds: 0,
      is_billable: payload.isBillable ?? false,
      source: payload.source ?? "timer",
      metadata: payload.metadata ?? {},
    })
    .select(TIME_ENTRY_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as TimeEntryItem;
};

export const stopTimeEntry = async (
  entryId: string,
  options?: { userId?: string; organizationId?: string },
): Promise<TimeEntryItem> => {
  if (!entryId) {
    throw new Error("entryId is required");
  }

  const { data: existing, error: existingError } = await supabase
    .from("time_entries")
    .select("id, started_at, task_id, organization_id, user_id")
    .eq("id", entryId)
    .single();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const endedAt = new Date().toISOString();
  const durationSeconds = calculateDurationSeconds(
    existing.started_at,
    endedAt,
  );

  const { data, error } = await supabase
    .from("time_entries")
    .update({
      ended_at: endedAt,
      is_running: false,
      duration_seconds: durationSeconds,
    })
    .eq("id", entryId)
    .select(TIME_ENTRY_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const result = data as TimeEntryItem;

  // Log task update when time is tracked against a task
  if (result.task_id) {
    try {
      await syncTaskTrackedSecondsCache({
        organizationId: options?.organizationId ?? result.organization_id,
        taskId: result.task_id,
      });

      await logTaskTimeTracked({
        organizationId: options?.organizationId ?? result.organization_id,
        taskId: result.task_id,
        userId: options?.userId ?? result.user_id,
        timeEntryId: result.id,
        durationSeconds,
        isBillable: result.is_billable,
      });
    } catch (logErr) {
      // Non-fatal: don't fail the stop operation if logging fails
      console.warn("Failed to log task time tracking:", logErr);
    }
  }

  return result;
};

export const resumeTimeEntry = async ({
  entryId,
  userId,
  organizationId,
}: {
  entryId: string;
  userId: string;
  organizationId: string;
}): Promise<TimeEntryItem> => {
  if (!entryId) {
    throw new Error("entryId is required");
  }

  if (!userId) {
    throw new Error("userId is required");
  }

  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  await ensureNoOtherRunningEntry({
    organizationId,
    userId,
  });

  const { data: existing, error: existingError } = await supabase
    .from("time_entries")
    .select(TIME_ENTRY_SELECT)
    .eq("id", entryId)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .single();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const entry = existing as TimeEntryItem;

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      organization_id: entry.organization_id,
      user_id: entry.user_id,
      task_id: entry.task_id,
      project_id: entry.project_id,
      client_id: entry.client_id,
      campaign_id: entry.campaign_id,
      description: entry.description,
      started_at: new Date().toISOString(),
      ended_at: null,
      is_running: true,
      duration_seconds: 0,
      is_billable: entry.is_billable,
      source: "resume",
      metadata: {
        resumed_from_entry_id: entry.id,
        ...(entry.metadata ?? {}),
      },
    })
    .select(TIME_ENTRY_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as TimeEntryItem;
};

export const createManualTimeEntry = async (
  payload: ManualTimeEntryInput,
): Promise<TimeEntryItem> => {
  if (!payload.organizationId) {
    throw new Error("organizationId is required");
  }

  if (!payload.userId) {
    throw new Error("userId is required");
  }

  ensureValidRange(payload.startedAt, payload.endedAt);

  let projectId = payload.projectId ?? null;
  let clientId = payload.clientId ?? null;
  let campaignId = payload.campaignId ?? null;

  if (payload.taskId) {
    const task = await getTaskContext(payload.taskId);

    if (task.organization_id !== payload.organizationId) {
      throw new Error("Task does not belong to the provided organization.");
    }

    projectId = projectId ?? task.project_id;
    clientId = clientId ?? task.client_id;
    campaignId = campaignId ?? task.campaign_id;
  }

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      organization_id: payload.organizationId,
      user_id: payload.userId,
      task_id: payload.taskId ?? null,
      project_id: projectId,
      client_id: clientId,
      campaign_id: campaignId,
      description: payload.description ?? null,
      started_at: payload.startedAt,
      ended_at: payload.endedAt,
      is_running: false,
      duration_seconds: calculateDurationSeconds(
        payload.startedAt,
        payload.endedAt,
      ),
      is_billable: payload.isBillable ?? false,
      source: payload.source ?? "manual",
      metadata: payload.metadata ?? {},
    })
    .select(TIME_ENTRY_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const result = data as TimeEntryItem;

  // Log task update when time is tracked against a task
  if (result.task_id) {
    try {
      await syncTaskTrackedSecondsCache({
        organizationId: payload.organizationId,
        taskId: result.task_id,
      });

      await logTaskTimeTracked({
        organizationId: payload.organizationId,
        taskId: result.task_id,
        userId: payload.userId,
        timeEntryId: result.id,
        durationSeconds: result.duration_seconds,
        isBillable: result.is_billable,
      });
    } catch (logErr) {
      console.warn("Failed to log task time tracking:", logErr);
    }
  }

  return result;
};

export const updateTimeEntry = async ({
  entryId,
  payload,
}: {
  entryId: string;
  payload: UpdateTimeEntryInput;
}): Promise<TimeEntryItem> => {
  if (!entryId) {
    throw new Error("entryId is required");
  }

  const { data: existing, error: existingError } = await supabase
    .from("time_entries")
    .select(TIME_ENTRY_SELECT)
    .eq("id", entryId)
    .single();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const current = existing as TimeEntryItem;

  const nextStartedAt = payload.started_at ?? current.started_at;
  const nextEndedAt = payload.ended_at === undefined
    ? current.ended_at
    : payload.ended_at;

  if (nextStartedAt && nextEndedAt) {
    ensureValidRange(nextStartedAt, nextEndedAt);
  }

  const updatePayload: Record<string, unknown> = {
    ...payload,
  };

  if (payload.task_id) {
    const task = await getTaskContext(payload.task_id);
    updatePayload.project_id = payload.project_id ?? task.project_id;
    updatePayload.client_id = payload.client_id ?? task.client_id;
    updatePayload.campaign_id = payload.campaign_id ?? task.campaign_id;
  }

  if (nextEndedAt) {
    const newDuration = calculateDurationSeconds(
      nextStartedAt,
      nextEndedAt,
    );
    updatePayload.duration_seconds = newDuration;
    updatePayload.is_running = false;
    // Recalculate cost if hourly rate snapshot exists
    if (current.hourly_rate_snapshot) {
      updatePayload.cost_amount = Math.round(
        current.hourly_rate_snapshot * (newDuration / 3600) * 100,
      ) / 100;
    }
  } else {
    updatePayload.duration_seconds = 0;
    updatePayload.is_running = true;
    updatePayload.cost_amount = 0;
  }

  const { data, error } = await supabase
    .from("time_entries")
    .update(updatePayload)
    .eq("id", entryId)
    .select(TIME_ENTRY_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const result = data as TimeEntryItem;

  if (result.task_id) {
    try {
      await syncTaskTrackedSecondsCache({
        organizationId: result.organization_id,
        taskId: result.task_id,
      });
    } catch (cacheErr) {
      console.warn("Failed to sync task tracked time cache:", cacheErr);
    }
  }

  return result;
};

export const deleteTimeEntry = async (entryId: string): Promise<void> => {
  if (!entryId) {
    throw new Error("entryId is required");
  }

  const { data: existing, error: existingError } = await supabase
    .from("time_entries")
    .select("organization_id, task_id")
    .eq("id", entryId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const { error } = await supabase
    .from("time_entries")
    .delete()
    .eq("id", entryId);

  if (error) {
    throw new Error(error.message);
  }

  if (existing?.task_id) {
    try {
      await syncTaskTrackedSecondsCache({
        organizationId: existing.organization_id,
        taskId: existing.task_id,
      });
    } catch (cacheErr) {
      console.warn("Failed to sync task tracked time cache:", cacheErr);
    }
  }
};

export async function getProjects(
  params: GetProjectsParams,
): Promise<ProjectRow[]> {
  const {
    organizationId,
    clientId,
    campaignId,
    isActive,
    search,
    limit = 50,
    offset = 0,
  } = params;

  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  let query = supabase
    .from("projects")
    .select("*")
    .eq("organization_id", organizationId);

  if (typeof isActive === "boolean") {
    query = query.eq("is_active", isActive);
  }

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  if (campaignId) {
    query = query.eq("campaign_id", campaignId);
  }

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as ProjectRow[];
}

export async function getProjectById(
  organizationId: string,
  projectId: string,
): Promise<ProjectRow | null> {
  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  if (!projectId) {
    throw new Error("projectId is required");
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", projectId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return (data as ProjectRow | null) ?? null;
}
