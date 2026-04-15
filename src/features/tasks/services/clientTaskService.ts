import { supabase } from "../../../lib/supabase/client";

export async function getClientTasks(clientId: string) {
  const { data, error } = await supabase
    .from("task_client_invites")
    .select(`
      task_id,
      tasks (
        id,
        title,
        status,
        priority,
        tracked_seconds_cache,
        due_date
      )
    `)
    .eq("client_id", clientId);

  if (error) throw error;

  return data?.map((item) => item.tasks) ?? [];
}