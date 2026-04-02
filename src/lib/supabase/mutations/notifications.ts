import { supabase } from "../client";
import type { NotificationRow } from "../queries/notifications";

export async function markNotificationAsRead(notificationId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .select(
      "id, organization_id, user_id, type, title, message, reference_id, reference_type, is_read, created_at",
    )
    .single();

  if (error) throw error;
  return data as NotificationRow;
}

export async function markAllNotificationsAsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) throw error;
  return true;
}

export async function createNotification(params: {
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
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
      message: params.message,
      reference_id: params.referenceId ?? null,
      reference_type: params.referenceType ?? null,
      is_read: false,
    })
    .select(
      "id, organization_id, user_id, type, title, message, reference_id, reference_type, is_read, created_at",
    )
    .single();

  if (error) throw error;
  return data as NotificationRow;
}
