import { supabase } from "../client";
import type { NotificationRow } from "../queries/notifications";

export type NotificationPriority = "low" | "medium" | "high" | "urgent";
export type NotificationChannel = "in_app" | "email" | "push";
type NotificationDeliveryState = "pending" | "processing" | "delivered" | "partial" | "failed";

export type NotificationType =
  | "welcome_user"
  | "invited_to_workspace"
  | "general"
  | "system_alert"
  | "stock_alert"
  | "vehicle_alert"
  | "automation"
  | "meeting"
  | "meeting_reminder"
  | "chat_message"
  | "chat_message_received"
  | "announcement"
  | "leave_update"
  | "leave_request_submitted"
  | "leave_request_approved"
  | "leave_request_rejected"
  | "leave_reminder"
  | "approval_needed"
  | "approval_decision"
  | "project_update"
  | "project_deadline_reminder"
  | "task_assigned"
  | "task_updated"
  | "task_status_changed"
  | "task_comment"
  | "task_comment_added"
  | "task_mention"
  | "task_due_soon"
  | "task_completed"
  | "duty_roster_assigned"
  | "duty_roster_updated"
  | "shift_reminder"
  | "user_signup"
  | "user_invite"
  | "campaign_update"
  | "campaign_assigned"
  | "timesheet_reminder"
  | "weekly_time_summary"
  | "monthly_time_summary"
  | "time_tracking_not_started"
  | "time_tracking_timer_left_running"
  | "invoice_update"
  | "invoice_or_payment_notice"
  | "budget_alert"
  | "expense_submitted"
  | "expense_approved"
  | "expense_rejected"
  | "task_collaboration_invite"
  | "workspace_admin_notice";

const NOTIFICATION_SELECT = `
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
      `;

const SYSTEM_NOTIFICATION_CHANNELS: NotificationChannel[] = ["in_app", "email", "push"];

function shouldDispatchPush(deliveryState?: string | null) {
  return !deliveryState || deliveryState === "pending";
}

function dispatchBrowserPush(notificationIds: string[]) {
  for (const notificationId of notificationIds.filter(Boolean)) {
    void supabase.functions
      .invoke("send-push-notification", {
        body: { notificationId },
      })
      .then(({ error }) => {
        if (error) {
          console.warn("Browser push dispatch failed.", error);
        }
      });
  }
}

function shouldDispatchEmail(params: {
  channels?: NotificationChannel[];
  sendEmail?: boolean;
}) {
  return params.sendEmail !== false && params.channels?.includes("email");
}

async function dispatchBrowserEmail(notifications: NotificationRow[]) {
  const rows = notifications.filter((row) => row.id && row.user_id);
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  if (userIds.length === 0) return;

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);

  if (error) {
    console.warn("Notification email dispatch skipped: profile lookup failed.", error);
    return;
  }

  const profilesById = new Map(
    (profiles ?? []).map((profile) => [profile.id as string, profile]),
  );

  await Promise.allSettled(
    rows.map(async (notification) => {
      const profile = profilesById.get(notification.user_id);
      const to = typeof profile?.email === "string" ? profile.email.trim() : "";
      if (!to) return;

      const { error: emailError } = await supabase.functions.invoke(
        "send-direct-email",
        {
          body: {
            to,
            fullName: profile?.full_name ?? null,
            title: notification.title,
            message: notification.message ?? notification.title,
            type: notification.type,
            priority: notification.priority ?? "medium",
            actionUrl: notification.action_url ?? "/notifications",
            metadata:
              notification.metadata && typeof notification.metadata === "object"
                ? notification.metadata
                : {},
          },
        },
      );

      if (emailError) {
        console.warn("Notification email dispatch failed.", {
          notificationId: notification.id,
          userId: notification.user_id,
          error: emailError.message,
        });
      }
    }),
  );
}

function queueBrowserEmailDispatch(notifications: NotificationRow[]) {
  void dispatchBrowserEmail(notifications).catch((error) => {
    console.warn("Notification email dispatch failed.", error);
  });
}

export async function markNotificationAsRead(notificationId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .select(NOTIFICATION_SELECT)
    .single();

  if (error) throw error;
  return data as NotificationRow;
}

export async function markAllNotificationsAsRead(
  userId: string,
  organizationId?: string | null,
) {
  let query = supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (organizationId) query = query.eq("organization_id", organizationId);

  const { error } = await query;

  if (error) throw error;
  return true;
}

export async function markChatConversationNotificationsAsRead(params: {
  userId: string;
  conversationId: string;
  organizationId?: string | null;
}) {
  let query = supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId)
    .eq("is_read", false)
    .in("type", ["chat_message", "chat_message_received"])
    .or(
      `entity_id.eq.${params.conversationId},reference_id.eq.${params.conversationId}`,
    );

  if (params.organizationId) {
    query = query.eq("organization_id", params.organizationId);
  }

  const { error } = await query;
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
  actorUserId?: string | null;
  category?: string | null;
  dedupeKey?: string | null;
  deliveryState?: NotificationDeliveryState;
  channels?: NotificationChannel[];
  sendEmail?: boolean;
}) {
  const payload = {
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
    actor_user_id: params.actorUserId ?? null,
    category: params.category ?? null,
    dedupe_key: params.dedupeKey ?? null,
    delivery_state: params.deliveryState ?? "pending",
    is_read: false,
  };

  const { data, error } = await supabase
    .from("notifications")
    .insert(payload)
    .select(NOTIFICATION_SELECT)
    .single();

  if (error) {
    if (params.dedupeKey && error.code === "23505") {
      const { data: existing, error: existingError } = await supabase
        .from("notifications")
        .select(NOTIFICATION_SELECT)
        .eq("user_id", params.userId)
        .eq("dedupe_key", params.dedupeKey)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) return existing as NotificationRow;
    }

    throw error;
  }

  if (shouldDispatchPush(params.deliveryState)) {
    dispatchBrowserPush([data.id]);
  }
  if (shouldDispatchEmail(params)) {
    queueBrowserEmailDispatch([data as NotificationRow]);
  }

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
  actorUserId?: string | null;
  category?: string | null;
  dedupeKey?: string | null;
  deliveryState?: NotificationDeliveryState;
  channels?: NotificationChannel[];
  sendEmail?: boolean;
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
    actor_user_id: params.actorUserId ?? null,
    category: params.category ?? null,
    dedupe_key: params.dedupeKey ? `${params.dedupeKey}:${userId}` : null,
    delivery_state: params.deliveryState ?? "pending",
    is_read: false,
  }));

  const { data, error } = await supabase
    .from("notifications")
    .insert(payload)
    .select(NOTIFICATION_SELECT);

  if (error) throw error;
  if (shouldDispatchPush(params.deliveryState)) {
    dispatchBrowserPush((data ?? []).map((row) => row.id));
  }
  if (shouldDispatchEmail(params)) {
    queueBrowserEmailDispatch((data ?? []) as NotificationRow[]);
  }
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
    channels: SYSTEM_NOTIFICATION_CHANNELS,
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
    channels: SYSTEM_NOTIFICATION_CHANNELS,
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
    channels: SYSTEM_NOTIFICATION_CHANNELS,
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
    channels: SYSTEM_NOTIFICATION_CHANNELS,
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
    channels: SYSTEM_NOTIFICATION_CHANNELS,
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
    channels: SYSTEM_NOTIFICATION_CHANNELS,
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
    channels: SYSTEM_NOTIFICATION_CHANNELS,
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
    channels: SYSTEM_NOTIFICATION_CHANNELS,
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
    channels: SYSTEM_NOTIFICATION_CHANNELS,
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
    channels: SYSTEM_NOTIFICATION_CHANNELS,
  });
}
