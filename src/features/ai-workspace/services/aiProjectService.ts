import { supabase } from "../../../lib/supabase/client";

export interface AIWorkspaceProject {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function mapProjectRow(row: any): AIWorkspaceProject {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AIProjectService {
  static async listProjects(params: {
    userId: string;
    organizationId?: string | null;
  }): Promise<AIWorkspaceProject[]> {
    try {
      let query = supabase
        .from("ai_workspace_projects")
        .select("*")
        .eq("user_id", params.userId)
        .order("updated_at", { ascending: false });

      if (params.organizationId) {
        query = query.eq("organization_id", params.organizationId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map(mapProjectRow);
    } catch (error) {
      console.warn("AI projects are unavailable:", error);
      return [];
    }
  }

  static async createProject(params: {
    userId: string;
    organizationId: string;
    title: string;
    description?: string | null;
  }): Promise<AIWorkspaceProject> {
    const { data, error } = await supabase
      .from("ai_workspace_projects")
      .insert({
        user_id: params.userId,
        organization_id: params.organizationId,
        title: params.title,
        description: params.description ?? null,
        metadata: {},
      })
      .select("*")
      .single();

    if (error) throw error;
    return mapProjectRow(data);
  }
}
