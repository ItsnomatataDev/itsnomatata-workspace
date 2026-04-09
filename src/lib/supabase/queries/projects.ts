import { supabase } from "../client";

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