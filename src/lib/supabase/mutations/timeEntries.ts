import { supabase } from "../client";

export const startTimeEntry = async ({
  organizationId,
  userId,
  taskId,
  description,
}: {
  organizationId: string;
  userId: string;
  taskId?: string | null;
  description?: string;
}) => {
  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      organization_id: organizationId,
      user_id: userId,
      task_id: taskId ?? null,
      description: description ?? null,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
};

export const stopTimeEntry = async (entryId: string) => {
  const { data, error } = await supabase
    .from("time_entries")
    .update({
      ended_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
};
