import { supabase } from "../../../lib/supabase/client";
import {
  createNotification,
  type NotificationPriority,
  type NotificationType,
} from "../../../lib/supabase/mutations/notifications";
import type { NotificationRow } from "../../../lib/supabase/queries/notifications";
import { EmailTemplateService, type EmailContext } from "./emailTemplates";

export type GlobalNotificationPreferences = {
  user_id: string;
  organization_id: string | null;
  in_app_enabled: boolean;
  email_enabled: boolean;
  email_messages: boolean;
  email_tasks: boolean;
  email_mentions: boolean;
  email_comments: boolean;
  email_weekly_summary: boolean;
  email_monthly_summary: boolean;
  email_time_tracking_reminders: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};

export type NotificationEmailPayload = {
  notificationId?: string | null;
  organizationId: string;
  userId: string;
  eventType: NotificationType | string;
  recipientEmail: string;
  recipientName?: string | null;
  title: string;
  body: string;
  actionUrl?: string | null;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  scheduledFor?: string;
};

export type AdvancedNotificationInput = {
  organizationId: string;
  userId: string;
  actorUserId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  entityType?: string | null;
  entityId?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
  category?: string | null;
  dedupeKey?: string | null;
  channels?: Array<"in_app" | "email" | "push">;
  email?: boolean;
};

export type BulkAdvancedNotificationInput = Omit<
  AdvancedNotificationInput,
  "userId"
> & {
  userIds: string[];
  excludeActor?: boolean;
};

const DEFAULT_APP_NAME = "Nomatata Workspace";

function getAppUrl() {
  return (
    (import.meta.env.VITE_APP_URL as string | undefined) ||
    (typeof window !== "undefined" ? window.location.origin : "") ||
    "https://codex.itsnomatata.com"
  );
}

function normalizeRelativeLink(link?: string | null) {
  if (!link) return "/notifications";
  if (link.startsWith("http")) return link;
  return link.startsWith("/") ? link : `/${link}`;
}

function minutesFromTime(value: string | null) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function isQuietHoursActive(preferences: GlobalNotificationPreferences) {
  const start = minutesFromTime(preferences.quiet_hours_start);
  const end = minutesFromTime(preferences.quiet_hours_end);
  if (start === null || end === null || start === end) return false;

  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();

  if (start < end) {
    return current >= start && current < end;
  }

  return current >= start || current < end;
}

function getDefaultPreferences(params: {
  userId: string;
  organizationId?: string | null;
}): GlobalNotificationPreferences {
  return {
    user_id: params.userId,
    organization_id: params.organizationId ?? null,
    in_app_enabled: true,
    email_enabled: true,
    email_messages: false,
    email_tasks: true,
    email_mentions: true,
    email_comments: true,
    email_weekly_summary: true,
    email_monthly_summary: true,
    email_time_tracking_reminders: true,
    quiet_hours_start: null,
    quiet_hours_end: null,
  };
}

function normalizeTypeForTemplate(type: string) {
  const aliases: Record<string, string> = {
    invited_to_workspace: "user_invite",
    task_comment_added: "task_comment",
    task_status_changed: "task_updated",
    task_mention: "task_mention",
    chat_message_received: "chat_message",
    weekly_time_summary: "weekly_time_summary",
    monthly_time_summary: "monthly_time_summary",
    time_tracking_not_started: "time_tracking_not_started",
    time_tracking_timer_left_running: "time_tracking_timer_left_running",
    invoice_or_payment_notice: "invoice_update",
    workspace_admin_notice: "workspace_admin_notice",
  };

  return aliases[type] ?? type;
}

function isEmailAllowedByType(
  type: string,
  preferences: GlobalNotificationPreferences,
) {
  if (!preferences.email_enabled) return false;

  if (type.includes("chat_message")) return preferences.email_messages;
  if (type.includes("task_mention")) return preferences.email_mentions;
  if (type.includes("comment")) return preferences.email_comments;
  if (type.includes("task")) return preferences.email_tasks;
  if (type === "weekly_time_summary") return preferences.email_weekly_summary;
  if (type === "monthly_time_summary") return preferences.email_monthly_summary;
  if (type.includes("time_tracking")) {
    return preferences.email_time_tracking_reminders;
  }

  return true;
}

async function loadProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getGlobalNotificationPreferences(params: {
  userId: string;
  organizationId?: string | null;
}) {
  const defaults = getDefaultPreferences(params);

  const { data, error } = await supabase
    .from("notification_preferences")
    .select(
      "user_id, organization_id, in_app_enabled, email_enabled, email_messages, email_tasks, email_mentions, email_comments, email_weekly_summary, email_monthly_summary, email_time_tracking_reminders, quiet_hours_start, quiet_hours_end",
    )
    .eq("user_id", params.userId)
    .eq("notification_type", "global")
    .eq("channel", "email")
    .maybeSingle();

  if (error) {
    console.warn("Failed to load global notification preferences.", error);
    return defaults;
  }

  return {
    ...defaults,
    ...(data ?? {}),
  } as GlobalNotificationPreferences;
}

export async function saveGlobalNotificationPreferences(
  preferences: GlobalNotificationPreferences,
) {
  const { data: existing, error: existingError } = await supabase
    .from("notification_preferences")
    .select("id")
    .eq("user_id", preferences.user_id)
    .eq("notification_type", "global")
    .eq("channel", "email")
    .maybeSingle();

  if (existingError) throw existingError;

  const payload = {
    user_id: preferences.user_id,
    organization_id: preferences.organization_id,
    notification_type: "global",
    channel: "email",
    is_enabled: preferences.email_enabled,
    in_app_enabled: preferences.in_app_enabled,
    email_enabled: preferences.email_enabled,
    email_messages: preferences.email_messages,
    email_tasks: preferences.email_tasks,
    email_mentions: preferences.email_mentions,
    email_comments: preferences.email_comments,
    email_weekly_summary: preferences.email_weekly_summary,
    email_monthly_summary: preferences.email_monthly_summary,
    email_time_tracking_reminders: preferences.email_time_tracking_reminders,
    quiet_hours_start: preferences.quiet_hours_start || null,
    quiet_hours_end: preferences.quiet_hours_end || null,
  };

  if (existing?.id) {
    const { data, error } = await supabase
      .from("notification_preferences")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data: legacyExisting, error: legacyExistingError } = await supabase
    .from("notification_preferences")
    .select("id")
    .eq("user_id", preferences.user_id)
    .limit(1)
    .maybeSingle();

  if (legacyExistingError) throw legacyExistingError;

  if (legacyExisting?.id) {
    const { data, error } = await supabase
      .from("notification_preferences")
      .update(payload)
      .eq("id", legacyExisting.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("notification_preferences")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function shouldCreateInAppNotification(params: {
  organizationId: string;
  userId: string;
}) {
  const preferences = await getGlobalNotificationPreferences(params);
  return preferences.in_app_enabled;
}

export async function shouldCreateEmailEvent(params: {
  organizationId: string;
  userId: string;
  type: string;
  priority?: NotificationPriority;
}) {
  const preferences = await getGlobalNotificationPreferences(params);
  if (!isEmailAllowedByType(params.type, preferences)) return false;

  if (
    isQuietHoursActive(preferences) &&
    params.priority !== "high" &&
    params.priority !== "urgent"
  ) {
    return false;
  }

  return true;
}

export function buildEmailEventPayload(params: NotificationEmailPayload) {
  const fullName = params.recipientName || "Team Member";
  const firstName = fullName.split(" ")[0] || "Team Member";
  const actionUrl = normalizeRelativeLink(params.actionUrl);
  const appUrl = getAppUrl();

  const context: EmailContext = {
    fullName,
    firstName,
    title: params.title,
    message: params.body,
    actionUrl,
    metadata: params.metadata ?? {},
    appName: DEFAULT_APP_NAME,
    appUrl,
  };
  const templateKey = normalizeTypeForTemplate(params.eventType);
  const template = EmailTemplateService.generateTemplate(templateKey, context);

  return {
    organization_id: params.organizationId,
    user_id: params.userId,
    notification_id: params.notificationId ?? null,
    event_type: params.eventType,
    recipient_email: params.recipientEmail,
    recipient_name: params.recipientName ?? null,
    subject: template.subject || params.title,
    template_key: templateKey,
    payload: {
      title: params.title,
      body: params.body,
      action_url: actionUrl,
      app_url: appUrl,
      app_name: DEFAULT_APP_NAME,
      priority: params.priority ?? "medium",
      metadata: params.metadata ?? {},
      email_html: template.html,
      email_text: template.text ?? params.body,
    },
    status: "pending",
    scheduled_for: params.scheduledFor ?? new Date().toISOString(),
  };
}

export async function queueNotificationEmailEvent(
  params: NotificationEmailPayload,
) {
  if (
    !(await shouldCreateEmailEvent({
      organizationId: params.organizationId,
      userId: params.userId,
      type: String(params.eventType),
      priority: params.priority,
    }))
  ) {
    await writeNotificationAuditLog({
      organizationId: params.organizationId,
      userId: params.userId,
      eventType: String(params.eventType),
      channel: "email",
      status: "skipped_preferences",
      metadata: { notification_id: params.notificationId ?? null },
    });
    return null;
  }

  const eventPayload = buildEmailEventPayload(params);
  const { data, error } = await supabase
    .from("email_events")
    .insert(eventPayload)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return null;
    }
    throw error;
  }

  await writeNotificationAuditLog({
    organizationId: params.organizationId,
    userId: params.userId,
    eventType: String(params.eventType),
    channel: "email",
    status: "queued",
    metadata: {
      email_event_id: data.id,
      notification_id: params.notificationId ?? null,
    },
  });

  return data;
}

export async function writeNotificationAuditLog(params: {
  organizationId: string;
  userId?: string | null;
  eventType: string;
  channel: string;
  status: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("notification_audit_logs").insert({
    organization_id: params.organizationId,
    user_id: params.userId ?? null,
    event_type: params.eventType,
    channel: params.channel,
    status: params.status,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.warn("Failed to write notification audit log.", error);
  }
}

export async function createAdvancedNotification(
  params: AdvancedNotificationInput,
) {
  if (params.actorUserId && params.actorUserId === params.userId) {
    return null;
  }

  const channels = params.channels ?? ["in_app", "email"];
  let notification: NotificationRow | null = null;

  if (
    channels.includes("in_app") &&
    (await shouldCreateInAppNotification({
      organizationId: params.organizationId,
      userId: params.userId,
    }))
  ) {
    notification = await createNotification({
      organizationId: params.organizationId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.body,
      entityType: params.entityType,
      entityId: params.entityId,
      actionUrl: normalizeRelativeLink(params.actionUrl),
      priority: params.priority,
      metadata: params.metadata,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
      actorUserId: params.actorUserId,
      category: params.category,
      dedupeKey: params.dedupeKey,
      deliveryState: channels.includes("email") ? "processing" : "delivered",
    });
  }

  if (channels.includes("email") && params.email !== false) {
    const profile = await loadProfile(params.userId);
    if (profile?.email) {
      await queueNotificationEmailEvent({
        organizationId: params.organizationId,
        userId: params.userId,
        notificationId: notification?.id ?? null,
        eventType: params.type,
        recipientEmail: profile.email,
        recipientName: profile.full_name,
        title: params.title,
        body: params.body ?? "",
        actionUrl: params.actionUrl,
        priority: params.priority,
        metadata: params.metadata,
      });
    }
  }

  await writeNotificationAuditLog({
    organizationId: params.organizationId,
    userId: params.userId,
    eventType: params.type,
    channel: channels.join(","),
    status: "created",
    metadata: {
      notification_id: notification?.id ?? null,
      dedupe_key: params.dedupeKey ?? null,
    },
  });

  return notification;
}

export async function createBulkAdvancedNotifications(
  params: BulkAdvancedNotificationInput,
) {
  const excludedActor =
    params.excludeActor !== false ? params.actorUserId ?? null : null;
  const recipients = [...new Set(params.userIds.filter(Boolean))].filter(
    (userId) => userId !== excludedActor,
  );

  const results = [];
  for (const userId of recipients) {
    results.push(
      await createAdvancedNotification({
        ...params,
        userId,
        dedupeKey: params.dedupeKey ? `${params.dedupeKey}:${userId}` : null,
      }),
    );
  }

  return results.filter(Boolean);
}

export async function getTaskWatcherRecipientIds(taskId: string) {
  const { data, error } = await supabase
    .from("task_watchers")
    .select("user_id")
    .eq("task_id", taskId);

  if (error) throw error;
  return [...new Set((data ?? []).map((row) => row.user_id).filter(Boolean))];
}

export async function getProjectMemberRecipientIds(projectId: string) {
  const { data, error } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);

  if (error) {
    console.warn("Project member lookup failed.", error);
    return [];
  }

  return [...new Set((data ?? []).map((row) => row.user_id).filter(Boolean))];
}

export async function getConversationRecipientIds(conversationId: string) {
  const { data, error } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId);

  if (error) throw error;
  return [...new Set((data ?? []).map((row) => row.user_id).filter(Boolean))];
}
