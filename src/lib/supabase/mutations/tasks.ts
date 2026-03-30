import { supabase } from "../client";
import type {
  TaskItem,
  TaskPriority,
  TaskStatus,
} from "../queries/tasks";

export interface CreateTaskInput {
  organization_id: string;
  client_id?: string | null;
  campaign_id?: string | null;
  parent_task_id?: string | null;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to?: string | null;
  assigned_by?: string | null;
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

export const createTask = async (payload: CreateTaskInput) => {
  const insertPayload = {
    organization_id: payload.organization_id,
    client_id: payload.client_id ?? null,
    campaign_id: payload.campaign_id ?? null,
    parent_task_id: payload.parent_task_id ?? null,
    title: payload.title,
    description: payload.description ?? null,
    status: payload.status ?? "todo",
    priority: payload.priority ?? "medium",
    assigned_to: payload.assigned_to ?? null,
    assigned_by: payload.assigned_by ?? null,
    department: payload.department ?? null,
    due_date: payload.due_date ?? null,
    start_date: payload.start_date ?? null,
    blocked_reason: payload.blocked_reason ?? null,
    position: payload.position ?? 0,
  };

  console.log("CREATE TASK PAYLOAD:", insertPayload);

  const { data, error } = await supabase
    .from("tasks")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) {
    console.error("CREATE TASK ERROR:", error);
    throw new Error(error.message);
  }

  return data as TaskItem;
};

export const updateTask = async (taskId: string, payload: UpdateTaskInput) => {
  const { data, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", taskId)
    .select("*")
    .single();

  if (error) {
    console.error("UPDATE TASK ERROR:", error);
    throw new Error(error.message);
  }

  return data as TaskItem;
};

export const deleteTask = async (taskId: string) => {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);

  if (error) {
    console.error("DELETE TASK ERROR:", error);
    throw new Error(error.message);
  }
};
