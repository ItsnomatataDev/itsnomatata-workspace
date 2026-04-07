import { supabase } from "../client";
import type {
  TaskItem,
  TaskPriority,
  TaskStatus,
  TaskCommentItem,
  TaskWatcherItem,
} from "../queries/tasks";

export interface CreateTaskInput {
  organization_id: string;
  project_id?: string | null;
  client_id?: string | null;
  campaign_id?: string | null;
  parent_task_id?: string | null;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to?: string | null;
  assigned_by?: string | null;
  created_by?: string | null;
  department?: string | null;
  due_date?: string | null;
  start_date?: string | null;
  blocked_reason?: string | null;
  position?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to?: string | null;
  department?: string | null;
  due_date?: string | null;
  start_date?: string | null;
  blocked_reason?: string | null;
  position?: number;
  completed_at?: string | null;
}

export interface CreateTaskCommentInput {
  task_id: string;
  organization_id: string;
  user_id: string;
  comment: string;
  is_internal?: boolean;
}

export const createTask = async (payload: CreateTaskInput) => {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      organization_id: payload.organization_id,
      project_id: payload.project_id ?? null,
      client_id: payload.client_id ?? null,
      campaign_id: payload.campaign_id ?? null,
      parent_task_id: payload.parent_task_id ?? null,
      title: payload.title,
      description: payload.description ?? null,
      status: payload.status ?? "todo",
      priority: payload.priority ?? "medium",
      assigned_to: payload.assigned_to ?? null,
      assigned_by: payload.assigned_by ?? null,
      created_by: payload.created_by ?? null,
      department: payload.department ?? null,
      due_date: payload.due_date ?? null,
      start_date: payload.start_date ?? null,
      blocked_reason: payload.blocked_reason ?? null,
      position: payload.position ?? 0,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as TaskItem;
};
export const updateTask = async (taskId: string, payload: UpdateTaskInput) => {
  const { error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", taskId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
};

export const deleteTask = async (taskId: string) => {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);
};

export const createTaskComment = async (
  payload: CreateTaskCommentInput,
): Promise<TaskCommentItem> => {
  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      task_id: payload.task_id,
      organization_id: payload.organization_id,
      user_id: payload.user_id,
      comment: payload.comment,
      is_internal: payload.is_internal ?? true,
    })
    .select(
      "id, task_id, organization_id, user_id, comment, is_internal, created_at, updated_at",
    )
    .single();

  if (error) throw new Error(error.message);
  return data as TaskCommentItem;
};

export const addTaskWatcher = async ({
  taskId,
  userId,
}: {
  taskId: string;
  userId: string;
}): Promise<TaskWatcherItem> => {
  const { data, error } = await supabase
    .from("task_watchers")
    .insert({
      task_id: taskId,
      user_id: userId,
    })
    .select("id, task_id, user_id, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as TaskWatcherItem;
};

export const removeTaskWatcher = async ({
  taskId,
  userId,
}: {
  taskId: string;
  userId: string;
}) => {
  const { error } = await supabase
    .from("task_watchers")
    .delete()
    .eq("task_id", taskId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
};
