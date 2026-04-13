import {
  createBulkNotifications,
  createNotification,
  type NotificationPriority,
  type NotificationType,
} from "../../../lib/supabase/mutations/notifications";
import { supabase } from "../../../lib/supabase/client";

export type DeliverNotificationParams = {
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
  sendEmail?: boolean;
};

export type DeliverBulkNotificationsParams = {
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
  sendEmail?: boolean;
};

const EMAIL_WEBHOOK_URL = import.meta.env.VITE_N8N_NOTIFICATION_WEBHOOK_URL;
const EMAIL_WEBHOOK_SECRET =
  import.meta.env.VITE_N8N_NOTIFICATION_WEBHOOK_SECRET;

function shouldEmailByDefault(
  type: NotificationType,
  priority: NotificationPriority,
) {
  if (priority === "urgent" || priority === "high") return true;

  return [
    "chat_message",
    "approval_needed",
    "approval_decision",
    "meeting",
    "leave_request_approved",
    "leave_request_rejected",
    "leave_request_submitted",
    "task_assigned",
    "automation",
    "system_alert",
  ].includes(type);
}

/**
 * Maps a notification type to the corresponding email preference column
 * in the notification_preferences table (column-per-type design).
 */
const EMAIL_PREF_COLUMN: Partial<Record<NotificationType, string>> = {
  task_assigned: "task_assigned_email",
  task_updated: "task_updated_email",
  task_comment: "task_comment_email",
  approval_needed: "approval_needed_email",
  approval_decision: "approval_decision_email",
  meeting: "meeting_email",
  meeting_reminder: "meeting_email",
  announcement: "announcement_email",
  leave_request_submitted: "leave_email",
  leave_request_approved: "leave_email",
  leave_request_rejected: "leave_email",
  leave_update: "leave_email",
  leave_reminder: "leave_email",
  system_alert: "system_alert_email",
  automation: "automation_email",
  chat_message: "chat_message_email",
};

async function getUserEmailPreferences(userId: string, type: NotificationType) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile?.email) return { profile: null, canEmail: false };

  const { data: prefRow, error: prefsError } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (prefsError) {
    console.warn(
      "NOTIFICATION PREFS QUERY ERROR (allowing email):",
      prefsError.message,
    );
    return { profile, canEmail: true };
  }

  // No preferences row → user hasn't opted out → allow email
  if (!prefRow) return { profile, canEmail: true };

  // Global email kill-switch
  if (prefRow.email_enabled === false) return { profile, canEmail: false };

  // Check type-specific column
  const column = EMAIL_PREF_COLUMN[type];
  if (column && column in prefRow && prefRow[column] === false) {
    return { profile, canEmail: false };
  }

  return { profile, canEmail: true };
}

async function triggerNotificationEmail(payload: {
  to: string;
  fullName?: string | null;
  title: string;
  message?: string | null;
  actionUrl?: string | null;
  type: NotificationType;
  priority: NotificationPriority;
  metadata?: Record<string, unknown>;
}) {
  if (!EMAIL_WEBHOOK_URL) return;

  const response = await fetch(EMAIL_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(EMAIL_WEBHOOK_SECRET
        ? { "x-notification-secret": EMAIL_WEBHOOK_SECRET }
        : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Notification email webhook failed with ${response.status}`,
    );
  }
}

export async function deliverNotification(params: DeliverNotificationParams) {
  const priority = params.priority ?? "medium";

  const notification = await createNotification({
    organizationId: params.organizationId,
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    entityType: params.entityType,
    entityId: params.entityId,
    actionUrl: params.actionUrl,
    priority,
    metadata: params.metadata,
    referenceId: params.referenceId,
    referenceType: params.referenceType,
  });
  console.log("NOTIFICATION INSERTED:", notification);
  const shouldEmail = params.sendEmail ??
    shouldEmailByDefault(params.type, priority);

  if (!shouldEmail) return notification;

  try {
    const { profile, canEmail } = await getUserEmailPreferences(
      params.userId,
      params.type,
    );

    if (!profile?.email || !canEmail) return notification;

    await triggerNotificationEmail({
      to: profile.email,
      fullName: profile.full_name,
      title: params.title,
      message: params.message,
      actionUrl: params.actionUrl,
      type: params.type,
      priority,
      metadata: params.metadata,
    });
  } catch (error) {
    console.error("NOTIFICATION EMAIL ERROR:", error);
  }

  return notification;
}

export async function deliverBulkNotifications(
  params: DeliverBulkNotificationsParams,
) {
  const uniqueUserIds = [...new Set(params.userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) return [];

  const priority = params.priority ?? "medium";

  const notifications = await createBulkNotifications({
    organizationId: params.organizationId,
    userIds: uniqueUserIds,
    type: params.type,
    title: params.title,
    message: params.message,
    entityType: params.entityType,
    entityId: params.entityId,
    actionUrl: params.actionUrl,
    priority,
    metadata: params.metadata,
    referenceId: params.referenceId,
    referenceType: params.referenceType,
  });

  const shouldEmail = params.sendEmail ??
    shouldEmailByDefault(params.type, priority);

  if (!shouldEmail) return notifications;

  await Promise.allSettled(
    uniqueUserIds.map(async (userId) => {
      try {
        const { profile, canEmail } = await getUserEmailPreferences(
          userId,
          params.type,
        );

        if (!profile?.email || !canEmail) return;

        await triggerNotificationEmail({
          to: profile.email,
          fullName: profile.full_name,
          title: params.title,
          message: params.message,
          actionUrl: params.actionUrl,
          type: params.type,
          priority,
          metadata: params.metadata,
        });
      } catch (error) {
        console.error(`BULK NOTIFICATION EMAIL ERROR for ${userId}:`, error);
      }
    }),
  );

  return notifications;
}
