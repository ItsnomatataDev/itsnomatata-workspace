import { supabase } from "../client";

export type TimeApprovalStatus = "pending" | "approved" | "rejected";

export type AdminTimeEntryRow = {
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
  duration_seconds: number;
  is_running: boolean;
  is_billable: boolean;
  source: string | null;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  locked_at: string | null;
  hourly_rate_snapshot: number | null;
  cost_amount: number | null;
  created_at: string;
  updated_at: string;

  user_name?: string | null;
  user_email?: string | null;
  task_title?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  campaign_name?: string | null;
};

export async function getAdminTimeEntries(params: {
  organizationId: string;
  approvalStatus?: TimeApprovalStatus | "all";
  userId?: string;
  projectId?: string;
  isBillable?: boolean | "all";
  from?: string;
  to?: string;
  limit?: number;
}) {
  const {
    organizationId,
    approvalStatus = "pending",
    userId,
    projectId,
    isBillable = "all",
    from,
    to,
    limit = 100,
  } = params;

  if (!organizationId) throw new Error("organizationId is required");

  let query = supabase
    .from("time_entries")
    .select(
      `
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
      duration_seconds,
      is_running,
      is_billable,
      source,
      approval_status,
      approved_by,
      approved_at,
      locked_at,
      hourly_rate_snapshot,
      cost_amount,
      created_at,
      updated_at
      `,
    )
    .eq("organization_id", organizationId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (approvalStatus !== "all") {
    query = query.eq("approval_status", approvalStatus);
  }

  if (userId) query = query.eq("user_id", userId);
  if (projectId) query = query.eq("project_id", projectId);
  if (isBillable !== "all") query = query.eq("is_billable", isBillable);
  if (from) query = query.gte("started_at", from);
  if (to) query = query.lte("started_at", to);

  const { data, error } = await query;
  if (error) throw error;

  const items = (data ?? []) as AdminTimeEntryRow[];

  const userIds = [...new Set(items.map((i) => i.user_id).filter(Boolean))];
  const taskIds = [...new Set(items.map((i) => i.task_id).filter(Boolean))] as string[];
  const projectIds = [...new Set(items.map((i) => i.project_id).filter(Boolean))] as string[];
  const clientIds = [...new Set(items.map((i) => i.client_id).filter(Boolean))] as string[];
  const campaignIds = [...new Set(items.map((i) => i.campaign_id).filter(Boolean))] as string[];

  const [
    profilesResult,
    tasksResult,
    projectsResult,
    clientsResult,
    campaignsResult,
  ] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    taskIds.length
      ? supabase.from("tasks").select("id, title").in("id", taskIds)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length
      ? supabase.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [], error: null }),
    clientIds.length
      ? supabase.from("clients").select("id, name").in("id", clientIds)
      : Promise.resolve({ data: [], error: null }),
    campaignIds.length
      ? supabase.from("campaigns").select("id, name").in("id", campaignIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (tasksResult.error) throw tasksResult.error;
  if (projectsResult.error) throw projectsResult.error;
  if (clientsResult.error) throw clientsResult.error;
  if (campaignsResult.error) throw campaignsResult.error;

  const profileMap = new Map(
    (profilesResult.data ?? []).map((row) => [row.id, row]),
  );
  const taskMap = new Map((tasksResult.data ?? []).map((row) => [row.id, row]));
  const projectMap = new Map(
    (projectsResult.data ?? []).map((row) => [row.id, row]),
  );
  const clientMap = new Map(
    (clientsResult.data ?? []).map((row) => [row.id, row]),
  );
  const campaignMap = new Map(
    (campaignsResult.data ?? []).map((row) => [row.id, row]),
  );

  return items.map((item) => ({
    ...item,
    user_name: profileMap.get(item.user_id)?.full_name ?? null,
    user_email: profileMap.get(item.user_id)?.email ?? null,
    task_title: item.task_id ? taskMap.get(item.task_id)?.title ?? null : null,
    project_name: item.project_id
      ? projectMap.get(item.project_id)?.name ?? null
      : null,
    client_name: item.client_id
      ? clientMap.get(item.client_id)?.name ?? null
      : null,
    campaign_name: item.campaign_id
      ? campaignMap.get(item.campaign_id)?.name ?? null
      : null,
  })) as AdminTimeEntryRow[];
}

export async function getAdminTimeSummary(params: {
  organizationId: string;
  from?: string;
  to?: string;
}) {
  const { organizationId, from, to } = params;
  if (!organizationId) throw new Error("organizationId is required");

  let query = supabase
    .from("time_entries")
    .select("duration_seconds, approval_status, is_billable, cost_amount, is_running")
    .eq("organization_id", organizationId);

  if (from) query = query.gte("started_at", from);
  if (to) query = query.lte("started_at", to);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];

  let totalSeconds = 0;
  let pendingCount = 0;
  let approvedSeconds = 0;
  let billableSeconds = 0;
  let activeCount = 0;
  let totalCost = 0;

  for (const row of rows) {
    const seconds = Number(row.duration_seconds ?? 0);
    totalSeconds += seconds;
    if (row.approval_status === "pending") pendingCount += 1;
    if (row.approval_status === "approved") approvedSeconds += seconds;
    if (row.is_billable) billableSeconds += seconds;
    if (row.is_running) activeCount += 1;
    totalCost += Number(row.cost_amount ?? 0);
  }

  return {
    totalSeconds,
    pendingCount,
    approvedSeconds,
    billableSeconds,
    activeCount,
    totalCost,
  };
}