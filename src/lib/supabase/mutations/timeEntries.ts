import { supabase } from "../client";

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

export const stopTimeEntry = async (entryId: string): Promise<TimeEntryItem> => {
  const endedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("time_entries")
    .update({
      ended_at: endedAt,
    })
    .eq("id", entryId)
    .select(TIME_ENTRY_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as TimeEntryItem;
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
      duration_seconds: calculateDurationSeconds(payload.startedAt, payload.endedAt),
      is_running: false,
      is_billable: payload.isBillable ?? false,
      source: payload.source ?? "manual",
      metadata: payload.metadata ?? {},
    })
    .select(TIME_ENTRY_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as TimeEntryItem;
};

export const updateTimeEntry = async ({
  entryId,
  payload,
}: {
  entryId: string;
  payload: UpdateTimeEntryInput;
}): Promise<TimeEntryItem> => {
  if (payload.started_at && payload.ended_at) {
    ensureValidRange(payload.started_at, payload.ended_at);
  }

  const updatePayload: Record<string, unknown> = { ...payload };

  if (payload.task_id) {
    const task = await getTaskContext(payload.task_id);

    updatePayload.project_id = payload.project_id ?? task.project_id;
    updatePayload.client_id = payload.client_id ?? task.client_id;
    updatePayload.campaign_id = payload.campaign_id ?? task.campaign_id;
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

  return data as TimeEntryItem;
};

export const deleteTimeEntry = async (entryId: string): Promise<void> => {
  const { error } = await supabase.from("time_entries").delete().eq("id", entryId);

  if (error) {
    throw new Error(error.message);
  }
};

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

export async function getProjects(params: GetProjectsParams): Promise<ProjectRow[]> {
  const {
    organizationId,
    clientId,
    campaignId,
    isActive,
    search,
    limit = 50,
    offset = 0,
  } = params;

  if (!organizationId) throw new Error("organizationId is required");

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

  query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as ProjectRow[];
}

export async function getProjectById(organizationId: string, projectId: string): Promise<ProjectRow | null> {
  if (!organizationId) throw new Error("organizationId is required");
  if (!projectId) throw new Error("projectId is required");

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", projectId)
    .single();

  if (error && error.code !== "PGRST116") throw error; // Not found
  return data as ProjectRow | null;
}