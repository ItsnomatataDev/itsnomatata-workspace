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
  actor_user_id?: string | null;
  category?: string | null;
  dedupe_key?: string | null;
  delivery_state?: "pending" | "processing" | "delivered" | "partial" | "failed";
  seen_at?: string | null;
  expires_at?: string | null;
  data?: Record<string, unknown>;
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
      actor_user_id,
      category,
      dedupe_key,
      delivery_state,
      seen_at,
      expires_at,
      data,
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

export type NotificationDeliveryLogRow = {
  id: string;
  notification_id: string;
  notification_title: string;
  notification_user_id: string;
  user_full_name: string | null;
  user_email: string | null;
  channel: "in_app" | "email" | "push";
  destination: string | null;
  status: string;
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  attempted_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

type DeliveryLogResult = {
  id: string;
  notification_id: string;
  channel: "in_app" | "email" | "push";
  destination: string | null;
  status: string;
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  attempted_at: string | null;
  delivered_at: string | null;
  created_at: string;
  notifications:
    | {
        title: string;
        user_id: string;
        profiles:
          | { full_name: string | null; email: string | null }
          | Array<{ full_name: string | null; email: string | null }>
          | null;
      }
    | Array<{
        title: string;
        user_id: string;
        profiles:
          | { full_name: string | null; email: string | null }
          | Array<{ full_name: string | null; email: string | null }>
          | null;
      }>
    | null;
};

export async function getNotificationDeliveryLogs(params: {
  organizationId: string;
  limit?: number;
}) {
  const { data, error } = await supabase
    .from("notification_deliveries")
    .select(
      `
      id,
      notification_id,
      channel,
      destination,
      status,
      provider,
      provider_message_id,
      error_message,
      attempted_at,
      delivered_at,
      created_at,
      notifications!inner(
        title,
        user_id,
        organization_id,
        profiles:user_id(full_name,email)
      )
      `,
    )
    .eq("notifications.organization_id", params.organizationId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 100);

  if (error) throw error;

  return ((data ?? []) as unknown as DeliveryLogResult[]).map((row) => {
    const notification = Array.isArray(row.notifications)
      ? row.notifications[0]
      : row.notifications;
    const profile = Array.isArray(notification?.profiles)
      ? notification.profiles[0]
      : notification?.profiles;

    return {
    id: row.id,
    notification_id: row.notification_id,
    notification_title: notification?.title ?? "",
    notification_user_id: notification?.user_id ?? "",
    user_full_name: profile?.full_name ?? null,
    user_email: profile?.email ?? null,
    channel: row.channel,
    destination: row.destination,
    status: row.status,
    provider: row.provider,
    provider_message_id: row.provider_message_id,
    error_message: row.error_message,
    attempted_at: row.attempted_at,
    delivered_at: row.delivered_at,
    created_at: row.created_at,
    };
  });
}
