import { supabase } from "../client";
import type { ProjectRow } from "../queries/projects";

export type ProjectStatus =
    | "planning"
    | "active"
    | "on_hold"
    | "completed"
    | "archived";

export type ProjectPriority = "low" | "medium" | "high" | "urgent";

export type ProjectMemberRole = "owner" | "admin" | "member" | "viewer";

export interface ProjectItem extends ProjectRow {
    created_by: string | null;
    status: ProjectStatus | string | null;
    priority: ProjectPriority | string | null;
    due_date: string | null;
}

export interface ProjectMemberRow {
    id: string;
    project_id: string;
    user_id: string;
    role: ProjectMemberRole | string;
    invited_by: string | null;
    created_at: string | null;
}

export interface CreateProjectInput {
    organizationId: string;
    name: string;
    description?: string | null;
    clientId?: string | null;
    campaignId?: string | null;
    color?: string | null;
    budgetId?: string | null;
    billingRateId?: string | null;
    createdBy?: string | null;
    status?: ProjectStatus | string | null;
    priority?: ProjectPriority | string | null;
    dueDate?: string | null;
    isActive?: boolean;
    metadata?: Record<string, unknown>;
    memberIds?: string[];
}

export interface UpdateProjectInput {
    organizationId: string;
    name?: string;
    description?: string | null;
    clientId?: string | null;
    campaignId?: string | null;
    color?: string | null;
    budgetId?: string | null;
    billingRateId?: string | null;
    status?: ProjectStatus | string | null;
    priority?: ProjectPriority | string | null;
    dueDate?: string | null;
    isActive?: boolean;
    metadata?: Record<string, unknown>;
}

const PROJECT_SELECT = `
  id,
  organization_id,
  client_id,
  campaign_id,
  name,
  description,
  color,
  is_active,
  budget_id,
  billing_rate_id,
  metadata,
  created_at,
  updated_at,
  created_by,
  status,
  priority,
  due_date
`;

async function ensureProjectInOrganization(
    organizationId: string,
    projectId: string,
): Promise<void> {
    const { error } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("organization_id", organizationId)
        .single();

    if (error) {
        throw error;
    }
}

async function recordProjectActivity({
    projectId,
    userId,
    action,
    details,
}: {
    projectId: string;
    userId?: string | null;
    action: string;
    details?: Record<string, unknown>;
}) {
    await supabase.from("project_activity").insert({
        project_id: projectId,
        user_id: userId ?? null,
        action,
        details: details ?? {},
    });
}

async function upsertProjectMembers({
    projectId,
    createdBy,
    memberIds = [],
}: {
    projectId: string;
    createdBy?: string | null;
    memberIds?: string[];
}): Promise<void> {
    const uniqueMemberIds = [...new Set(memberIds.filter(Boolean))];
    const rows: Array<{
        project_id: string;
        user_id: string;
        role: ProjectMemberRole;
        invited_by: string | null;
    }> = [];

    if (createdBy) {
        rows.push({
            project_id: projectId,
            user_id: createdBy,
            role: "owner",
            invited_by: createdBy,
        });
    }

    for (const userId of uniqueMemberIds) {
        if (userId === createdBy) {
            continue;
        }

        rows.push({
            project_id: projectId,
            user_id: userId,
            role: "member",
            invited_by: createdBy ?? null,
        });
    }

    if (rows.length === 0) {
        return;
    }

    const { error } = await supabase.from("project_members").upsert(rows, {
        onConflict: "project_id,user_id",
        ignoreDuplicates: false,
    });

    if (error) {
        throw error;
    }
}

export async function createProject(
    payload: CreateProjectInput,
): Promise<ProjectItem> {
    const trimmedName = payload.name.trim();

    if (!payload.organizationId) {
        throw new Error("organizationId is required");
    }

    if (!trimmedName) {
        throw new Error("Project name is required");
    }

    const { data, error } = await supabase
        .from("projects")
        .insert({
            organization_id: payload.organizationId,
            name: trimmedName,
            description: payload.description ?? null,
            client_id: payload.clientId ?? null,
            campaign_id: payload.campaignId ?? null,
            color: payload.color ?? null,
            budget_id: payload.budgetId ?? null,
            billing_rate_id: payload.billingRateId ?? null,
            created_by: payload.createdBy ?? null,
            status: payload.status ?? "active",
            priority: payload.priority ?? "medium",
            due_date: payload.dueDate ?? null,
            is_active: payload.isActive ?? true,
            metadata: payload.metadata ?? {},
        })
        .select(PROJECT_SELECT)
        .single();

    if (error) {
        throw error;
    }

    await upsertProjectMembers({
        projectId: data.id,
        createdBy: payload.createdBy,
        memberIds: payload.memberIds,
    });

    if (payload.createdBy) {
        await recordProjectActivity({
            projectId: data.id,
            userId: payload.createdBy,
            action: "Project created",
            details: {
                name: trimmedName,
                status: payload.status ?? "active",
                priority: payload.priority ?? "medium",
            },
        });
    }

    return data as ProjectItem;
}

export async function updateProject(
    projectId: string,
    payload: UpdateProjectInput,
): Promise<ProjectItem> {
    if (!projectId) {
        throw new Error("projectId is required");
    }

    if (!payload.organizationId) {
        throw new Error("organizationId is required");
    }

    await ensureProjectInOrganization(payload.organizationId, projectId);

    const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };

    let hasChanges = false;

    if (payload.name !== undefined) {
        const trimmedName = payload.name.trim();

        if (!trimmedName) {
            throw new Error("Project name cannot be empty");
        }

        updatePayload.name = trimmedName;
        hasChanges = true;
    }

    if (payload.description !== undefined) {
        updatePayload.description = payload.description;
        hasChanges = true;
    }

    if (payload.clientId !== undefined) {
        updatePayload.client_id = payload.clientId;
        hasChanges = true;
    }

    if (payload.campaignId !== undefined) {
        updatePayload.campaign_id = payload.campaignId;
        hasChanges = true;
    }

    if (payload.color !== undefined) {
        updatePayload.color = payload.color;
        hasChanges = true;
    }

    if (payload.budgetId !== undefined) {
        updatePayload.budget_id = payload.budgetId;
        hasChanges = true;
    }

    if (payload.billingRateId !== undefined) {
        updatePayload.billing_rate_id = payload.billingRateId;
        hasChanges = true;
    }

    if (payload.status !== undefined) {
        updatePayload.status = payload.status;
        hasChanges = true;
    }

    if (payload.priority !== undefined) {
        updatePayload.priority = payload.priority;
        hasChanges = true;
    }

    if (payload.dueDate !== undefined) {
        updatePayload.due_date = payload.dueDate;
        hasChanges = true;
    }

    if (payload.isActive !== undefined) {
        updatePayload.is_active = payload.isActive;
        hasChanges = true;
    }

    if (payload.metadata !== undefined) {
        updatePayload.metadata = payload.metadata;
        hasChanges = true;
    }

    if (!hasChanges) {
        throw new Error("At least one project field must be provided");
    }

    const { data, error } = await supabase
        .from("projects")
        .update(updatePayload)
        .eq("id", projectId)
        .eq("organization_id", payload.organizationId)
        .select(PROJECT_SELECT)
        .single();

    if (error) {
        throw error;
    }

    return data as ProjectItem;
}

async function setProjectActiveState({
    organizationId,
    projectId,
    isActive,
    actorId,
    action,
}: {
    organizationId: string;
    projectId: string;
    isActive: boolean;
    actorId?: string | null;
    action: string;
}): Promise<ProjectItem> {
    await ensureProjectInOrganization(organizationId, projectId);

    const { data, error } = await supabase
        .from("projects")
        .update({
            is_active: isActive,
            status: isActive ? "active" : "archived",
            updated_at: new Date().toISOString(),
        })
        .eq("id", projectId)
        .eq("organization_id", organizationId)
        .select(PROJECT_SELECT)
        .single();

    if (error) {
        throw error;
    }

    await recordProjectActivity({
        projectId,
        userId: actorId,
        action,
        details: {
            is_active: isActive,
        },
    });

    return data as ProjectItem;
}

export async function archiveProject(args: {
    organizationId: string;
    projectId: string;
    archivedBy?: string | null;
}): Promise<ProjectItem> {
    return setProjectActiveState({
        organizationId: args.organizationId,
        projectId: args.projectId,
        isActive: false,
        actorId: args.archivedBy,
        action: "Project archived",
    });
}

export async function restoreProject(args: {
    organizationId: string;
    projectId: string;
    restoredBy?: string | null;
}): Promise<ProjectItem> {
    return setProjectActiveState({
        organizationId: args.organizationId,
        projectId: args.projectId,
        isActive: true,
        actorId: args.restoredBy,
        action: "Project restored",
    });
}

export async function deleteProject(args: {
    organizationId: string;
    projectId: string;
}): Promise<void> {
    if (!args.organizationId) {
        throw new Error("organizationId is required");
    }

    if (!args.projectId) {
        throw new Error("projectId is required");
    }

    const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", args.projectId)
        .eq("organization_id", args.organizationId);

    if (error) {
        throw error;
    }
}

export async function addProjectMember(args: {
    organizationId: string;
    projectId: string;
    userId: string;
    role?: ProjectMemberRole;
    invitedBy?: string | null;
}): Promise<ProjectMemberRow> {
    if (!args.userId) {
        throw new Error("userId is required");
    }

    await ensureProjectInOrganization(args.organizationId, args.projectId);

    const { data, error } = await supabase
        .from("project_members")
        .upsert(
            {
                project_id: args.projectId,
                user_id: args.userId,
                role: args.role ?? "member",
                invited_by: args.invitedBy ?? null,
            },
            {
                onConflict: "project_id,user_id",
                ignoreDuplicates: false,
            },
        )
        .select("id, project_id, user_id, role, invited_by, created_at")
        .single();

    if (error) {
        throw error;
    }

    await recordProjectActivity({
        projectId: args.projectId,
        userId: args.invitedBy,
        action: "Project member added",
        details: {
            member_user_id: args.userId,
            role: args.role ?? "member",
        },
    });

    return data as ProjectMemberRow;
}

export async function updateProjectMemberRole(args: {
    organizationId: string;
    projectId: string;
    userId: string;
    role: ProjectMemberRole;
}): Promise<ProjectMemberRow> {
    await ensureProjectInOrganization(args.organizationId, args.projectId);

    const { data, error } = await supabase
        .from("project_members")
        .update({
            role: args.role,
        })
        .eq("project_id", args.projectId)
        .eq("user_id", args.userId)
        .select("id, project_id, user_id, role, invited_by, created_at")
        .single();

    if (error) {
        throw error;
    }

    return data as ProjectMemberRow;
}

export async function removeProjectMember(args: {
    organizationId: string;
    projectId: string;
    userId: string;
}): Promise<void> {
    await ensureProjectInOrganization(args.organizationId, args.projectId);

    const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("project_id", args.projectId)
        .eq("user_id", args.userId);

    if (error) {
        throw error;
    }
}
