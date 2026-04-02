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
  project_id: string | null;
  client_id: string | null;
  campaign_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string | null;
  assigned_by: string | null;
  created_by: string | null;
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

export interface TaskCommentItem {
  id: string;
  task_id: string;
  organization_id: string;
  user_id: string | null;
  comment: string;
  is_internal: boolean;
  created_at: string;
  updated_at?: string;
  author_name?: string | null;
  author_email?: string | null;
}

export interface TaskWatcherItem {
  id: string;
  task_id: string;
  user_id: string;
  created_at: string;
  full_name?: string | null;
  email?: string | null;
}

export interface TaskRuntimeInfo {
  task_id: string;
  has_running_timer: boolean;
}

export interface TaskInvitableUser {
  id: string;
  full_name: string | null;
  email: string | null;
  primary_role: string | null;
  department: string | null;
}

export interface TaskWatcherCountItem {
  task_id: string;
  invited_count: number;
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

export const getTaskComments = async (
  taskId: string,
): Promise<TaskCommentItem[]> => {
  const { data, error } = await supabase
    .from("task_comments")
    .select(
      "id, task_id, organization_id, user_id, comment, is_internal, created_at, updated_at",
    )
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const comments = (data ?? []) as TaskCommentItem[];
  const userIds = [
    ...new Set(comments.map((item) => item.user_id).filter(Boolean)),
  ] as string[];

  if (userIds.length === 0) return comments;

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);

  if (profilesError) throw profilesError;

  const profileMap = new Map(
    (profilesData ?? []).map((profile) => [profile.id, profile]),
  );

  return comments.map((comment) => {
    const author = comment.user_id ? profileMap.get(comment.user_id) : null;

    return {
      ...comment,
      author_name: author?.full_name ?? null,
      author_email: author?.email ?? null,
    };
  });
};

export const getTaskWatchers = async (
  taskId: string,
): Promise<TaskWatcherItem[]> => {
  const { data, error } = await supabase
    .from("task_watchers")
    .select("id, task_id, user_id, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const watchers = (data ?? []) as TaskWatcherItem[];
  const userIds = watchers.map((item) => item.user_id);

  if (userIds.length === 0) return watchers;

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);

  if (profilesError) throw profilesError;

  const profileMap = new Map(
    (profilesData ?? []).map((profile) => [profile.id, profile]),
  );

  return watchers.map((watcher) => {
    const profile = profileMap.get(watcher.user_id);

    return {
      ...watcher,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
    };
  });
};

export const getTaskRuntimeInfo = async (
  organizationId: string,
): Promise<TaskRuntimeInfo[]> => {
  const { data, error } = await supabase
    .from("time_entries")
    .select("task_id")
    .eq("organization_id", organizationId)
    .is("ended_at", null)
    .not("task_id", "is", null);

  if (error) throw error;

  const taskIds = [
    ...new Set((data ?? []).map((row) => row.task_id).filter(Boolean)),
  ] as string[];

  return taskIds.map((taskId) => ({
    task_id: taskId,
    has_running_timer: true,
  }));
};

export const searchTaskInvitableUsers = async ({
  organizationId,
  search,
  excludeUserIds = [],
}: {
  organizationId: string;
  search: string;
  excludeUserIds?: string[];
}): Promise<TaskInvitableUser[]> => {
  const trimmed = search.trim();

  if (!trimmed) return [];

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, primary_role, department")
    .eq("organization_id", organizationId)
    .or(`full_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
    .order("full_name", { ascending: true })
    .limit(10);

  if (excludeUserIds.length > 0) {
    query = query.not("id", "in", `(${excludeUserIds.join(",")})`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as TaskInvitableUser[];
};

export const getTaskWatcherCounts = async (
  organizationId: string,
): Promise<TaskWatcherCountItem[]> => {
  const { data: tasksData, error: tasksError } = await supabase
    .from("tasks")
    .select("id")
    .eq("organization_id", organizationId);

  if (tasksError) throw tasksError;

  const taskIds = (tasksData ?? []).map((item) => item.id);

  if (taskIds.length === 0) return [];

  const { data, error } = await supabase
    .from("task_watchers")
    .select("task_id")
    .in("task_id", taskIds);

  if (error) throw error;

  const countsMap = new Map<string, number>();

  for (const row of data ?? []) {
    countsMap.set(row.task_id, (countsMap.get(row.task_id) ?? 0) + 1);
  }

  return Array.from(countsMap.entries()).map(([task_id, invited_count]) => ({
    task_id,
    invited_count,
  }));
};
