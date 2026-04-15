import { supabase } from "../../../lib/supabase/client";
import type { TaskWatcherItem } from "../../../lib/supabase/queries/tasks";
import { notifyTaskCollaborators } from "./taskNotificationService";

const WATCHER_SELECT = `
  id,
  task_id,
  user_id,
  full_name,
  email,
  created_at
`;

async function getTaskTitle(taskId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, organization_id")
    .eq("id", taskId)
    .single();

  if (error) {
    throw new Error(`Failed to load task title: ${error.message}`);
  }

  return data as {
    id: string;
    title: string;
    organization_id: string;
  };
}

export async function getTaskWatchers(
  taskId: string,
): Promise<TaskWatcherItem[]> {
  if (!taskId) throw new Error("taskId is required");

  const { data, error } = await supabase
    .from("task_watchers")
    .select(WATCHER_SELECT)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load task watchers: ${error.message}`);
  }

  return (data ?? []) as TaskWatcherItem[];
}

export async function isTaskWatcher(
  taskId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("task_watchers")
    .select("id")
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check task watcher: ${error.message}`);
  }

  return Boolean(data);
}

export async function inviteTaskWatcher(params: {
  taskId: string;
  userId: string;
}): Promise<TaskWatcherItem> {
  const { taskId, userId } = params;

  if (!taskId) throw new Error("taskId is required");
  if (!userId) throw new Error("userId is required");

  const exists = await isTaskWatcher(taskId, userId);
  if (exists) {
    const watchers = await getTaskWatchers(taskId);
    const existing = watchers.find((item) => item.user_id === userId);
    if (!existing) {
      throw new Error("User is already invited to this task.");
    }
    return existing;
  }

  const { data, error } = await supabase
    .from("task_watchers")
    .insert({
      task_id: taskId,
      user_id: userId,
    })
    .select(WATCHER_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to invite watcher: ${error.message}`);
  }

  const task = await getTaskTitle(taskId);

  await notifyTaskCollaborators({
    organizationId: task.organization_id,
    userIds: [userId],
    taskId: task.id,
    taskTitle: task.title,
  });

  return data as TaskWatcherItem;
}

export async function inviteTaskWatchersBulk(params: {
  taskId: string;
  userIds: string[];
}) {
  const { taskId, userIds } = params;

  if (!taskId) throw new Error("taskId is required");
  if (!userIds.length) return [];

  const uniqueUserIds = [...new Set(userIds)].filter(Boolean);

  const task = await getTaskTitle(taskId);

  const rows = uniqueUserIds.map((userId) => ({
    task_id: taskId,
    user_id: userId,
  }));

  const { data, error } = await supabase
    .from("task_watchers")
    .upsert(rows, {
      onConflict: "task_id,user_id",
      ignoreDuplicates: true,
    })
    .select(WATCHER_SELECT);

  if (error) {
    throw new Error(`Failed to bulk invite watchers: ${error.message}`);
  }

  await notifyTaskCollaborators({
    organizationId: task.organization_id,
    userIds: uniqueUserIds,
    taskId: task.id,
    taskTitle: task.title,
  });

  return (data ?? []) as TaskWatcherItem[];
}

export async function removeTaskWatcher(params: {
  taskId: string;
  userId: string;
}): Promise<void> {
  const { taskId, userId } = params;

  if (!taskId) throw new Error("taskId is required");
  if (!userId) throw new Error("userId is required");

  const { error } = await supabase
    .from("task_watchers")
    .delete()
    .eq("task_id", taskId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to remove watcher: ${error.message}`);
  }
}