import { supabase } from "../../../lib/supabase/client";
import type {
  TaskAssigneeItem,
  TaskInvitableUser,
  TaskItem,
  TaskStatus,
  TaskWatcherItem,
} from "../../../lib/supabase/queries/tasks";
import type { TaskChecklistWithItems } from "../../../lib/supabase/queries/taskChecklists";
import type { TaskSubmissionItem } from "../../../lib/supabase/queries/taskSubmissions";

export type TrelloTaskItem = TaskItem & {
  tracked_seconds_cache?: number | null;
  is_billable?: boolean;
  assignees?: TaskAssigneeItem[];
  comments_count?: number;
  invited_count?: number;
};

export interface GetBoardTasksParams {
  organizationId: string;
  projectId?: string | null;
  clientId?: string | null;
  campaignId?: string | null;
  status?: TaskStatus | "all";
  search?: string;
  includeArchived?: boolean;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskItem["priority"];
  due_date?: string | null;
  department?: string | null;
  assigned_to?: string | null;
  client_id?: string | null;
  campaign_id?: string | null;
  project_id?: string | null;
  is_billable?: boolean;
  completed_at?: string | null;
  tracked_seconds_cache?: number | null;
}

export interface CreateTaskInput {
  organization_id: string;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskItem["priority"];
  due_date?: string | null;
  department?: string | null;
  project_id?: string | null;
  client_id?: string | null;
  campaign_id?: string | null;
  assigned_to?: string | null;
  created_by?: string | null;
  is_billable?: boolean;
}

const TASK_SELECT = `
  *,
  tracked_seconds_cache,
  is_billable
`;

const TASK_ASSIGNEES_SELECT = `
  id,
  task_id,
  user_id,
  full_name,
  email,
  avatar_url
`;

const TASK_WATCHERS_SELECT = `
  id,
  task_id,
  user_id,
  full_name,
  email
`;

function normalizeTaskStatus(value: string): TaskStatus {
  return value as TaskStatus;
}

async function getTaskAssigneesMap(taskIds: string[]) {
  if (taskIds.length === 0) return new Map<string, TaskAssigneeItem[]>();

  const { data, error } = await supabase
    .from("task_assignees")
    .select(TASK_ASSIGNEES_SELECT)
    .in("task_id", taskIds);

  if (error) {
    throw new Error(`Failed to load task assignees: ${error.message}`);
  }

  const map = new Map<string, TaskAssigneeItem[]>();

  for (const item of (data ?? []) as unknown as TaskAssigneeItem[]) {
    const current = map.get(item.task_id) ?? [];
    current.push(item);
    map.set(item.task_id, current);
  }

  return map;
}

async function getTaskCommentsCountMap(taskIds: string[]) {
  if (taskIds.length === 0) return new Map<string, number>();

  const { data, error } = await supabase
    .from("task_comments")
    .select("task_id")
    .in("task_id", taskIds);

  if (error) {
    throw new Error(`Failed to load task comment counts: ${error.message}`);
  }

  const counts = new Map<string, number>();

  for (const row of data ?? []) {
    const taskId = String(row.task_id);
    counts.set(taskId, (counts.get(taskId) ?? 0) + 1);
  }

  return counts;
}

async function getTaskWatcherCountMap(taskIds: string[]) {
  if (taskIds.length === 0) return new Map<string, number>();

  const { data, error } = await supabase
    .from("task_watchers")
    .select("task_id")
    .in("task_id", taskIds);

  if (error) {
    throw new Error(`Failed to load task watcher counts: ${error.message}`);
  }

  const counts = new Map<string, number>();

  for (const row of data ?? []) {
    const taskId = String(row.task_id);
    counts.set(taskId, (counts.get(taskId) ?? 0) + 1);
  }

  return counts;
}

export async function getBoardTasks(
  params: GetBoardTasksParams,
): Promise<TrelloTaskItem[]> {
  const {
    organizationId,
    projectId,
    clientId,
    campaignId,
    status,
    search,
    includeArchived = false,
  } = params;

  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  let query = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("organization_id", organizationId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });

  if (projectId) query = query.eq("project_id", projectId);
  if (clientId) query = query.eq("client_id", clientId);
  if (campaignId) query = query.eq("campaign_id", campaignId);
  if (status && status !== "all") query = query.eq("status", status);
  if (search?.trim()) query = query.ilike("title", `%${search.trim()}%`);

  if (!includeArchived) {
    query = query.neq("status", "archived");
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load board tasks: ${error.message}`);
  }

  const tasks = (data ?? []) as TrelloTaskItem[];
  const taskIds = tasks.map((task) => task.id);

  const [assigneesMap, commentsCountMap, watcherCountMap] = await Promise.all([
    getTaskAssigneesMap(taskIds),
    getTaskCommentsCountMap(taskIds),
    getTaskWatcherCountMap(taskIds),
  ]);
  
  return tasks.map((task) => ({
    ...task,
    status: normalizeTaskStatus(task.status),
    assignees: assigneesMap.get(task.id) ?? [],
    comments_count: commentsCountMap.get(task.id) ?? 0,
    invited_count: watcherCountMap.get(task.id) ?? 0,
  }));
}

export async function getTaskById(
  organizationId: string,
  taskId: string,
): Promise<TrelloTaskItem | null> {
  if (!organizationId) throw new Error("organizationId is required");
  if (!taskId) throw new Error("taskId is required");

  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("organization_id", organizationId)
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load task: ${error.message}`);
  }

  if (!data) return null;

  const [assigneesMap, commentsCountMap, watcherCountMap] = await Promise.all([
    getTaskAssigneesMap([taskId]),
    getTaskCommentsCountMap([taskId]),
    getTaskWatcherCountMap([taskId]),
  ]);

  const task = data as TrelloTaskItem;

  return {
    ...task,
    status: normalizeTaskStatus(task.status),
    assignees: assigneesMap.get(task.id) ?? [],
    comments_count: commentsCountMap.get(task.id) ?? 0,
    invited_count: watcherCountMap.get(task.id) ?? 0,
  };
}

export async function createTask(
  payload: CreateTaskInput,
): Promise<TrelloTaskItem> {
  if (!payload.organization_id) {
    throw new Error("organization_id is required");
  }
  if (!payload.title?.trim()) {
    throw new Error("Task title is required");
  }

const insertPayload = {
  organization_id: payload.organization_id,
  title: payload.title.trim(),
  description: payload.description ?? null,
  status: payload.status ?? "todo",
  priority: payload.priority ?? "medium",
  due_date: payload.due_date ?? null,
  department: payload.department ?? null,
  project_id: payload.project_id ?? null,
  client_id: payload.client_id ?? null,
  campaign_id: payload.campaign_id ?? null,
  assigned_to: payload.assigned_to ?? null,
  created_by: payload.created_by ?? null,
  position: 0,
  metadata: {},
  tracked_seconds_cache: 0,
  ai_generated: false,
  is_billable: false,
};

  const { data, error } = await supabase
    .from("tasks")
    .insert(insertPayload)
    .select(TASK_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to create task: ${error.message}`);
  }

  return data as TrelloTaskItem;
}

export async function updateTask(
  taskId: string,
  payload: UpdateTaskInput,
): Promise<TrelloTaskItem> {
  if (!taskId) throw new Error("taskId is required");

  const { data, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", taskId)
    .select(TASK_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to update task: ${error.message}`);
  }

  return data as TrelloTaskItem;
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<TrelloTaskItem> {
  return updateTask(taskId, {
    status,
    completed_at: status === "done" ? new Date().toISOString() : null,
  });
}

export async function updateTaskDeadline(
  taskId: string,
  dueDate: string | null,
): Promise<TrelloTaskItem> {
  return updateTask(taskId, {
    due_date: dueDate,
  });
}

export async function toggleTaskDone(
  taskId: string,
  checked: boolean,
): Promise<TrelloTaskItem> {
  return updateTask(taskId, {
    status: checked ? "done" : "todo",
    completed_at: checked ? new Date().toISOString() : null,
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  if (!taskId) throw new Error("taskId is required");

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);

  if (error) {
    throw new Error(`Failed to delete task: ${error.message}`);
  }
}

export async function getTaskWatchers(
  taskId: string,
): Promise<TaskWatcherItem[]> {
  if (!taskId) throw new Error("taskId is required");

  const { data, error } = await supabase
    .from("task_watchers")
    .select(TASK_WATCHERS_SELECT)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load task watchers: ${error.message}`);
  }

  return (data ?? []) as TaskWatcherItem[];
}

export async function getTaskComments(taskId: string) {
  if (!taskId) throw new Error("taskId is required");

  const { data, error } = await supabase
    .from("task_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load task comments: ${error.message}`);
  }

  return data ?? [];
}

export async function getTaskChecklists(
  taskId: string,
): Promise<TaskChecklistWithItems[]> {
  if (!taskId) throw new Error("taskId is required");

  const { data: checklists, error: checklistError } = await supabase
    .from("task_checklists")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (checklistError) {
    throw new Error(
      `Failed to load task checklists: ${checklistError.message}`,
    );
  }

  const checklistIds = (checklists ?? []).map((item) => item.id);

  if (checklistIds.length === 0) {
    return [];
  }

  const { data: items, error: itemError } = await supabase
    .from("task_checklist_items")
    .select("*")
    .in("checklist_id", checklistIds)
    .order("created_at", { ascending: true });

  if (itemError) {
    throw new Error(
      `Failed to load task checklist items: ${itemError.message}`,
    );
  }

  const itemsByChecklist = new Map<string, any[]>();

  for (const item of items ?? []) {
    const current = itemsByChecklist.get(item.checklist_id) ?? [];
    current.push(item);
    itemsByChecklist.set(item.checklist_id, current);
  }

  return (checklists ?? []).map((checklist) => ({
    ...checklist,
    items: itemsByChecklist.get(checklist.id) ?? [],
  })) as TaskChecklistWithItems[];
}

export async function getTaskSubmissions(
  taskId: string,
): Promise<TaskSubmissionItem[]> {
  if (!taskId) throw new Error("taskId is required");

  const { data, error } = await supabase
    .from("task_submissions")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load task submissions: ${error.message}`);
  }

  return (data ?? []) as TaskSubmissionItem[];
}

export async function searchInvitableUsers(params: {
  organizationId: string;
  search: string;
  limit?: number;
  excludeUserIds?: string[];
}): Promise<TaskInvitableUser[]> {
  const { organizationId, search, limit = 10, excludeUserIds = [] } = params;

  if (!organizationId) throw new Error("organizationId is required");

  const trimmed = search.trim();
  if (!trimmed) return [];

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, primary_role")
    .eq("organization_id", organizationId)
    .or(`full_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
    .limit(limit);

  if (excludeUserIds.length > 0) {
    query = query.not("id", "in", `(${excludeUserIds.join(",")})`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to search users: ${error.message}`);
  }

  return (data ?? []) as TaskInvitableUser[];
}