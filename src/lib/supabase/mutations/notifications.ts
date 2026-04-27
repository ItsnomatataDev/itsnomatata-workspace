import { supabase } from "../client";
import type { NotificationRow } from "../queries/notifications";

export type NotificationPriority = "low" | "medium" | "high" | "urgent";

export type NotificationType =
  | "general"
  | "system_alert"
  | "stock_alert"
  | "vehicle_alert"
  | "automation"
  | "meeting"
  | "meeting_reminder"
  | "chat_message"
  | "announcement"
  | "leave_update"
  | "leave_request_submitted"
  | "leave_request_approved"
  | "leave_request_rejected"
  | "leave_reminder"
  | "approval_needed"
  | "approval_decision"
  | "project_update"
  | "task_assigned"
  | "task_updated"
  | "task_comment"
  | "task_completed"
  | "duty_roster_assigned"
  | "duty_roster_updated"
  | "shift_reminder"
  | "user_signup"
  | "user_invite"
  | "campaign_update"
  | "campaign_assigned"
  | "timesheet_reminder"
  | "invoice_update"
  | "budget_alert"
  | "expense_submitted"
  | "expense_approved"
  | "expense_rejected"
  | "task_collaboration_invite";

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
  type: NotificationType;
  title: string;
  message?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  priority?: NotificationPriority;
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
  type: NotificationType;
  title: string;
  message?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  priority?: NotificationPriority;
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

/**
 * System notification
 */
export async function notifySystemUsers(params: {
  organizationId: string;
  userIds: string[];
  title: string;
  message: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
  referenceId?: string;
  referenceType?: string;
}) {
  return createBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: "system_alert",
    title: params.title,
    message: params.message,
    actionUrl: params.actionUrl,
    priority: params.priority,
    metadata: params.metadata,
    referenceId: params.referenceId,
    referenceType: params.referenceType,
  });
}

/**
 * Project events
 * We use project_update because it is enum-safe.
 */
export async function notifyProjectEvent(params: {
  organizationId: string;
  userIds: string[];
  projectId: string;
  event?: string;
  title: string;
  message: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
}) {
  return createBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: "project_update",
    title: params.title,
    message: params.message,
    entityType: "project",
    entityId: params.projectId,
    actionUrl: params.actionUrl,
    priority: params.priority,
    metadata: {
      ...(params.metadata ?? {}),
      event: params.event ?? "updated",
    },
    referenceId: params.projectId,
    referenceType: "project",
  });
}

/**
 * Task events
 * Supported enum-safe task notification types:
 * - task_assigned
 * - task_updated
 * - task_comment
 */
export async function notifyTaskEvent(params: {
  organizationId: string;
  userIds: string[];
  taskId: string;
  event: "assigned" | "updated" | "comment";
  title: string;
  message: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
}) {
  const typeMap: Record<"assigned" | "updated" | "comment", NotificationType> =
    {
      assigned: "task_assigned",
      updated: "task_updated",
      comment: "task_comment",
    };

  return createBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: typeMap[params.event],
    title: params.title,
    message: params.message,
    entityType: "task",
    entityId: params.taskId,
    actionUrl: params.actionUrl,
    priority: params.priority,
    metadata: {
      ...(params.metadata ?? {}),
      event: params.event,
    },
    referenceId: params.taskId,
    referenceType: "task",
  });
}

/**
 * Meeting events
 * We use meeting because it is enum-safe.
 */
export async function notifyMeetingEvent(params: {
  organizationId: string;
  userIds: string[];
  meetingId: string;
  event?: string;
  title: string;
  message: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
}) {
  return createBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: "meeting",
    title: params.title,
    message: params.message,
    entityType: "meeting",
    entityId: params.meetingId,
    actionUrl: params.actionUrl,
    priority: params.priority,
    metadata: {
      ...(params.metadata ?? {}),
      event: params.event ?? "updated",
    },
    referenceId: params.meetingId,
    referenceType: "meeting",
  });
}

/**
 * Chat events
 * We use chat_message because it is enum-safe.
 */
export async function notifyChatEvent(params: {
  organizationId: string;
  userIds: string[];
  chatId: string;
  event?: string;
  title: string;
  message: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
}) {
  return createBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: "chat_message",
    title: params.title,
    message: params.message,
    entityType: "chat",
    entityId: params.chatId,
    actionUrl: params.actionUrl,
    priority: params.priority,
    metadata: {
      ...(params.metadata ?? {}),
      event: params.event ?? "message",
    },
    referenceId: params.chatId,
    referenceType: "chat",
  });
}

/**
 * Approval events
 * Supported enum-safe approval notification types:
 * - approval_needed
 * - approval_decision
 */
export async function notifyApprovalEvent(params: {
  organizationId: string;
  userIds: string[];
  approvalId: string;
  event: "needed" | "decision";
  title: string;
  message: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
}) {
  const typeMap: Record<"needed" | "decision", NotificationType> = {
    needed: "approval_needed",
    decision: "approval_decision",
  };

  return createBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: typeMap[params.event],
    title: params.title,
    message: params.message,
    entityType: "approval",
    entityId: params.approvalId,
    actionUrl: params.actionUrl,
    priority: params.priority,
    metadata: {
      ...(params.metadata ?? {}),
      event: params.event,
    },
    referenceId: params.approvalId,
    referenceType: "approval",
  });
}

/**
 * Leave events
 */
export async function notifyLeaveEvent(params: {
  organizationId: string;
  userIds: string[];
  leaveRequestId: string;
  event: "submitted" | "approved" | "rejected" | "updated";
  title: string;
  message: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
}) {
  const typeMap: Record<
    "submitted" | "approved" | "rejected" | "updated",
    NotificationType
  > = {
    submitted: "leave_request_submitted",
    approved: "leave_request_approved",
    rejected: "leave_request_rejected",
    updated: "leave_update",
  };

  return createBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: typeMap[params.event],
    title: params.title,
    message: params.message,
    entityType: "leave_request",
    entityId: params.leaveRequestId,
    actionUrl: params.actionUrl,
    priority: params.priority,
    metadata: {
      ...(params.metadata ?? {}),
      event: params.event,
    },
    referenceId: params.leaveRequestId,
    referenceType: "leave_request",
  });
}

/**
 * Stock / vehicle alerts
 */
export async function notifyStockAlert(params: {
  organizationId: string;
  userIds: string[];
  title: string;
  message: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
  referenceId?: string;
  referenceType?: string;
}) {
  return createBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: "stock_alert",
    title: params.title,
    message: params.message,
    actionUrl: params.actionUrl,
    priority: params.priority,
    metadata: params.metadata,
    referenceId: params.referenceId,
    referenceType: params.referenceType,
  });
}

export async function notifyVehicleAlert(params: {
  organizationId: string;
  userIds: string[];
  title: string;
  message: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
  referenceId?: string;
  referenceType?: string;
}) {
  return createBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: "vehicle_alert",
    title: params.title,
    message: params.message,
    actionUrl: params.actionUrl,
    priority: params.priority,
    metadata: params.metadata,
    referenceId: params.referenceId,
    referenceType: params.referenceType,
  });
}

/**
 * Custom notification
 * Keep this restricted to enum-safe types only.
 */
export async function notifyCustomEvent(params: {
  organizationId: string;
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  priority?: NotificationPriority;
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
