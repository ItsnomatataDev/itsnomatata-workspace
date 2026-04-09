import { supabase } from "../client";


export type TaskUpdateType =
    | "comment"
    | "status_changed"
    | "moved"
    | "assignee_changed"
    | "watcher_added"
    | "watcher_removed"
    | "checklist_updated"
    | "time_tracked"
    | "manual";

export interface TaskUpdateItem {
    id: string;
    organization_id: string;
    task_id: string;
    project_id: string | null;
    user_id: string | null;
    update_type: TaskUpdateType | string;
    message: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
    actor_name?: string | null;
    actor_email?: string | null;
}

export interface GetTaskUpdatesParams {
    organizationId: string;
    taskId?: string;
    projectId?: string;
    types?: Array<TaskUpdateType | string>;
    limit?: number;
    offset?: number;
}

const TASK_UPDATE_SELECT = `
  id,
  organization_id,
  task_id,
  project_id,
  user_id,
  update_type,
  message,
  metadata,
  created_at
`;

async function enrichTaskUpdatesWithActors(
    items: TaskUpdateItem[],
): Promise<TaskUpdateItem[]> {
    const userIds = [
        ...new Set(items.map((item) => item.user_id).filter(Boolean)),
    ] as string[];

    if (userIds.length === 0) {
        return items;
    }

    const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

    if (profilesError) {
        throw profilesError;
    }

    const profileMap = new Map(
        (profilesData ?? []).map((profile) => [profile.id, profile]),
    );

    return items.map((item) => {
        const actor = item.user_id ? profileMap.get(item.user_id) : null;

        return {
            ...item,
            actor_name: actor?.full_name ?? null,
            actor_email: actor?.email ?? null,
        };
    });
}

export async function getTaskUpdates(
    params: GetTaskUpdatesParams,
): Promise<TaskUpdateItem[]> {
    const {
        organizationId,
        taskId,
        projectId,
        types = [],
        limit = 50,
        offset = 0,
    } = params;

    if (!organizationId) {
        throw new Error("organizationId is required");
    }

    let query = supabase
        .from("task_updates")
        .select(TASK_UPDATE_SELECT)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (taskId) {
        query = query.eq("task_id", taskId);
    }

    if (projectId) {
        query = query.eq("project_id", projectId);
    }

    if (types.length > 0) {
        query = query.in("update_type", types);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return enrichTaskUpdatesWithActors((data ?? []) as TaskUpdateItem[]);
}

export async function getTaskUpdatesForTask(args: {
    organizationId: string;
    taskId: string;
    limit?: number;
    offset?: number;
}): Promise<TaskUpdateItem[]> {
    return getTaskUpdates({
        organizationId: args.organizationId,
        taskId: args.taskId,
        limit: args.limit,
        offset: args.offset,
    });
}

export async function getTaskUpdatesForProject(args: {
    organizationId: string;
    projectId: string;
    limit?: number;
    offset?: number;
}): Promise<TaskUpdateItem[]> {
    return getTaskUpdates({
        organizationId: args.organizationId,
        projectId: args.projectId,
        limit: args.limit,
        offset: args.offset,
    });
}

export async function getLatestTaskUpdate(args: {
    organizationId: string;
    taskId: string;
}): Promise<TaskUpdateItem | null> {
    if (!args.organizationId) {
        throw new Error("organizationId is required");
    }

    if (!args.taskId) {
        throw new Error("taskId is required");
    }

    const updates = await getTaskUpdates({
        organizationId: args.organizationId,
        taskId: args.taskId,
        limit: 1,
    });

    return updates[0] ?? null;
}
