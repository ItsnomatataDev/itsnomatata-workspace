type NotificationLinkSource = {
  action_url?: string | null;
  type?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

const TASK_NOTIFICATION_TYPES = new Set([
  "task_assigned",
  "task_updated",
  "task_comment",
  "task_collaboration_invite",
]);

function readMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  keys: string[],
) {
  if (!metadata) return null;

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function parseTaskIdFromActionUrl(actionUrl?: string | null) {
  if (!actionUrl?.startsWith("/tasks/")) return null;
  const match = actionUrl.match(/^\/tasks\/([^/?#]+)/);
  return match?.[1] ?? null;
}

/** Prefer board deep link; fall back to /tasks/:id redirect route. */
export function buildTaskNotificationUrl(
  taskId: string,
  boardId?: string | null,
) {
  const normalizedTaskId = taskId.trim();
  const normalizedBoardId = boardId?.trim() || null;

  if (normalizedBoardId) {
    return `/boards/${normalizedBoardId}?cardId=${normalizedTaskId}`;
  }

  return `/tasks/${normalizedTaskId}`;
}

export function resolveNotificationActionUrl(
  notification: NotificationLinkSource,
) {
  const metadata =
    notification.metadata && typeof notification.metadata === "object"
      ? notification.metadata
      : null;

  const taskId =
    readMetadataString(metadata, ["taskId", "task_id"]) ??
    (notification.entity_type === "task" ? notification.entity_id : null) ??
    parseTaskIdFromActionUrl(notification.action_url);

  const boardId =
    readMetadataString(metadata, ["boardId", "board_id", "clientId", "client_id"]);

  if (taskId && boardId) {
    return buildTaskNotificationUrl(taskId, boardId);
  }

  if (notification.type === "user_signup") {
    return "/admin/employees?status=pending_approval";
  }

  if (taskId && TASK_NOTIFICATION_TYPES.has(notification.type ?? "")) {
    return buildTaskNotificationUrl(taskId, boardId);
  }

  if (notification.action_url?.startsWith("/")) {
    const actionTaskId = parseTaskIdFromActionUrl(notification.action_url);

    if (actionTaskId) {
      return buildTaskNotificationUrl(actionTaskId, boardId);
    }

    if (
      taskId &&
      notification.action_url === `/tasks/${taskId}` &&
      boardId
    ) {
      return buildTaskNotificationUrl(taskId, boardId);
    }

    return notification.action_url;
  }

  if (taskId) {
    return buildTaskNotificationUrl(taskId, boardId);
  }

  return notification.action_url || "/notifications";
}
