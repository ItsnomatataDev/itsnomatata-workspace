import {
  getUnreadNotificationCount,
  getUserNotifications,
  type NotificationRow,
} from "../../../lib/supabase/queries/notifications";
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationPriority,
  type NotificationType,
} from "../../../lib/supabase/mutations/notifications";
import {
  deliverBulkNotifications,
  deliverNotification,
} from "./notificationDeliveryService";
import { EmailTemplateService, type EmailContext } from "./emailTemplates";

export type NotificationItem = NotificationRow;

/* ------------------------------------------------------------------
   READ / FETCH
------------------------------------------------------------------ */

export async function fetchNotifications(userId: string, limit = 25) {
  return getUserNotifications({ userId, limit });
}

export async function fetchUnreadNotificationCount(userId: string) {
  return getUnreadNotificationCount(userId);
}

export async function readNotification(notificationId: string) {
  return markNotificationAsRead(notificationId);
}

export async function readAllNotifications(userId: string) {
  return markAllNotificationsAsRead(userId);
}

/* ------------------------------------------------------------------
   SEND — IN-SYSTEM + EMAIL (single user)
------------------------------------------------------------------ */

export async function sendNotification(params: {
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
}) {
  return deliverNotification({
    ...params,
    // Default email to true for high/urgent — delivery service
    // will check user preferences before actually sending
    sendEmail: params.sendEmail ?? true,
  });
}

/* ------------------------------------------------------------------
   SEND — IN-SYSTEM + EMAIL (multiple users)
------------------------------------------------------------------ */

export async function sendBulkNotifications(params: {
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
}) {
  return deliverBulkNotifications({
    ...params,
    sendEmail: params.sendEmail ?? true,
  });
}

/* ------------------------------------------------------------------
   SEND EMAIL ONLY — no in-system notification
   Use this for events that come from Supabase DB webhooks or
   external triggers where the notification row already exists
------------------------------------------------------------------ */

const EMAIL_WEBHOOK_URL = import.meta.env.VITE_N8N_NOTIFICATION_WEBHOOK_URL as
  | string
  | undefined;

const EMAIL_WEBHOOK_SECRET = import.meta.env
  .VITE_N8N_NOTIFICATION_WEBHOOK_SECRET as string | undefined;

export async function sendEmailOnly(params: {
  to: string;
  fullName?: string | null;
  title: string;
  message?: string | null;
  type: NotificationType;
  priority?: NotificationPriority;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  if (!EMAIL_WEBHOOK_URL) {
    console.warn(
      "sendEmailOnly: VITE_N8N_NOTIFICATION_WEBHOOK_URL is not set — skipping",
    );
    return { ok: false, error: "Webhook URL not configured" };
  }

  if (!params.to) {
    console.warn("sendEmailOnly: no recipient email — skipping");
    return { ok: false, error: "No recipient email" };
  }

  try {
    const fullName = params.fullName ?? "Team Member";
    const firstName = fullName.split(' ')[0];

    const context: EmailContext = {
      fullName,
      firstName,
      title: params.title,
      message: params.message ?? "",
      actionUrl: params.actionUrl ?? "/",
      metadata: params.metadata ?? {},
      appName: "Nomatata",
      appUrl: "https://codex.itsnomatata.com"
    };

    const emailTemplate = EmailTemplateService.generateTemplate(params.type, context);

    const response = await fetch(EMAIL_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(EMAIL_WEBHOOK_SECRET
          ? { "x-notification-secret": EMAIL_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify({
        to: params.to,
        fullName,
        firstName,
        title: params.title,
        message: params.message ?? "",
        type: params.type,
        priority: params.priority ?? "medium",
        actionUrl: params.actionUrl ?? "/",
        metadata: params.metadata ?? {},
        emailHtml: emailTemplate.html,
        subject: emailTemplate.subject
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("sendEmailOnly: webhook failed", response.status, errorText);
      return { ok: false, error: `Webhook returned ${response.status}` };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("sendEmailOnly: fetch error", err);
    return { ok: false, error: message };
  }
}

/* ------------------------------------------------------------------
   TYPED SHORTHAND HELPERS
   Call these from leaveService, meetingService, approvalService etc.
   instead of building the params object every time
------------------------------------------------------------------ */

export async function notifyAndEmailUser(params: {
  organizationId: string;
  userId: string;
  userEmail: string;
  fullName?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  referenceId?: string | null;
  referenceType?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}) {
  // Fire in-system notification + email in parallel
  const [notification] = await Promise.allSettled([
    sendNotification({
      organizationId: params.organizationId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      actionUrl: params.actionUrl,
      priority: params.priority ?? "medium",
      metadata: params.metadata,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
      entityType: params.entityType,
      entityId: params.entityId,
      sendEmail: true,
    }),
  ]);

  if (notification.status === "rejected") {
    console.error("notifyAndEmailUser: failed", notification.reason);
  }

  return notification.status === "fulfilled" ? notification.value : null;
}

export async function notifyAndEmailUsers(params: {
  organizationId: string;
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  actionUrl: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  referenceId?: string | null;
  referenceType?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}) {
  return sendBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: params.type,
    title: params.title,
    message: params.message,
    actionUrl: params.actionUrl,
    priority: params.priority ?? "medium",
    metadata: params.metadata,
    referenceId: params.referenceId,
    referenceType: params.referenceType,
    entityType: params.entityType,
    entityId: params.entityId,
    sendEmail: true,
  });
}