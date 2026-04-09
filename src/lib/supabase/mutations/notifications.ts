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

// --- Modular helpers for all-system notifications ---

// System notification (e.g. admin broadcast, system alert)
export async function notifySystemUsers(params: {
  organizationId: string;
  userIds: string[];
  title: string;
  message: string;
  priority?: "low" | "medium" | "high" | "urgent";
  metadata?: Record<string, unknown>;
}) {
  return createBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: "system",
    title: params.title,
    message: params.message,
    priority: params.priority,
    metadata: params.metadata,
  });
}

// Project notification (e.g. project created, updated, archived)
export async function notifyProjectEvent(params: {
  organizationId: string;
  userIds: string[];
  projectId: string;
  event: string;
  title: string;
  message: string;
  priority?: "low" | "medium" | "high" | "urgent";
  metadata?: Record<string, unknown>;
}) {
  return createBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: `project_${params.event}`,
    title: params.title,
    message: params.message,
    entityType: "project",
    entityId: params.projectId,
    priority: params.priority,
    metadata: params.metadata,
  });
}

// Task notification (e.g. assigned, updated, moved, commented)
export async function notifyTaskEvent(params: {
  organizationId: string;
  userIds: string[];
  taskId: string;
  event: string;
  title: string;
  message: string;
  priority?: "low" | "medium" | "high" | "urgent";
  metadata?: Record<string, unknown>;
}) {
  return createBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: `task_${params.event}`,
    title: params.title,
    message: params.message,
    entityType: "task",
    entityId: params.taskId,
    priority: params.priority,
    metadata: params.metadata,
  });
}

// Meeting notification (e.g. meeting scheduled, updated, cancelled)
export async function notifyMeetingEvent(params: {
  organizationId: string;
  userIds: string[];
  meetingId: string;
  event: string;
  title: string;
  message: string;
  priority?: "low" | "medium" | "high" | "urgent";
  metadata?: Record<string, unknown>;
}) {
  return createBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: `meeting_${params.event}`,
    title: params.title,
    message: params.message,
    entityType: "meeting",
    entityId: params.meetingId,
    priority: params.priority,
    metadata: params.metadata,
  });
}

// Chat notification (e.g. new message, mention)
export async function notifyChatEvent(params: {
  organizationId: string;
  userIds: string[];
  chatId: string;
  event: string;
  title: string;
  message: string;
  priority?: "low" | "medium" | "high" | "urgent";
  metadata?: Record<string, unknown>;
}) {
  return createBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: `chat_${params.event}`,
    title: params.title,
    message: params.message,
    entityType: "chat",
    entityId: params.chatId,
    priority: params.priority,
    metadata: params.metadata,
  });
}

// Approval notification (e.g. approval requested, approved, rejected)
export async function notifyApprovalEvent(params: {
  organizationId: string;
  userIds: string[];
  approvalId: string;
  event: string;
  title: string;
  message: string;
  priority?: "low" | "medium" | "high" | "urgent";
  metadata?: Record<string, unknown>;
}) {
  return createBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: `approval_${params.event}`,
    title: params.title,
    message: params.message,
    entityType: "approval",
    entityId: params.approvalId,
    priority: params.priority,
    metadata: params.metadata,
  });
}

// Custom notification for any entity/event
export async function notifyCustomEvent(params: {
  organizationId: string;
  userIds: string[];
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  metadata?: Record<string, unknown>;
  referenceId?: string;
  referenceType?: string;
}) {
  return createBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: params.type,
    title: params.title,
    message: params.message,
    entityType: params.entityType,
    entityId: params.entityId,
    actionUrl: params.actionUrl,
    priority: params.priority,
    metadata: params.metadata,
    referenceId: params.referenceId,
    referenceType: params.referenceType,
  });
}
