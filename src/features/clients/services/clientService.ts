import { supabase } from "../../../lib/supabase/client";
import { slugify } from "../../../lib/utils/slugify";
export interface ClientItem {
  id: string;
  organization_id: string;
  name: string;
  slug?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logo_url?: string | null;
  industry?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientWorkspaceTaskItem {
  id: string;
  organization_id: string;
  project_id: string | null;
  client_id: string | null;
  campaign_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  department: string | null;
  tracked_seconds_cache?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ClientTaskInviteItem {
  id: string;
  task_id: string;
  organization_id: string;
  client_id: string | null;
  client_contact_id: string | null;
  invited_email: string | null;
  invited_name: string | null;
  can_view: boolean;
  can_comment: boolean;
  can_review_submissions: boolean;
  can_approve: boolean;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientVisibleTaskSummary {
  task_id: string;
  total_seconds: number;
  last_tracked_at: string | null;
}

export interface CreateClientInput {
  organizationId: string;
  name: string;
  slug?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  industry?: string | null;
  notes?: string | null;
}

export interface UpdateClientInput {
  name?: string;
  slug?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logo_url?: string | null;
  industry?: string | null;
  notes?: string | null;
}

function normalizeOptional(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createClient(
  input: CreateClientInput,
): Promise<ClientItem> {
  const { organizationId, name } = input;

  if (!organizationId) throw new Error("organizationId is required");
  if (!name?.trim()) throw new Error("name is required");

  const generatedSlug = input.slug?.trim()
    ? normalizeOptional(input.slug)
    : slugify(name);

  const payload = {
    organization_id: organizationId,
    name: name.trim(),
    slug: generatedSlug,
    email: normalizeOptional(input.email),
    phone: normalizeOptional(input.phone),
    website: normalizeOptional(input.website),
    logo_url: normalizeOptional(input.logoUrl),
    industry: normalizeOptional(input.industry),
    notes: normalizeOptional(input.notes),
  };

  const { data, error } = await supabase
    .from("clients")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ClientItem;
}

export async function updateClient(
  organizationId: string,
  clientId: string,
  input: UpdateClientInput,
): Promise<ClientItem> {
  if (!organizationId) throw new Error("organizationId is required");
  if (!clientId) throw new Error("clientId is required");

  const payload = {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.slug !== undefined ? { slug: normalizeOptional(input.slug) } : {}),
    ...(input.email !== undefined
      ? { email: normalizeOptional(input.email) }
      : {}),
    ...(input.phone !== undefined
      ? { phone: normalizeOptional(input.phone) }
      : {}),
    ...(input.website !== undefined
      ? { website: normalizeOptional(input.website) }
      : {}),
    ...(input.logo_url !== undefined
      ? { logo_url: normalizeOptional(input.logo_url) }
      : {}),
    ...(input.industry !== undefined
      ? { industry: normalizeOptional(input.industry) }
      : {}),
    ...(input.notes !== undefined
      ? { notes: normalizeOptional(input.notes) }
      : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("clients")
    .update(payload)
    .eq("organization_id", organizationId)
    .eq("id", clientId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ClientItem;
}

export async function getClients(organizationId: string): Promise<ClientItem[]> {
  if (!organizationId) throw new Error("organizationId is required");

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ClientItem[];
}

export async function getClientById(
  organizationId: string,
  clientId: string,
): Promise<ClientItem | null> {
  if (!organizationId) throw new Error("organizationId is required");
  if (!clientId) throw new Error("clientId is required");

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", clientId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ClientItem | null) ?? null;
}

/**
 * Direct tasks linked to the client through tasks.client_id.
 * Keep this for internal reporting screens if needed.
 */
export async function getClientWorkspaceTasks(params: {
  organizationId: string;
  clientId: string;
}): Promise<ClientWorkspaceTaskItem[]> {
  const { organizationId, clientId } = params;

  if (!organizationId) throw new Error("organizationId is required");
  if (!clientId) throw new Error("clientId is required");

  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id,
      organization_id,
      project_id,
      client_id,
      campaign_id,
      title,
      description,
      status,
      priority,
      due_date,
      department,
      tracked_seconds_cache,
      created_at,
      updated_at
    `)
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ClientWorkspaceTaskItem[];
}

export async function getTaskClientInvitesForClient(params: {
  organizationId: string;
  clientId: string;
}): Promise<ClientTaskInviteItem[]> {
  const { organizationId, clientId } = params;

  if (!organizationId) throw new Error("organizationId is required");
  if (!clientId) throw new Error("clientId is required");

  const { data, error } = await supabase
    .from("task_client_invites")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .eq("can_view", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ClientTaskInviteItem[];
}

export async function getClientInvitedTasks(params: {
  organizationId: string;
  clientId: string;
}): Promise<ClientWorkspaceTaskItem[]> {
  const invites = await getTaskClientInvitesForClient(params);

  const taskIds = invites
    .map((invite) => invite.task_id)
    .filter((id): id is string => Boolean(id));

  const uniqueTaskIds = [...new Set(taskIds)];

  if (uniqueTaskIds.length === 0) return [];

  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id,
      organization_id,
      project_id,
      client_id,
      campaign_id,
      title,
      description,
      status,
      priority,
      due_date,
      department,
      tracked_seconds_cache,
      created_at,
      updated_at
    `)
    .eq("organization_id", params.organizationId)
    .in("id", uniqueTaskIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ClientWorkspaceTaskItem[];
}

export async function getClientVisibleTaskTimeSummary(params: {
  organizationId: string;
  taskId: string;
}): Promise<ClientVisibleTaskSummary> {
  const { organizationId, taskId } = params;

  if (!organizationId) throw new Error("organizationId is required");
  if (!taskId) throw new Error("taskId is required");

  const { data, error } = await supabase
    .from("time_entries")
    .select("duration_seconds, updated_at")
    .eq("organization_id", organizationId)
    .eq("task_id", taskId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const total_seconds = rows.reduce(
    (sum, row) => sum + Number(row.duration_seconds ?? 0),
    0,
  );

  return {
    task_id: taskId,
    total_seconds,
    last_tracked_at: rows[0]?.updated_at ?? null,
  };
}