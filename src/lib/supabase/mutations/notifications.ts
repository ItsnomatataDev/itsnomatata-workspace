import { supabase } from "../client";
import type { NotificationRow } from "../queries/notifications";

export async function markNotificationAsRead(notificationId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
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
    .single();

  if (error) throw error;
  return data as NotificationRow;
}

export async function markAllNotificationsAsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) throw error;
  return true;
}

export async function createNotification(params: {
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  message?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  priority?: "low" | "medium" | "high" | "urgent";
  metadata?: Record<string, unknown>;
  referenceId?: string | null;
  referenceType?: string | null;
}) {
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message ?? null,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      action_url: params.actionUrl ?? null,
      priority: params.priority ?? "medium",
      metadata: params.metadata ?? {},
      reference_id: params.referenceId ?? null,
      reference_type: params.referenceType ?? null,
      is_read: false,
    })
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
    .single();

  if (error) throw error;
  return data as NotificationRow;
}

export async function createBulkNotifications(params: {
  organizationId: string;
  userIds: string[];
  type: string;
  title: string;
  message?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  priority?: "low" | "medium" | "high" | "urgent";
  metadata?: Record<string, unknown>;
  referenceId?: string | null;
  referenceType?: string | null;
}) {
  const uniqueUserIds = [...new Set(params.userIds)].filter(Boolean);

  if (uniqueUserIds.length === 0) return [];

  const payload = uniqueUserIds.map((userId) => ({
    organization_id: params.organizationId,
    user_id: userId,
    type: params.type,
    title: params.title,
    message: params.message ?? null,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    action_url: params.actionUrl ?? null,
    priority: params.priority ?? "medium",
    metadata: params.metadata ?? {},
    reference_id: params.referenceId ?? null,
    reference_type: params.referenceType ?? null,
    is_read: false,
  }));

  const { data, error } = await supabase
    .from("notifications")
    .insert(payload)
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
    );

  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}