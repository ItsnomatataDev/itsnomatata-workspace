import { getUserNotifications } from "../../../lib/supabase/queries/notifications";
import type { AiRouterContext } from "../types/aiToolTypes";

export async function searchNotificationsFallback(
  context: AiRouterContext,
  options?: { unreadOnly?: boolean; limit?: number },
) {
  const notifications = await getUserNotifications({
    userId: context.userId,
    organizationId: context.organizationId,
    unreadOnly: options?.unreadOnly ?? false,
    limit: options?.limit ?? 15,
  });

  return {
    notifications: notifications.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      message: item.message,
      is_read: item.is_read,
      created_at: item.created_at,
      action_url: item.action_url,
    })),
    count: notifications.length,
  };
}
