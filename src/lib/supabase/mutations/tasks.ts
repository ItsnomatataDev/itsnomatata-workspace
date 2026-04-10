import { supabase } from "../client";
import type { TaskStatus } from "../queries/tasks";
import { getTrackedTimeByTask } from "../queries/tasks";

export interface CreateTaskCommentPayload {
  organizationId: string;
  taskId: string;
  userId: string;
  comment: string;
  isInternal?: boolean;
}

export interface AddTaskWatcherPayload {
  organizationId: string;
  taskId: string;
  userId: string;
}

export async function createTaskComment(
  payload: CreateTaskCommentPayload,
): Promise<
  {
    id: string;
    task_id: string;
    organization_id: string;
    user_id: string;
    comment: string;
    is_internal: boolean;
    created_at: string;
    updated_at: string;
  }
> {
  const { organizationId, taskId, userId, comment, isInternal = false } =
    payload;
  if (!organizationId) throw new Error("organizationId is required");
  if (!taskId) throw new Error("taskId is required");
  if (!userId) throw new Error("userId is required");
  if (!comment) throw new Error("comment is required");

  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      organization_id: organizationId,
      task_id: taskId,
      user_id: userId,
      comment,
      is_internal: isInternal,
    })
    .select(
      "id, task_id, organization_id, user_id, comment, is_internal, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return data;
}

export async function addTaskWatcher(
  payload: AddTaskWatcherPayload,
): Promise<
  { id: string; task_id: string; user_id: string; created_at: string }
> {
  const { organizationId, taskId, userId } = payload;

  if (!organizationId) throw new Error("organizationId is required");
  if (!taskId) throw new Error("taskId is required");
  if (!userId) throw new Error("userId is required");

  // prevent duplicate invites
  const { data: existing, error: existingError } = await supabase
    .from("task_watchers")
    .select("id, task_id, user_id, created_at")
    .eq("organization_id", organizationId)
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from("task_watchers")
    .insert({
      organization_id: organizationId,
      task_id: taskId,
      user_id: userId,
    })
    .select("id, task_id, user_id, created_at")
    .single();

  if (error) {
    if (
      typeof error.message === "string" &&
      error.message.toLowerCase().includes("row-level security")
    ) {
      throw new Error(
        "You do not have permission to invite users to this card. Check task_watchers RLS policies.",
      );
    }

    throw error;
  }

  return data;
}

export async function createCardInviteNotification(params: {
  organizationId: string;
  userId: string;
  taskId: string;
  invitedBy: string;
  taskTitle: string;
}) {
  const { organizationId, userId, taskId, invitedBy, taskTitle } = params;

  const { error } = await supabase.from("notifications").insert({
    organization_id: organizationId,
    user_id: userId,
    type: "task_assigned",
    title: "You were invited to a card",
    message: `You were invited to collaborate on "${taskTitle}".`,
    data: {
      task_id: taskId,
      invited_by: invitedBy,
      task_title: taskTitle,
    },
    is_read: false,
  });

  if (error) throw error;
}


export async function removeTaskWatcher(params: {
  taskId: string;
  userId: string;
}) {
  const { error } = await supabase
    .from("task_watchers")
    .delete()
    .eq("task_id", params.taskId)
    .eq("user_id", params.userId);

  if (error) {
    throw error;
  }
}

export interface CreateTaskPayload {
  organizationId?: string;
  organization_id?: string;
  projectId?: string | null;
  project_id?: string | null;
  columnId?: string | null;
  column_id?: string | null;
  name?: string;
  title?: string;
  description?: string | null;
  assigneeIds?: string[];
  assigned_to?: string | null;
  assigned_by?: string | null;
  created_by?: string | null;
  order?: number;
  position?: number;
  clientId?: string | null;
  client_id?: string | null;
  campaignId?: string | null;
  campaign_id?: string | null;
  isBillable?: boolean;
  is_billable?: boolean;
  dueDate?: string | null;
  due_date?: string | null;
  priority?: string | null;
  status?: TaskStatus;
  department?: string | null;
  completed_at?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateTaskPayload {
  taskId: string;
  organizationId?: string;
  organization_id?: string;
  name?: string;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  columnId?: string | null;
  column_id?: string | null;
  order?: number;
  position?: number;
  assigneeIds?: string[];
  assigned_to?: string | null;
  assigned_by?: string | null;
  clientId?: string | null;
  client_id?: string | null;
  campaignId?: string | null;
  campaign_id?: string | null;
  isBillable?: boolean;
  is_billable?: boolean;
  dueDate?: string | null;
  due_date?: string | null;
  priority?: string | null;
  department?: string | null;
  completed_at?: string | null;
  metadata?: Record<string, unknown>;
}

export type UpdateTaskPatch = Omit<UpdateTaskPayload, "taskId">;

export interface MoveTaskPayload {
  taskId: string;
  organizationId: string;
  toColumnId: string;
  toOrder?: number;
  toPosition?: number;
  fromColumnId: string;
  fromOrder?: number;
  fromPosition?: number;
}

export interface TaskRow {
  id: string;
  organization_id: string;
  project_id: string | null;
  column_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus | string;
  priority: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  created_by: string | null;
  department: string | null;
  position: number;
  is_billable?: boolean;
  due_date: string | null;
  completed_at: string | null;
  client_id: string | null;
  campaign_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function buildTaskMutationPayload(
  payload: Partial<CreateTaskPayload & UpdateTaskPayload>,
): Record<string, unknown> {
  const mutationPayload: Record<string, unknown> = {};
  const rawTitle = payload.title ?? payload.name;

  if (rawTitle !== undefined) {
    const trimmedTitle = rawTitle.trim();

    if (!trimmedTitle) {
      throw new Error("Task title is required");
    }

    mutationPayload.title = trimmedTitle;
  }

  if (payload.description !== undefined) {
    mutationPayload.description = payload.description;
  }

  if (payload.status !== undefined) {
    mutationPayload.status = payload.status;
  }

  const columnId = payload.columnId ?? payload.column_id;
  if (columnId !== undefined) {
    mutationPayload.column_id = columnId;
  }

  const position = payload.position ?? payload.order;
  if (position !== undefined) {
    mutationPayload.position = position;
  }

  const projectId = payload.projectId ?? payload.project_id;
  if (projectId !== undefined) {
    mutationPayload.project_id = projectId;
  }

  const clientId = payload.clientId ?? payload.client_id;
  if (clientId !== undefined) {
    mutationPayload.client_id = clientId;
  }

  const campaignId = payload.campaignId ?? payload.campaign_id;
  if (campaignId !== undefined) {
    mutationPayload.campaign_id = campaignId;
  }

  const dueDate = payload.dueDate ?? payload.due_date;
  if (dueDate !== undefined) {
    mutationPayload.due_date = dueDate;
  }

  const isBillable = payload.isBillable ?? payload.is_billable;
  if (isBillable !== undefined) {
    mutationPayload.is_billable = isBillable;
  }

  if (payload.assigned_to !== undefined) {
    mutationPayload.assigned_to = payload.assigned_to;
  }

  if (payload.assigned_by !== undefined) {
    mutationPayload.assigned_by = payload.assigned_by;
  }

  if (payload.created_by !== undefined) {
    mutationPayload.created_by = payload.created_by;
  }

  if (payload.priority !== undefined) {
    mutationPayload.priority = payload.priority;
  }

  if (payload.department !== undefined) {
    mutationPayload.department = payload.department;
  }

  if (payload.completed_at !== undefined) {
    mutationPayload.completed_at = payload.completed_at;
  }

  if (payload.metadata !== undefined) {
    mutationPayload.metadata = payload.metadata;
  }

  return mutationPayload;
}

export async function createTask(payload: CreateTaskPayload): Promise<TaskRow> {
  const organizationId = payload.organizationId ?? payload.organization_id;
  const assigneeIds = payload.assigneeIds ?? [];
  const insertPayload: Record<string, unknown> = {
    organization_id: organizationId,
    status: payload.status ?? "todo",
    priority: payload.priority ?? "medium",
    position: payload.position ?? payload.order ?? 0,
    is_billable: payload.isBillable ?? payload.is_billable ?? false,
    metadata: payload.metadata ?? {},
    ...buildTaskMutationPayload(payload),
  };

  if (!organizationId) throw new Error("organizationId is required");
  if (!insertPayload.title) throw new Error("Task title is required");

  const { data, error } = await supabase
    .from("tasks")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) throw error;

  if (assigneeIds.length > 0) {
    await supabase.from("task_assignees").insert(
      assigneeIds.map((userId) => ({
        organization_id: organizationId,
        task_id: data.id,
        user_id: userId,
      })),
    );
  }

  return data as TaskRow;
}

export async function updateTask(payload: UpdateTaskPayload): Promise<TaskRow>;
export async function updateTask(
  taskId: string,
  fields: UpdateTaskPatch,
): Promise<TaskRow>;
export async function updateTask(
  taskOrPayload: string | UpdateTaskPayload,
  maybeFields?: UpdateTaskPatch,
): Promise<TaskRow> {
  const taskId = typeof taskOrPayload === "string"
    ? taskOrPayload
    : taskOrPayload.taskId;
  const fields = typeof taskOrPayload === "string"
    ? (maybeFields ?? {})
    : taskOrPayload;
  const organizationId = fields.organizationId ?? fields.organization_id;
  const updatePayload = {
    ...buildTaskMutationPayload(fields),
    updated_at: new Date().toISOString(),
  };

  if (!taskId) throw new Error("taskId is required");
  if (Object.keys(updatePayload).length === 1) {
    throw new Error("At least one task field is required");
  }

  let query = supabase.from("tasks").update(updatePayload).eq("id", taskId);

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query.select("*").single();

  if (error) throw error;

  if (fields.assigneeIds) {
    const assigneeOrganizationId = organizationId ?? data.organization_id;

    await supabase
      .from("task_assignees")
      .delete()
      .eq("task_id", taskId)
      .eq("organization_id", assigneeOrganizationId);

    if (fields.assigneeIds.length > 0) {
      await supabase.from("task_assignees").insert(
        fields.assigneeIds.map((userId) => ({
          organization_id: assigneeOrganizationId,
          task_id: taskId,
          user_id: userId,
        })),
      );
    }
  }

  return data as TaskRow;
}

/**
 * Move a task to a new column and/or order.
 * Handles reordering of other tasks in both columns.
 */
export async function moveTask(payload: MoveTaskPayload): Promise<TaskRow> {
  const {
    taskId,
    organizationId,
    toColumnId,
    fromColumnId,
  } = payload;
  const toPosition = payload.toPosition ?? payload.toOrder;
  const fromPosition = payload.fromPosition ?? payload.fromOrder;

  if (!taskId) throw new Error("taskId is required");
  if (!organizationId) throw new Error("organizationId is required");
  if (!toColumnId) throw new Error("toColumnId is required");
  if (toPosition === undefined) throw new Error("toPosition is required");
  if (fromPosition === undefined) throw new Error("fromPosition is required");

  await supabase.rpc("shift_task_orders", {
    org_id: organizationId,
    column_id: toColumnId,
    from_order: toPosition,
    delta: 1,
  });

  const { data, error } = await supabase
    .from("tasks")
    .update({
      column_id: toColumnId,
      position: toPosition,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error) throw error;

  if (fromColumnId === toColumnId) {
    if (fromPosition < toPosition) {
      await supabase.rpc("shift_task_orders", {
        org_id: organizationId,
        column_id: toColumnId,
        from_order: fromPosition + 1,
        to_order: toPosition,
        delta: -1,
      });
    } else if (fromPosition > toPosition) {
      await supabase.rpc("shift_task_orders", {
        org_id: organizationId,
        column_id: toColumnId,
        from_order: toPosition,
        to_order: fromPosition - 1,
        delta: 1,
      });
    }
  } else {
    await supabase.rpc("shift_task_orders", {
      org_id: organizationId,
      column_id: fromColumnId,
      from_order: fromPosition + 1,
      delta: -1,
    });
  }

  return data as TaskRow;
}

export type CreateTaskInput = {
  organization_id: string;
  title: string;
  description?: string | null;
  assigned_to?: string | null;
  created_by?: string | null;
  due_date?: string | null;
  priority?: string | null;
  status?: string | null;
  completed_at?: string | null;
};

export async function createTaskSimple(input: CreateTaskInput) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...input,
      status: input.status ?? "todo",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
