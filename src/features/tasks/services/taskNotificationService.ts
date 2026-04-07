import { sendBulkNotifications, sendNotification } from "../../notifications/services/notificationService";

export async function notifyTaskAssigned(params: {
  organizationId: string;
  userId: string;
  taskId: string;
  taskTitle: string;
}) {
  return sendNotification({
    organizationId: params.organizationId,
    userId: params.userId,
    type: "task_assigned",
    title: "New task assigned",
    message: `You were assigned to "${params.taskTitle}".`,
    entityType: "task",
    entityId: params.taskId,
    referenceId: params.taskId,
    referenceType: "task",
    actionUrl: `/tasks/${params.taskId}`,
    priority: "high",
    metadata: {
      taskId: params.taskId,
      taskTitle: params.taskTitle,
    },
  });
}

export async function notifyTaskCollaborators(params: {
  organizationId: string;
  userIds: string[];
  taskId: string;
  taskTitle: string;
}) {
  return sendBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: "task_collaboration_invite",
    title: "Task collaboration invite",
    message: `You were invited to collaborate on "${params.taskTitle}".`,
    entityType: "task",
    entityId: params.taskId,
    referenceId: params.taskId,
    referenceType: "task",
    actionUrl: `/tasks/${params.taskId}`,
    priority: "medium",
    metadata: {
      taskId: params.taskId,
      taskTitle: params.taskTitle,
    },
  });
}

export async function notifyTaskComment(params: {
  organizationId: string;
  userIds: string[];
  taskId: string;
  taskTitle: string;
  authorName: string;
}) {
  return sendBulkNotifications({
    organizationId: params.organizationId,
    userIds: params.userIds,
    type: "task_comment",
    title: "New task comment",
    message: `${params.authorName} commented on "${params.taskTitle}".`,
    entityType: "task",
    entityId: params.taskId,
    referenceId: params.taskId,
    referenceType: "task",
    actionUrl: `/tasks/${params.taskId}`,
    priority: "medium",
    metadata: {
      taskId: params.taskId,
      taskTitle: params.taskTitle,
      authorName: params.authorName,
    },
  });
}