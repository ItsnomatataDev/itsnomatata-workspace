import type { NotificationRow } from "../../../lib/supabase/queries/notifications";

const LEAVE_NOTIFICATION_TYPES = new Set([
  "leave_request_submitted",
  "leave_request_approved",
  "leave_request_rejected",
  "leave_update",
  "leave_reminder",
]);

const CHAT_NOTIFICATION_TYPES = new Set([
  "chat_message",
  "chat_message_received",
]);

export function isLeaveNotification(notification: Pick<NotificationRow, "type" | "category">) {
  const type = String(notification.type ?? "").toLowerCase();
  if (LEAVE_NOTIFICATION_TYPES.has(type) || type.includes("leave")) return true;
  return String(notification.category ?? "").toLowerCase() === "leave";
}

export function isChatNotification(notification: Pick<NotificationRow, "type" | "category">) {
  const type = String(notification.type ?? "").toLowerCase();
  if (CHAT_NOTIFICATION_TYPES.has(type) || type.includes("chat")) return true;
  return String(notification.category ?? "").toLowerCase() === "chat";
}

export function countUnreadLeaveNotifications(
  notifications: NotificationRow[],
) {
  return notifications.filter((item) => !item.is_read && isLeaveNotification(item)).length;
}

export function countUnreadChatNotifications(
  notifications: NotificationRow[],
) {
  return notifications.filter((item) => !item.is_read && isChatNotification(item)).length;
}
