import { supabase } from "../client";
import type { TaskWatcherItem } from "../queries/tasks";

export type AddTaskWatcherInput = {
  task_id: string;
  user_id: string;
};

export type RemoveTaskWatcherInput = {
  task_id: string;
  user_id: string;
};

export async function addTaskWatcher(
  input: AddTaskWatcherInput,
): Promise<TaskWatcherItem | null> {
  const { data, error } = await supabase
    .from("task_watchers")
    .upsert(
      {
        task_id: input.task_id,
        user_id: input.user_id,
      },
      {
        onConflict: "task_id,user_id",
        ignoreDuplicates: false,
      },
    )
    .select("id, task_id, user_id, created_at")
    .single();

  if (error) throw error;
  return (data ?? null) as TaskWatcherItem | null;
}

export async function removeTaskWatcher(input: RemoveTaskWatcherInput) {
  const { error } = await supabase
    .from("task_watchers")
    .delete()
    .eq("task_id", input.task_id)
    .eq("user_id", input.user_id);

  if (error) throw error;
  return true;
}