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
  organizationId?: string;
  entityType?: string;
  entityId?: string;
  type?: string;
  unreadOnly?: boolean;
  limit?: number;
}) {
  const {
    userId,
    organizationId,
    entityType,
    entityId,
    type,
    unreadOnly = false,
    limit = 25,
  } = params;

  let query = supabase
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

  if (organizationId) query = query.eq("organization_id", organizationId);
  if (entityType) query = query.eq("entity_type", entityType);
  if (entityId) query = query.eq("entity_id", entityId);
  if (type) query = query.eq("type", type);
  if (unreadOnly) query = query.eq("is_read", false);

  const { data, error } = await query;
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

export async function getOrganizationNotifications(params: {
  organizationId: string;
  type?: string;
  entityType?: string;
  entityId?: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}) {
  const {
    organizationId,
    type,
    entityType,
    entityId,
    unreadOnly = false,
    limit = 50,
    offset = 0,
  } = params;

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) query = query.eq("type", type);
  if (entityType) query = query.eq("entity_type", entityType);
  if (entityId) query = query.eq("entity_id", entityId);
  if (unreadOnly) query = query.eq("is_read", false);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}


export async function getNotificationSummaryForUser(userId: string) {
  if (!userId) throw new Error("userId is required");
  const { data, error } = await supabase
    .from("notifications")
    .select("type")
    .eq("user_id", userId);
  if (error) throw error;
  const summary: Record<string, number> = {};
  for (const row of data ?? []) {
    summary[row.type] = (summary[row.type] ?? 0) + 1;
  }
  return Object.entries(summary).map(([type, count]) => ({ type, count }));
}
