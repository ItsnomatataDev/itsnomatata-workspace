import {
  createNotification,
  type NotificationChannel,
  type NotificationPriority,
  type NotificationType,
} from "../../../lib/supabase/mutations/notifications";
import type { NotificationRow } from "../../../lib/supabase/queries/notifications";
import { supabase } from "../../../lib/supabase/client";
import { EmailTemplateService, type EmailContext } from "./emailTemplates";

export type NotificationDeliveryStatus =
  | "queued"
  | "skipped"
  | "sent"
  | "delivered"
  | "failed";

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
  actorUserId?: string | null;
  category?: string | null;
  dedupeKey?: string | null;
  channels?: NotificationChannel[];
  sendEmail?: boolean;
};

export type DeliverBulkNotificationsParams = Omit<
  DeliverNotificationParams,
  "userId"
> & {
  userIds: string[];
  excludeActor?: boolean;
};

export type DeliveryAttemptResult = {
  channel: NotificationChannel;
  ok: boolean;
  status: NotificationDeliveryStatus;
  deliveryId?: string;
  error?: string;
};

export type DeliverNotificationResult = {
  ok: boolean;
  notification: NotificationRow;
  deliveries: DeliveryAttemptResult[];
};

export type DeliverBulkNotificationsResult = {
  ok: boolean;
  total: number;
  succeeded: number;
  failed: number;
  results: Array<
    | ({ userId: string } & DeliverNotificationResult)
    | { userId: string; ok: false; error: string; deliveries: [] }
  >;
};

const EMAIL_WEBHOOK_URL = import.meta.env.VITE_N8N_NOTIFICATION_WEBHOOK_URL as
  | string
  | undefined;
const EMAIL_WEBHOOK_SECRET = import.meta.env
  .VITE_N8N_NOTIFICATION_WEBHOOK_SECRET as string | undefined;

function normalizeChannels(params: DeliverNotificationParams) {
  if (params.channels?.length) return [...new Set(params.channels)];
  if (params.sendEmail === false) return ["in_app", "push"] as NotificationChannel[];
  return ["in_app", "email", "push"] as NotificationChannel[];
}

async function isChannelEnabled(params: {
  organizationId: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
}) {
  if (params.channel === "in_app") return true;

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("is_enabled")
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId)
    .eq("notification_type", params.type)
    .eq("channel", params.channel)
    .maybeSingle();

  if (error) {
    console.warn("Notification preference check failed; defaulting enabled.", error);
    return true;
  }

  return data?.is_enabled ?? true;
}

async function createDelivery(params: {
  notificationId: string;
  channel: NotificationChannel;
  destination?: string | null;
  status?: NotificationDeliveryStatus;
  provider?: string | null;
  errorMessage?: string | null;
}) {
  const { data, error } = await supabase
    .from("notification_deliveries")
    .insert({
      notification_id: params.notificationId,
      channel: params.channel,
      destination: params.destination ?? null,
      status: params.status ?? "queued",
      provider: params.provider ?? null,
      error_message: params.errorMessage ?? null,
      attempted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function updateDelivery(
  deliveryId: string,
  values: {
    status: NotificationDeliveryStatus;
    errorMessage?: string | null;
    providerMessageId?: string | null;
  },
) {
  const delivered = values.status === "sent" || values.status === "delivered";
  const { error } = await supabase
    .from("notification_deliveries")
    .update({
      status: values.status,
      error_message: values.errorMessage ?? null,
      provider_message_id: values.providerMessageId ?? null,
      delivered_at: delivered ? new Date().toISOString() : null,
    })
    .eq("id", deliveryId);

  if (error) throw error;
}

async function updateNotificationDeliveryState(
  notificationId: string,
  attempts: DeliveryAttemptResult[],
) {
  const attempted = attempts.filter((attempt) => attempt.status !== "skipped");
  const failed = attempted.filter((attempt) => !attempt.ok);
  const succeeded = attempted.filter((attempt) => attempt.ok);

  const deliveryState =
    attempted.length === 0
      ? "delivered"
      : failed.length === 0
        ? "delivered"
        : succeeded.length === 0
          ? "failed"
          : "partial";

  const { error } = await supabase
    .from("notifications")
    .update({ delivery_state: deliveryState })
    .eq("id", notificationId);

  if (error) {
    console.warn("Failed to update notification delivery_state.", error);
  }
}

async function loadProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function sendEmail(params: {
  notification: NotificationRow;
  to: string;
  fullName?: string | null;
  type: NotificationType;
  priority: NotificationPriority;
}) {
  if (!EMAIL_WEBHOOK_URL) {
    return { ok: false, error: "VITE_N8N_NOTIFICATION_WEBHOOK_URL is not set." };
  }

  const fullName = params.fullName ?? "Team Member";
  const firstName = fullName.split(" ")[0];
  const context: EmailContext = {
    fullName,
    firstName,
    title: params.notification.title,
    message: params.notification.message ?? "",
    actionUrl: params.notification.action_url ?? "/notifications",
    metadata: params.notification.metadata ?? {},
    appName: "Nomatata",
    appUrl: window.location.origin,
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
      title: params.notification.title,
      message: params.notification.message ?? "",
      type: params.type,
      priority: params.priority,
      actionUrl: params.notification.action_url ?? "/notifications",
      metadata: params.notification.metadata ?? {},
      notificationId: params.notification.id,
      emailHtml: emailTemplate.html,
      subject: emailTemplate.subject,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return { ok: false, error: `Email webhook returned ${response.status}: ${body}` };
  }

  return { ok: true };
}

async function processEmailDelivery(params: {
  notification: NotificationRow;
  type: NotificationType;
  priority: NotificationPriority;
}) {
  const profile = await loadProfile(params.notification.user_id);
  const destination = profile?.email ?? null;

  if (!destination) {
    const deliveryId = await createDelivery({
      notificationId: params.notification.id,
      channel: "email",
      destination,
      status: "skipped",
      provider: "n8n",
      errorMessage: "User profile has no email address.",
    });
    return {
      channel: "email" as const,
      ok: true,
      status: "skipped" as const,
      deliveryId,
    };
  }

  const deliveryId = await createDelivery({
    notificationId: params.notification.id,
    channel: "email",
    destination,
    provider: "n8n",
  });

  try {
    const result = await sendEmail({
      notification: params.notification,
      to: destination,
      fullName: profile?.full_name,
      type: params.type,
      priority: params.priority,
    });

    if (!result.ok) {
      await updateDelivery(deliveryId, {
        status: "failed",
        errorMessage: result.error,
      });
      return {
        channel: "email" as const,
        ok: false,
        status: "failed" as const,
        deliveryId,
        error: result.error,
      };
    }

    await updateDelivery(deliveryId, { status: "sent" });
    return {
      channel: "email" as const,
      ok: true,
      status: "sent" as const,
      deliveryId,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await updateDelivery(deliveryId, { status: "failed", errorMessage: error });
    return {
      channel: "email" as const,
      ok: false,
      status: "failed" as const,
      deliveryId,
      error,
    };
  }
}

async function processPushDelivery(notification: NotificationRow) {
  let deliveryId: string | undefined;

  try {
    deliveryId = await createDelivery({
      notificationId: notification.id,
      channel: "push",
      status: "queued",
      provider: "supabase-edge:web-push",
    });

    const { data, error } = await supabase.functions.invoke(
      "send-push-notification",
      {
        body: {
          notificationId: notification.id,
          deliveryId,
        },
      },
    );

    if (error) throw error;

    const result = data as { ok?: boolean; sent?: number; failed?: number; error?: string };
    if (!result.ok || (result.sent ?? 0) === 0) {
      const message =
        result.error ??
        (result.failed ? `${result.failed} push subscription(s) failed.` : "No push subscriptions were sent.");
      await updateDelivery(deliveryId, {
        status: result.failed ? "failed" : "skipped",
        errorMessage: message,
      });
      return {
        channel: "push" as const,
        ok: !result.failed,
        status: result.failed ? ("failed" as const) : ("skipped" as const),
        deliveryId,
        error: result.failed ? message : undefined,
      };
    }

    await updateDelivery(deliveryId, { status: "sent" });
    return {
      channel: "push" as const,
      ok: true,
      status: "sent" as const,
      deliveryId,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (deliveryId) {
      await updateDelivery(deliveryId, { status: "failed", errorMessage: error });
    }
    return {
      channel: "push" as const,
      ok: false,
      status: "failed" as const,
      deliveryId,
      error,
    };
  }
}

export async function deliverNotification(
  params: DeliverNotificationParams,
): Promise<DeliverNotificationResult> {
  const priority = params.priority ?? "medium";
  const channels = normalizeChannels(params);

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
    actorUserId: params.actorUserId,
    category: params.category,
    dedupeKey: params.dedupeKey,
    deliveryState: "processing",
  });

  const deliveries: DeliveryAttemptResult[] = [];

  for (const channel of channels) {
    const enabled = await isChannelEnabled({
      organizationId: params.organizationId,
      userId: params.userId,
      type: params.type,
      channel,
    });

    if (!enabled) {
      if (channel !== "in_app") {
        const deliveryId = await createDelivery({
          notificationId: notification.id,
          channel,
          status: "skipped",
          provider: channel === "email" ? "n8n" : "supabase-edge:web-push",
          errorMessage: "Disabled by notification preferences.",
        });
        deliveries.push({ channel, ok: true, status: "skipped", deliveryId });
      }
      continue;
    }

    if (channel === "in_app") {
      deliveries.push({ channel, ok: true, status: "delivered" });
    } else if (channel === "email") {
      deliveries.push(
        await processEmailDelivery({ notification, type: params.type, priority }),
      );
    } else if (channel === "push") {
      deliveries.push(await processPushDelivery(notification));
    }
  }

  await updateNotificationDeliveryState(notification.id, deliveries);

  return {
    ok: deliveries.every((delivery) => delivery.ok),
    notification,
    deliveries,
  };
}

export async function deliverBulkNotifications(
  params: DeliverBulkNotificationsParams,
): Promise<DeliverBulkNotificationsResult> {
  const excludedActor =
    params.excludeActor !== false ? params.actorUserId ?? null : null;
  const uniqueUserIds = [...new Set(params.userIds.filter(Boolean))].filter(
    (userId) => userId !== excludedActor,
  );

  const results: DeliverBulkNotificationsResult["results"] = [];

  for (const userId of uniqueUserIds) {
    try {
      const result = await deliverNotification({
        ...params,
        userId,
        dedupeKey: params.dedupeKey ? `${params.dedupeKey}:${userId}` : undefined,
      });
      results.push({ userId, ...result });
    } catch (err) {
      results.push({
        userId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        deliveries: [],
      });
    }
  }

  const succeeded = results.filter((result) => result.ok).length;
  const failed = results.length - succeeded;

  return {
    ok: failed === 0,
    total: results.length,
    succeeded,
    failed,
    results,
  };
}
