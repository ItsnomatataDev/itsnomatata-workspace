import {
  createBulkNotifications,
  createNotification,
  type NotificationPriority,
  type NotificationType,
} from "../../../lib/supabase/mutations/notifications";
import { supabase } from "../../../lib/supabase/client";
import { EmailPreferencesService } from "./emailPreferencesService";
import { EmailTemplateService, type EmailContext } from "./emailTemplates";

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

  // Use new email preferences service
  const canEmail = await EmailPreferencesService.shouldSendEmail(userId, type, 'medium');

  return { profile, canEmail };
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
  organizationId?: string;
  userId?: string;
  notificationId?: string;
}) {
  if (!EMAIL_WEBHOOK_URL) {
    console.warn("VITE_N8N_NOTIFICATION_WEBHOOK_URL is not set — skipping email");
    return;
  }

  try {
    const fullName = payload.fullName ?? "Team Member";
    const firstName = fullName.split(' ')[0];

    // Generate email template
    const context: EmailContext = {
      fullName,
      firstName,
      title: payload.title,
      message: payload.message ?? "",
      actionUrl: payload.actionUrl ?? "/",
      metadata: payload.metadata ?? {},
      appName: "Nomatata",
      appUrl: "https://itsnomatata.com"
    };

    const emailTemplate = EmailTemplateService.generateTemplate(payload.type, context);

    // Track email before sending
    let trackingId: string | null = null;
    if (payload.organizationId && payload.userId) {
      try {
        const tracking = await EmailPreferencesService.trackEmail({
          organizationId: payload.organizationId,
          userId: payload.userId,
          notificationId: payload.notificationId,
          emailTo: payload.to,
          emailSubject: emailTemplate.subject,
          emailType: payload.type,
          metadata: payload.metadata,
        });
        trackingId = tracking.id;
      } catch (trackingError) {
        console.error("EMAIL TRACKING ERROR:", trackingError);
        // Continue with email send even if tracking fails
      }
    }

    const response = await fetch(EMAIL_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(EMAIL_WEBHOOK_SECRET
          ? { "x-notification-secret": EMAIL_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify({
        to: payload.to,
        fullName,
        firstName,
        title: payload.title,
        message: payload.message ?? "",
        actionUrl: payload.actionUrl ?? "/",
        type: payload.type,
        priority: payload.priority,
        metadata: {
          ...payload.metadata,
          trackingId,
        },
        emailHtml: emailTemplate.html,
        subject: emailTemplate.subject,
      }),
    });

    if (!response.ok) {
      console.error("EMAIL WEBHOOK FAILED:", response.status, await response.text());
      
      // Update tracking status to failed
      if (trackingId) {
        await EmailPreferencesService.updateEmailStatus(trackingId, 'failed', `Webhook returned ${response.status}`);
      }
    } else {
      // Update tracking status to sent
      if (trackingId) {
        await EmailPreferencesService.updateEmailStatus(trackingId, 'sent');
      }
    }
  } catch (err) {
    console.error("EMAIL WEBHOOK ERROR:", err);
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
      organizationId: params.organizationId,
      userId: params.userId,
      notificationId: notification.id,
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
