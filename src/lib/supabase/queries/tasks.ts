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

export interface TaskBoardColumn {
  id: string;
  organization_id: string;
  project_id: string;
  name: string;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TaskBoard {
  id: string;
  organization_id: string;
  client_id: string | null;
  campaign_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskItem {
  id: string;
  organization_id: string;
  project_id: string | null;
  column_id: string | null;
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
  is_billable?: boolean;
  tracked_seconds_cache?: number | null;
  metadata?: Record<string, unknown> | null;
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

export interface TaskAssigneeItem {
  id: string;
  task_id: string;
  user_id: string;
  created_at: string;
  full_name?: string | null;
  email?: string | null;
  primary_role?: string | null;
  department?: string | null;
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

export interface TaskCommentCountItem {
  task_id: string;
  comment_count: number;
}

export interface TaskTrackedTimeItem {
  task_id: string;
  tracked_seconds: number;
}

export interface BoardTask extends TaskItem {
  assignees: TaskAssigneeItem[];
  watchers: TaskWatcherItem[];
  comments_count: number;
  watchers_count: number;
  has_running_timer: boolean;
  tracked_seconds: number;
}

export interface BoardColumnWithTasks extends TaskBoardColumn {
  tasks: BoardTask[];
}

export interface ProjectBoardData {
  board: TaskBoard | null;
  columns: BoardColumnWithTasks[];
  uncolumnedTasks: BoardTask[];
  summary: {
    total_columns: number;
    total_tasks: number;
    total_running_timers: number;
    total_tracked_seconds: number;
  };
}

/* ---------------------------------------
   TRACKED TIME
---------------------------------------- */

export const getTrackedTimeByTask = async (
  organizationId: string,
  projectId?: string,
): Promise<TaskTrackedTimeItem[]> => {
  if (!organizationId) throw new Error("organizationId is required");

  let query = supabase
    .from("time_entries")
    .select("task_id, duration_seconds")
    .eq("organization_id", organizationId)
    .not("task_id", "is", null);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error) throw error;

  const totals = new Map<string, number>();

  for (const row of data ?? []) {
    const taskId = row.task_id as string | null;
    if (!taskId) continue;

    const seconds = Number(row.duration_seconds ?? 0);
    totals.set(taskId, (totals.get(taskId) ?? 0) + seconds);
  }

  return Array.from(totals.entries()).map(([task_id, tracked_seconds]) => ({
    task_id,
    tracked_seconds,
  }));
};

/* ---------------------------------------
   BOARDS / COLUMNS
---------------------------------------- */

export const getBoards = async (
  organizationId: string,
  clientId?: string,
  campaignId?: string,
): Promise<TaskBoard[]> => {
  if (!organizationId) throw new Error("organizationId is required");

  let query = supabase
    .from("projects")
    .select(
      "id, organization_id, client_id, campaign_id, name, description, color, is_active, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (clientId) query = query.eq("client_id", clientId);
  if (campaignId) query = query.eq("campaign_id", campaignId);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []) as TaskBoard[];
};

export const getBoardById = async (
  organizationId: string,
  projectId: string,
): Promise<TaskBoard | null> => {
  if (!organizationId) throw new Error("organizationId is required");
  if (!projectId) throw new Error("projectId is required");

  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, organization_id, client_id, campaign_id, name, description, color, is_active, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as TaskBoard | null;
};

export const getBoardColumns = async (
  organizationId: string,
  projectId: string,
): Promise<TaskBoardColumn[]> => {
  if (!organizationId) throw new Error("organizationId is required");
  if (!projectId) throw new Error("projectId is required");

  const { data, error } = await supabase
    .from("task_board_columns")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (error) throw error;
  return (data ?? []) as TaskBoardColumn[];
};

/* ---------------------------------------
   TASKS
---------------------------------------- */

export const getTasks = async ({
  assignedTo,
  organizationId,
}: {
  assignedTo?: string;
  organizationId?: string;
}): Promise<TaskItem[]> => {
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

export const getTaskById = async (taskId: string): Promise<TaskItem> => {
  if (!taskId) throw new Error("taskId is required");

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (error) throw error;
  return data as TaskItem;
};

export const getProjectTasks = async (
  organizationId: string,
  projectId: string,
  columnId?: string,
): Promise<TaskItem[]> => {
  if (!organizationId) throw new Error("organizationId is required");
  if (!projectId) throw new Error("projectId is required");

  let query = supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (columnId) query = query.eq("column_id", columnId);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []) as TaskItem[];
};

export const getTasksForColumn = async (
  organizationId: string,
  columnId: string,
): Promise<TaskItem[]> => {
  if (!organizationId) throw new Error("organizationId is required");
  if (!columnId) throw new Error("columnId is required");

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("column_id", columnId)
    .order("position", { ascending: true });

  if (error) throw error;
  return (data ?? []) as TaskItem[];
};

/* ---------------------------------------
   COMMENTS
---------------------------------------- */

export const getTaskComments = async (
  taskId: string,
): Promise<TaskCommentItem[]> => {
  if (!taskId) throw new Error("taskId is required");

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

export const getTaskCommentCounts = async (
  organizationId: string,
  projectId: string,
): Promise<TaskCommentCountItem[]> => {
  const tasks = await getProjectTasks(organizationId, projectId);
  const taskIds = tasks.map((task) => task.id);

  if (taskIds.length === 0) return [];

  const { data, error } = await supabase
    .from("task_comments")
    .select("task_id")
    .in("task_id", taskIds);

  if (error) throw error;

  const countsMap = new Map<string, number>();

  for (const row of data ?? []) {
    countsMap.set(row.task_id, (countsMap.get(row.task_id) ?? 0) + 1);
  }

  return taskIds.map((taskId) => ({
    task_id: taskId,
    comment_count: countsMap.get(taskId) ?? 0,
  }));
};

/* ---------------------------------------
   WATCHERS
---------------------------------------- */

export const getTaskWatchers = async (
  taskId: string,
): Promise<TaskWatcherItem[]> => {
  if (!taskId) throw new Error("taskId is required");

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

export const getTaskWatcherCounts = async (
  organizationId: string,
  projectId?: string,
): Promise<TaskWatcherCountItem[]> => {
  let taskIds: string[] = [];

  if (projectId) {
    const tasks = await getProjectTasks(organizationId, projectId);
    taskIds = tasks.map((item) => item.id);
  } else {
    const { data: tasksData, error: tasksError } = await supabase
      .from("tasks")
      .select("id")
      .eq("organization_id", organizationId);

    if (tasksError) throw tasksError;
    taskIds = (tasksData ?? []).map((item) => item.id);
  }

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

  return taskIds.map((taskId) => ({
    task_id: taskId,
    invited_count: countsMap.get(taskId) ?? 0,
  }));
};

/* ---------------------------------------
   ASSIGNEES
---------------------------------------- */

export const getTaskAssignees = async (
  taskId: string,
): Promise<TaskAssigneeItem[]> => {
  if (!taskId) throw new Error("taskId is required");

  const { data, error } = await supabase
    .from("task_assignees")
    .select("id, task_id, user_id, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const assignees = (data ?? []) as TaskAssigneeItem[];
  const userIds = assignees.map((item) => item.user_id);

  if (userIds.length === 0) return assignees;

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email, primary_role, department")
    .in("id", userIds);

  if (profilesError) throw profilesError;

  const profileMap = new Map(
    (profilesData ?? []).map((profile) => [profile.id, profile]),
  );

  return assignees.map((assignee) => {
    const profile = profileMap.get(assignee.user_id);

    return {
      ...assignee,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      primary_role: profile?.primary_role ?? null,
      department: profile?.department ?? null,
    };
  });
};

/* ---------------------------------------
   TIMER / RUNTIME
---------------------------------------- */

export const getTaskRuntimeInfo = async (
  organizationId: string,
  projectId?: string,
): Promise<TaskRuntimeInfo[]> => {
  if (!organizationId) throw new Error("organizationId is required");

  let query = supabase
    .from("time_entries")
    .select("task_id")
    .eq("organization_id", organizationId)
    .eq("is_running", true)
    .is("ended_at", null)
    .not("task_id", "is", null);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const taskIds = [
    ...new Set((data ?? []).map((row) => row.task_id).filter(Boolean)),
  ] as string[];

  return taskIds.map((taskId) => ({
    task_id: taskId,
    has_running_timer: true,
  }));
};

/* ---------------------------------------
   PEOPLE SEARCH
---------------------------------------- */

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

  if (!organizationId) throw new Error("organizationId is required");
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

/* ---------------------------------------
   BOARD-READY AGGREGATION
---------------------------------------- */

export const getProjectBoardData = async (
  organizationId: string,
  projectId: string,
): Promise<ProjectBoardData> => {
  if (!organizationId) throw new Error("organizationId is required");
  if (!projectId) throw new Error("projectId is required");

  const [
    board,
    columns,
    tasks,
    runtimeInfo,
    watcherCounts,
    commentCounts,
    trackedTime,
  ] = await Promise.all([
    getBoardById(organizationId, projectId),
    getBoardColumns(organizationId, projectId),
    getProjectTasks(organizationId, projectId),
    getTaskRuntimeInfo(organizationId, projectId),
    getTaskWatcherCounts(organizationId, projectId),
    getTaskCommentCounts(organizationId, projectId),
    getTrackedTimeByTask(organizationId, projectId),
  ]);

  const runtimeMap = new Map(
    runtimeInfo.map((item) => [item.task_id, item.has_running_timer]),
  );
  const watcherCountMap = new Map(
    watcherCounts.map((item) => [item.task_id, item.invited_count]),
  );
  const commentCountMap = new Map(
    commentCounts.map((item) => [item.task_id, item.comment_count]),
  );
  const trackedTimeMap = new Map(
    trackedTime.map((item) => [item.task_id, item.tracked_seconds]),
  );

  const taskIds = tasks.map((task) => task.id);

  const [allAssignees, allWatchers] = await Promise.all([
    getBulkTaskAssignees(taskIds),
    getBulkTaskWatchers(taskIds),
  ]);

  const assigneesMap = new Map<string, TaskAssigneeItem[]>();
  for (const item of allAssignees) {
    const list = assigneesMap.get(item.task_id) ?? [];
    list.push(item);
    assigneesMap.set(item.task_id, list);
  }

  const watchersMap = new Map<string, TaskWatcherItem[]>();
  for (const item of allWatchers) {
    const list = watchersMap.get(item.task_id) ?? [];
    list.push(item);
    watchersMap.set(item.task_id, list);
  }

  const boardTasks: BoardTask[] = tasks.map((task) => ({
    ...task,
    assignees: assigneesMap.get(task.id) ?? [],
    watchers: watchersMap.get(task.id) ?? [],
    comments_count: commentCountMap.get(task.id) ?? 0,
    watchers_count: watcherCountMap.get(task.id) ?? 0,
    has_running_timer: runtimeMap.get(task.id) ?? false,
    tracked_seconds:
      trackedTimeMap.get(task.id) ?? Number(task.tracked_seconds_cache ?? 0),
  }));

  const columnsWithTasks: BoardColumnWithTasks[] = columns.map((column) => ({
    ...column,
    tasks: boardTasks
      .filter((task) => task.column_id === column.id)
      .sort((a, b) => a.position - b.position),
  }));

  const uncolumnedTasks = boardTasks
    .filter((task) => !task.column_id)
    .sort((a, b) => a.position - b.position);

  return {
    board,
    columns: columnsWithTasks,
    uncolumnedTasks,
    summary: {
      total_columns: columnsWithTasks.length,
      total_tasks: boardTasks.length,
      total_running_timers: boardTasks.filter((task) => task.has_running_timer)
        .length,
      total_tracked_seconds: boardTasks.reduce(
        (sum, task) => sum + (task.tracked_seconds ?? 0),
        0,
      ),
    },
  };
};

/* ---------------------------------------
   INTERNAL BULK HELPERS
---------------------------------------- */

async function getBulkTaskWatchers(
  taskIds: string[],
): Promise<TaskWatcherItem[]> {
  if (taskIds.length === 0) return [];

  const { data, error } = await supabase
    .from("task_watchers")
    .select("id, task_id, user_id, created_at")
    .in("task_id", taskIds)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const watchers = (data ?? []) as TaskWatcherItem[];
  const userIds = [...new Set(watchers.map((item) => item.user_id))];

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
}

async function getBulkTaskAssignees(
  taskIds: string[],
): Promise<TaskAssigneeItem[]> {
  if (taskIds.length === 0) return [];

  const { data, error } = await supabase
    .from("task_assignees")
    .select("id, task_id, user_id, created_at")
    .in("task_id", taskIds)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const assignees = (data ?? []) as TaskAssigneeItem[];
  const userIds = [...new Set(assignees.map((item) => item.user_id))];

  if (userIds.length === 0) return assignees;

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email, primary_role, department")
    .in("id", userIds);

  if (profilesError) throw profilesError;

  const profileMap = new Map(
    (profilesData ?? []).map((profile) => [profile.id, profile]),
  );

  return assignees.map((assignee) => {
    const profile = profileMap.get(assignee.user_id);

    return {
      ...assignee,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      primary_role: profile?.primary_role ?? null,
      department: profile?.department ?? null,
    };
  });
}