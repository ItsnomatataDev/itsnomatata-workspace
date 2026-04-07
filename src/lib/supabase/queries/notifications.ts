import { supabase } from "../client";

export type NotificationRow = {
  id: string;
  organization_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  priority: string;
  metadata: Record<string, unknown>;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
};

export async function getUserNotifications(params: {
  userId: string;
  limit?: number;
}) {
  const { userId, limit = 25 } = params;

  const { data, error } = await supabase
    .from("notifications")
    .select(
      `
      id,
      organization_id,
      user_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      action_url,
      is_read,
      read_at,
      priority,
      metadata,
      reference_id,
      reference_type,
      created_at
      `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function getUnreadNotificationCount(userId: string) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) throw error;
  return count ?? 0;
}