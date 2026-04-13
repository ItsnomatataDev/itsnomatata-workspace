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

export type NotificationItem = NotificationRow;

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
  return deliverNotification(params);
}

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
  return deliverBulkNotifications(params);
}