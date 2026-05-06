import {
  getUnreadNotificationCount,
  getUserNotifications,
  type NotificationRow,
} from "../../../lib/supabase/queries/notifications";
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationChannel,
  type NotificationPriority,
  type NotificationType,
} from "../../../lib/supabase/mutations/notifications";
import { EmailTemplateService, type EmailContext } from "./emailTemplates";
import { supabase } from "../../../lib/supabase/client";

export type NotificationItem = NotificationRow;

type SendNotificationParams = {
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
  channels?: NotificationChannel[];
  sendEmail?: boolean;
};

type SendBulkNotificationParams = Omit<SendNotificationParams, "userId"> & {
  userIds: string[];
  excludeActor?: boolean;
};

async function createNotificationViaEdge(
  params: SendNotificationParams | SendBulkNotificationParams,
  userIds: string[],
) {
  const recipients = [...new Set(userIds.filter(Boolean))];

  if (recipients.length === 0) {
    return {
      ok: true,
      total: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    };
  }

  const { data, error } = await supabase.functions.invoke(
    "create-notification",
    {
      body: {
        organizationId: params.organizationId,
        userIds: recipients,
        type: params.type,
        title: params.title,
        message: params.message ?? null,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        actionUrl: params.actionUrl ?? null,
        priority: params.priority ?? "medium",
        metadata: params.metadata ?? {},
        referenceId: params.referenceId ?? null,
        referenceType: params.referenceType ?? null,
        actorUserId: params.actorUserId ?? null,
        category: params.category ?? null,
        dedupeKey: params.dedupeKey ?? null,
        channels: params.channels ?? undefined,
        sendEmail: params.sendEmail ?? true,
      },
    },
  );

  if (error) {
    console.error("CREATE NOTIFICATION EDGE ERROR:", error);
    throw error;
  }

  return data;
}

function getBulkRecipients(params: SendBulkNotificationParams) {
  const actorUserId = params.excludeActor === false ? null : params.actorUserId;

  return [
    ...new Set(
      params.userIds.filter((id) => {
        if (!id) return false;
        if (actorUserId && id === actorUserId) return false;
        return true;
      }),
    ),
  ];
}

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


export async function sendNotification(params: SendNotificationParams) {
  return createNotificationViaEdge(params, [params.userId]);
}


export async function sendBulkNotifications(params: SendBulkNotificationParams) {
  return createNotificationViaEdge(params, getBulkRecipients(params));
}


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
    const firstName = fullName.split(" ")[0];

    const context: EmailContext = {
      fullName,
      firstName,
      title: params.title,
      message: params.message ?? "",
      actionUrl: params.actionUrl ?? "/",
      metadata: params.metadata ?? {},
      appName: "Nomatata",
      appUrl: "https://codex.itsnomatata.com",
    };

    const emailTemplate = EmailTemplateService.generateTemplate(
      params.type,
      context,
    );

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
        subject: emailTemplate.subject,
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
  actorUserId?: string | null;
  category?: string | null;
  dedupeKey?: string | null;
}) {
  try {
    return await sendNotification({
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
      actorUserId: params.actorUserId,
      category: params.category,
      dedupeKey: params.dedupeKey,
      sendEmail: true,
      channels: ["in_app", "email", "push"],
    });
  } catch (error) {
    console.error("notifyAndEmailUser: failed", error);
    return null;
  }
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
  actorUserId?: string | null;
  category?: string | null;
  dedupeKey?: string | null;
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
    actorUserId: params.actorUserId,
    category: params.category,
    dedupeKey: params.dedupeKey,
    sendEmail: true,
    channels: ["in_app", "email", "push"],
  });
}