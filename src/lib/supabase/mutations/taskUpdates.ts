import { supabase } from "../client";
import type { TaskStatus } from "../queries/tasks";

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

export interface TaskUpdateRow {
    id: string;
    organization_id: string;
    task_id: string;
    project_id: string | null;
    user_id: string | null;
    update_type: TaskUpdateType | string;
    message: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

export interface CreateTaskUpdatePayload {
    organizationId: string;
    taskId: string;
    userId?: string | null;
    projectId?: string | null;
    type?: TaskUpdateType | string;
    message: string;
    metadata?: Record<string, unknown>;
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

async function resolveTaskProjectId(taskId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from("tasks")
        .select("project_id")
        .eq("id", taskId)
        .single();

    if (error) {
        throw error;
    }

    return data?.project_id ?? null;
}

export async function createTaskUpdate(
    payload: CreateTaskUpdatePayload,
): Promise<TaskUpdateRow> {
    const message = payload.message.trim();

    if (!payload.organizationId) {
        throw new Error("organizationId is required");
    }

    if (!payload.taskId) {
        throw new Error("taskId is required");
    }

    if (!message) {
        throw new Error("message is required");
    }

    const projectId = payload.projectId ??
        (await resolveTaskProjectId(payload.taskId));

    const { data, error } = await supabase
        .from("task_updates")
        .insert({
            organization_id: payload.organizationId,
            task_id: payload.taskId,
            project_id: projectId,
            user_id: payload.userId ?? null,
            update_type: payload.type ?? "manual",
            message,
            metadata: payload.metadata ?? {},
        })
        .select(TASK_UPDATE_SELECT)
        .single();

    if (error) {
        throw error;
    }

    return data as TaskUpdateRow;
}

export async function logTaskStatusChange(args: {
    organizationId: string;
    taskId: string;
    userId?: string | null;
    projectId?: string | null;
    previousStatus?: TaskStatus | string | null;
    nextStatus: TaskStatus | string;
}): Promise<TaskUpdateRow> {
    return createTaskUpdate({
        organizationId: args.organizationId,
        taskId: args.taskId,
        userId: args.userId,
        projectId: args.projectId,
        type: "status_changed",
        message: `Task moved to ${args.nextStatus}`,
        metadata: {
            previous_status: args.previousStatus ?? null,
            next_status: args.nextStatus,
        },
    });
}

export async function logTaskMoved(args: {
    organizationId: string;
    taskId: string;
    userId?: string | null;
    projectId?: string | null;
    fromColumnId?: string | null;
    toColumnId: string;
    fromPosition?: number | null;
    toPosition?: number | null;
}): Promise<TaskUpdateRow> {
    return createTaskUpdate({
        organizationId: args.organizationId,
        taskId: args.taskId,
        userId: args.userId,
        projectId: args.projectId,
        type: "moved",
        message: "Task position updated",
        metadata: {
            from_column_id: args.fromColumnId ?? null,
            to_column_id: args.toColumnId,
            from_position: args.fromPosition ?? null,
            to_position: args.toPosition ?? null,
        },
    });
}

export async function logTaskTimeTracked(args: {
    organizationId: string;
    taskId: string;
    userId?: string | null;
    projectId?: string | null;
    timeEntryId: string;
    durationSeconds: number;
    isBillable?: boolean;
}): Promise<TaskUpdateRow> {
    return createTaskUpdate({
        organizationId: args.organizationId,
        taskId: args.taskId,
        userId: args.userId,
        projectId: args.projectId,
        type: "time_tracked",
        message: "Time tracked against task",
        metadata: {
            time_entry_id: args.timeEntryId,
            duration_seconds: args.durationSeconds,
            is_billable: args.isBillable ?? false,
        },
    });
}

export async function deleteTaskUpdate(args: {
    organizationId: string;
    taskUpdateId: string;
}): Promise<void> {
    if (!args.organizationId) {
        throw new Error("organizationId is required");
    }

    if (!args.taskUpdateId) {
        throw new Error("taskUpdateId is required");
    }

    const { error } = await supabase
        .from("task_updates")
        .delete()
        .eq("id", args.taskUpdateId)
        .eq("organization_id", args.organizationId);

    if (error) {
        throw error;
    }
}
