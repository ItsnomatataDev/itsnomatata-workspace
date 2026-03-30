import { supabase } from "../client";

export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "review"
  | "approved"
  | "done"
  | "blocked"
  | "cancelled";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskItem {
  id: string;
  organization_id: string;
  client_id: string | null;
  campaign_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string | null;
  assigned_by: string | null;
  department: string | null;
  due_date: string | null;
  start_date: string | null;
  completed_at: string | null;
  ai_generated: boolean;
  blocked_reason: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export const getTasks = async ({
  assignedTo,
  organizationId,
}: {
  assignedTo?: string;
  organizationId?: string;
}) => {
  let query = supabase
    .from("tasks")
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });

  if (assignedTo) query = query.eq("assigned_to", assignedTo);
  if (organizationId) query = query.eq("organization_id", organizationId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TaskItem[];
};

export const getTaskById = async (taskId: string) => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (error) throw error;
  return data as TaskItem;
};
