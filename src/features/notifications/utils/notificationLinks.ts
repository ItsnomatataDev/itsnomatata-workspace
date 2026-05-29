type NotificationLinkSource = {
  action_url?: string | null;
  type?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

function readMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function resolveNotificationActionUrl(
  notification: NotificationLinkSource,
) {
  const metadata =
    notification.metadata && typeof notification.metadata === "object"
      ? notification.metadata
      : null;

  const boardId =
    readMetadataString(metadata, "boardId") ??
    readMetadataString(metadata, "clientId");
  const taskId =
    readMetadataString(metadata, "taskId") ??
    (notification.entity_type === "task" ? notification.entity_id : null);

  if (boardId && taskId) {
    return `/boards/${boardId}?cardId=${taskId}`;
  }

  if (notification.action_url?.startsWith("/")) {
    if (taskId && notification.action_url === `/tasks/${taskId}` && boardId) {
      return `/boards/${boardId}?cardId=${taskId}`;
    }
    return notification.action_url;
  }

  if (taskId && notification.type === "task_assigned") {
    return `/tasks/${taskId}`;
  }

  return notification.action_url || "/notifications";
}
